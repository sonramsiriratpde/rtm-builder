/**
 * diagram.js
 * Builds the "hero" trace diagram SVG from the actual uploaded data —
 * not sample data. Pure function: takes a parsed table + column map,
 * returns an SVG markup string. No DOM access, so app.js is the only
 * place that touches the page.
 *
 * Exposed on the global RTM namespace as RTM.diagram.buildTraceSVG
 */
(function (global) {
  'use strict';

  const COL_X = { req: 70, test: 330, def: 580 };
  const VIEWBOX_W = 680;
  const HEADER_Y = 14;
  const FIRST_NODE_Y = 42;
  const ROW_SPACING = 24;
  const BOTTOM_PADDING = 24;
  const MAX_NODES_PER_COL = 6;
  const LABEL_MAX_CHARS = 13;

  const COLUMN_TITLES = {
    req: 'Requirement ID',
    test: 'Test Case ID',
    def: 'Defect ID'
  };

  function escXml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])
    );
  }

  function truncateLabel(id) {
    const s = String(id);
    return s.length > LABEL_MAX_CHARS ? s.slice(0, LABEL_MAX_CHARS - 1) + '…' : s;
  }

  function naturalCompare(a, b) {
    // Local copy so this module has no hard dependency on rtm.js load order.
    const re = /(\d+)|(\D+)/g;
    const ax = String(a).match(re) || [];
    const bx = String(b).match(re) || [];
    const len = Math.max(ax.length, bx.length);
    for (let i = 0; i < len; i++) {
      const av = ax[i] || '';
      const bv = bx[i] || '';
      const an = parseInt(av, 10);
      const bn = parseInt(bv, 10);
      if (!isNaN(an) && !isNaN(bn)) {
        if (an !== bn) return an - bn;
      } else if (av !== bv) {
        return av < bv ? -1 : 1;
      }
    }
    return 0;
  }

  /**
   * Walks the raw parsed rows (not the grouped RTM) so that test↔defect
   * relationships on the same input row stay paired correctly.
   */
  function collect(table, colMap) {
    const reqSeen = new Set(), testSeen = new Set(), defSeen = new Set();
    const reqIds = [], testIds = [], defIds = [];
    const edgeSeen = new Set();
    const edges = []; // { fromCol, fromId, toCol, toId, defect }

    table.rows.forEach((row) => {
      const reqId = (row[colMap.req] || '').toString().trim();
      const testId = (row[colMap.test] || '').toString().trim();
      const defId = (row[colMap.def] || '').toString().trim();
      if (!reqId) return;

      if (!reqSeen.has(reqId)) { reqSeen.add(reqId); reqIds.push(reqId); }
      if (testId && !testSeen.has(testId)) { testSeen.add(testId); testIds.push(testId); }
      if (defId && !defSeen.has(defId)) { defSeen.add(defId); defIds.push(defId); }

      const addEdge = (fromCol, fromId, toCol, toId, defect) => {
        const key = fromCol + ':' + fromId + '>' + toCol + ':' + toId;
        if (edgeSeen.has(key)) return;
        edgeSeen.add(key);
        edges.push({ fromCol, fromId, toCol, toId, defect });
      };

      if (testId) addEdge('req', reqId, 'test', testId, false);
      if (defId) {
        if (testId) addEdge('test', testId, 'def', defId, true);
        else addEdge('req', reqId, 'def', defId, true);
      }
    });

    reqIds.sort(naturalCompare);
    testIds.sort(naturalCompare);
    defIds.sort(naturalCompare);

    return { reqIds, testIds, defIds, edges };
  }

  // function layoutColumn(ids, x) {
  //   const shown = ids.slice(0, MAX_NODES_PER_COL);
  //   const hiddenCount = ids.length - shown.length;
  //   const nodes = shown.map((id, i) => ({ id, x, y: FIRST_NODE_Y + i * ROW_SPACING }));
  //   const rowsUsed = nodes.length + (hiddenCount > 0 ? 1 : 0) || 1; // at least 1 row for the "empty" placeholder
  //   return { nodes, hiddenCount, rowsUsed, x };
  // }

  function layoutColumn(ids, x, maxNodes) {
    maxNodes = maxNodes || MAX_NODES_PER_COL;
    const shown = ids.slice(0, maxNodes);
    const hiddenCount = ids.length - shown.length;
    const nodes = shown.map((id, i) => ({ id, x, y: FIRST_NODE_Y + i * ROW_SPACING }));
    const rowsUsed = nodes.length + (hiddenCount > 0 ? 1 : 0) || 1;
    return { nodes, hiddenCount, rowsUsed, x };
  }

    function inlineStyleBlock() {
    return (
      '<style>' +
      '.node{fill:#FAFAF7;stroke:#1B2430;stroke-width:1.4;}' +
      '.node-label{font-family:monospace;font-size:10px;fill:#1B2430;}' +
      '.node-label.more,.node-label.empty{fill:#5B6570;font-style:italic;}' +
      '.diagram-header{font-family:monospace;font-size:10px;font-weight:600;letter-spacing:.06em;fill:#5B6570;}' +
      '.trace-line{stroke:#1D6E6E;stroke-width:1.5;fill:none;}' +
      '.trace-line.defect{stroke:#B4432D;}' +
      '</style>'
    );
  }

  function nodeMarkup(col) {
    let out = '';
    col.nodes.forEach((n) => {
      out += `<circle class="node" cx="${n.x}" cy="${n.y}" r="4.5"></circle>`;
      out += `<text class="node-label" x="${n.x + 9}" y="${n.y + 3.5}">${escXml(truncateLabel(n.id))}</text>`;
    });
    if (col.hiddenCount > 0) {
      const y = FIRST_NODE_Y + col.nodes.length * ROW_SPACING;
      out += `<text class="node-label more" x="${col.x + 9}" y="${y + 3.5}">+${col.hiddenCount} more</text>`;
    }
    if (col.nodes.length === 0 && col.hiddenCount === 0) {
      out += `<text class="node-label empty" x="${col.x}" y="${FIRST_NODE_Y + 3.5}">None linked</text>`;
    }
    return out;
  }

  function edgeMarkup(edges, reqCol, testCol, defCol) {
    const posOf = (col, id) => {
      const list = col === 'req' ? reqCol.nodes : col === 'test' ? testCol.nodes : defCol.nodes;
      return list.find((n) => n.id === id) || null;
    };

    let out = '';
    let i = 0;
    edges.forEach((e) => {
      const from = posOf(e.fromCol, e.fromId);
      const to = posOf(e.toCol, e.toId);
      if (!from || !to) return; // one end got truncated out of view — skip
      const midX = (from.x + to.x) / 2;
      const d = `M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
      const cls = 'trace-line' + (e.defect ? ' defect' : '');
      const delay = (i * 0.05).toFixed(2);
      out += `<path class="${cls}" style="animation-delay:${delay}s" d="${d}"></path>`;
      i++;
    });
    return out;
  }

  function headerMarkup() {
    return (
      `<text class="diagram-header" x="${COL_X.req}" y="${HEADER_Y}">${COLUMN_TITLES.req}</text>` +
      `<text class="diagram-header" x="${COL_X.test}" y="${HEADER_Y}">${COLUMN_TITLES.test}</text>` +
      `<text class="diagram-header" x="${COL_X.def}" y="${HEADER_Y}">${COLUMN_TITLES.def}</text>`
    );
  }

  /**
   * @param {{headers:string[], rows:string[][]}} table
   * @param {{req:number, test:number, def:number}} colMap
   * @returns {string} SVG markup, ready to inject via innerHTML
   */
  // function buildTraceSVG(table, colMap) {
  //   const data = collect(table, colMap);

  //   const reqCol = layoutColumn(data.reqIds, COL_X.req);
  //   const testCol = layoutColumn(data.testIds, COL_X.test);
  //   const defCol = layoutColumn(data.defIds, COL_X.def);

  //   const maxRows = Math.max(reqCol.rowsUsed, testCol.rowsUsed, defCol.rowsUsed, 1);
  //   const height = Math.max(FIRST_NODE_Y + (maxRows - 1) * ROW_SPACING + BOTTOM_PADDING, 90);

  //   const edges = edgeMarkup(data.edges, reqCol, testCol, defCol);
  //   const nodes = nodeMarkup(reqCol) + nodeMarkup(testCol) + nodeMarkup(defCol);

  //   return (
  //     `<svg viewBox="0 0 ${VIEWBOX_W} ${height}" xmlns="http://www.w3.org/2000/svg">` +
  //     headerMarkup() +
  //     `<g class="edges">${edges}</g>` +
  //     `<g class="nodes">${nodes}</g>` +
  //     `</svg>`
  //   );
  // }
  
  function buildTraceSVG(table, colMap, opts) {
    opts = opts || {};
    const cap = opts.full ? Infinity : MAX_NODES_PER_COL;
    const data = collect(table, colMap);

    const reqCol = layoutColumn(data.reqIds, COL_X.req, cap);
    const testCol = layoutColumn(data.testIds, COL_X.test, cap);
    const defCol = layoutColumn(data.defIds, COL_X.def, cap);

    const maxRows = Math.max(reqCol.rowsUsed, testCol.rowsUsed, defCol.rowsUsed, 1);
    const height = Math.max(FIRST_NODE_Y + (maxRows - 1) * ROW_SPACING + BOTTOM_PADDING, 90);

    const edges = edgeMarkup(data.edges, reqCol, testCol, defCol);
    const nodes = nodeMarkup(reqCol) + nodeMarkup(testCol) + nodeMarkup(defCol);

    return (
      `<svg width="${VIEWBOX_W}" height="${height}" viewBox="0 0 ${VIEWBOX_W} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      (opts.full ? inlineStyleBlock() : '') +
      headerMarkup() +
      `<g class="edges">${edges}</g>` +
      `<g class="nodes">${nodes}</g>` +
      `</svg>`
    );
  }

  global.RTM = global.RTM || {};
  global.RTM.diagram = { buildTraceSVG };
})(window);
