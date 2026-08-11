/**
 * rtm.js
 * Core matrix logic: consolidates a flat requirement/test/defect table
 * into one row per requirement, and serializes the result to Markdown.
 *
 * Pure functions only — no DOM access — so this file can be reused
 * (e.g. in a Node script or test suite) independently of the browser UI.
 *
 * Exposed on the global RTM namespace as RTM.core.*
 */
(function (global) {
  'use strict';

  function naturalCompare(a, b) {
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
   * @param {{headers: string[], rows: string[][]}} table
   * @param {{req: number, test: number, def: number}} colMap
   * @returns {Array<{reqId:string, tests:string[], defects:string[], covered:boolean, hasDefects:boolean}>}
   */
  // function buildRTM(table, colMap) {
  //   const groups = new Map(); // reqId -> { tests:Set, defects:Set }

  //   table.rows.forEach((row) => {
  //     const reqId = (row[colMap.req] || '').toString().trim();
  //     const testId = (row[colMap.test] || '').toString().trim();
  //     const defId = (row[colMap.def] || '').toString().trim();
  //     if (!reqId) return;

  //     if (!groups.has(reqId)) groups.set(reqId, { tests: new Set(), defects: new Set() });
  //     const g = groups.get(reqId);
  //     if (testId) g.tests.add(testId);
  //     if (defId) g.defects.add(defId);
  //   });

  //   const rows = Array.from(groups.entries()).map(([reqId, g]) => ({
  //     reqId,
  //     tests: Array.from(g.tests).sort(naturalCompare),
  //     defects: Array.from(g.defects).sort(naturalCompare),
  //     covered: g.tests.size > 0,
  //     hasDefects: g.defects.size > 0
  //   }));

  //   rows.sort((a, b) => naturalCompare(a.reqId, b.reqId));
  //   return rows;
  // }

  function buildRTM(table, colMap) {
    const groups = new Map(); // reqId -> { tests:Set, defects:Set, defectTests:Map<defId, Set<testId>> }

    table.rows.forEach((row) => {
      const reqId = (row[colMap.req] || '').toString().trim();
      const testId = (row[colMap.test] || '').toString().trim();
      const defId = (row[colMap.def] || '').toString().trim();
      if (!reqId) return;

      if (!groups.has(reqId)) groups.set(reqId, { tests: new Set(), defects: new Set(), defectTests: new Map() });
      const g = groups.get(reqId);
      if (testId) g.tests.add(testId);
      if (defId) {
        g.defects.add(defId);
        if (testId) {
          if (!g.defectTests.has(defId)) g.defectTests.set(defId, new Set());
          g.defectTests.get(defId).add(testId);
        }
      }
    });

    const rows = Array.from(groups.entries()).map(([reqId, g]) => {
      const defectTests = {};
      g.defectTests.forEach((testsSet, defId) => {
        defectTests[defId] = Array.from(testsSet).sort(naturalCompare);
      });
      return {
        reqId,
        tests: Array.from(g.tests).sort(naturalCompare),
        defects: Array.from(g.defects).sort(naturalCompare),
        defectTests,
        covered: g.tests.size > 0,
        hasDefects: g.defects.size > 0
      };
    });

    rows.sort((a, b) => naturalCompare(a.reqId, b.reqId));
    return rows;
  }

  // function rowsToMarkdown(rows) {
  //   const esc = (s) => String(s).replace(/\|/g, '\\|');
  //   const header = '| Requirement | Linked Tests | Linked Defects | Coverage | Defect Status |';
  //   const sep = '| --- | --- | --- | --- | --- |';
  //   const body = rows.map((r) => {
  //     const tests = r.tests.length ? r.tests.map(esc).join(', ') : '—';
  //     const defs = r.defects.length ? r.defects.map(esc).join(', ') : '—';
  //     const cov = r.covered ? 'Covered' : 'Not covered';
  //     const dstat = r.hasDefects ? 'Has defects' : 'Clear';
  //     return '| ' + esc(r.reqId) + ' | ' + tests + ' | ' + defs + ' | ' + cov + ' | ' + dstat + ' |';
  //   });

  //   const total = rows.length;
  //   const covered = rows.filter((r) => r.covered).length;
  //   const withDefects = rows.filter((r) => r.hasDefects).length;

  //   const summary = [
  //     '**Requirement Traceability Matrix**',
  //     '',
  //     '- Requirements: ' + total,
  //     '- Covered: ' + covered + ' / ' + total,
  //     '- With defects: ' + withDefects,
  //     ''
  //   ].join('\n');

  //   return summary + '\n' + [header, sep, ...body].join('\n') + '\n';
  // }

  function rowsToMarkdown(rows) {
    const esc = (s) => String(s).replace(/\|/g, '\\|');
    const header = '| Requirement | Linked Tests | Linked Defects | Coverage | Defect Status |';
    const sep = '| --- | --- | --- | --- | --- |';
    const body = rows.map((r) => {
      const tests = r.tests.length ? r.tests.map(esc).join(', ') : '—';
      const defs = r.defects.length
        ? r.defects
            .map((d) => {
              const linked = r.defectTests && r.defectTests[d] ? r.defectTests[d] : [];
              return linked.length ? esc(d) + ' (' + linked.map(esc).join(', ') + ')' : esc(d);
            })
            .join(', ')
        : '—';
      const cov = r.covered ? 'Covered' : 'Not covered';
      const dstat = r.hasDefects ? 'Has defects' : 'Clear';
      return '| ' + esc(r.reqId) + ' | ' + tests + ' | ' + defs + ' | ' + cov + ' | ' + dstat + ' |';
    });

    const total = rows.length;
    const covered = rows.filter((r) => r.covered).length;
    const withDefects = rows.filter((r) => r.hasDefects).length;

    const summary = [
      '**Requirement Traceability Matrix**',
      '',
      '- Requirements: ' + total,
      '- Covered: ' + covered + ' / ' + total,
      '- With defects: ' + withDefects,
      ''
    ].join('\n');

    return summary + '\n' + [header, sep, ...body].join('\n') + '\n';
  }

  global.RTM = global.RTM || {};
  global.RTM.core = {
    naturalCompare,
    buildRTM,
    rowsToMarkdown
  };
})(window);
