/**
 * app.js
 * DOM wiring and rendering only. All parsing lives in parsers.js,
 * all matrix logic lives in rtm.js — this file just connects them
 * to the page.
 */
(function () {
  'use strict';

  const { normalizeHeader, detectColumns, parseMarkdownTable, parseCSV, parseXLSX } = window.RTM.parsers;
  const { buildRTM, rowsToMarkdown } = window.RTM.core;
  const { buildTraceSVG } = window.RTM.diagram;

  // ---------- DOM ----------
  const heroTrace = document.getElementById('heroTrace');
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileChip = document.getElementById('fileChip');
  const fileNameEl = document.getElementById('fileName');
  const clearFileBtn = document.getElementById('clearFile');
  const validationEl = document.getElementById('validation');
  const generateBtn = document.getElementById('generateBtn');
  const statsEl = document.getElementById('stats');
  const matrixWrap = document.getElementById('matrixWrap');
  const matrixBody = document.getElementById('matrixBody');
  const downloadActions = document.getElementById('downloadActions');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const downloadDiagramBtn = document.getElementById('downloadDiagramBtn');
  const diagramActions = document.getElementById('diagramActions');
  const filtersEl = document.getElementById('filters');
  // const filterCoverage = document.getElementById('filterCoverage');
  // const filterDefect = document.getElementById('filterDefect');

  // let parsedTable = null; // { headers: [...], rows: [[...]] }
  // let colMap = null; // { req: idx, test: idx, def: idx }
  // let rtmRows = null; // computed matrix rows, for markdown export

  const filterCoverage = document.getElementById('filterCoverage');
  const filterDefect = document.getElementById('filterDefect');
  const paginationEl = document.getElementById('pagination');
  const pageSizeEl = document.getElementById('pageSize');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfoEl = document.getElementById('pageInfo');

  let parsedTable = null; // { headers: [...], rows: [[...]] }
  let colMap = null; // { req: idx, test: idx, def: idx }
  let rtmRows = null; // computed matrix rows, for markdown export
  let filteredRows = []; // rtmRows after coverage/defect filters, for pagination
  let currentPage = 1;
  let pageSize = 10;

  // ---------- helpers ----------
  function escHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ---------- validation ----------
  function showValidation(kind, html) {
    validationEl.className = 'validation show ' + kind;
    validationEl.innerHTML = html;
  }

  function hideValidation() {
    validationEl.className = 'validation';
    validationEl.innerHTML = '';
  }

  function validateAndPrep(table) {
    if (!table || !table.headers || table.headers.length === 0) {
      showValidation('err', 'Could not find a table in this file. Check the format and try again.');
      return false;
    }
    const map = detectColumns(table.headers);
    const missing = [];
    if (map.req === -1) missing.push('<code>REQ.IDs</code>');
    if (map.test === -1) missing.push('<code>TEST.IDs</code>');
    if (map.def === -1) missing.push('<code>DEF.IDs</code>');

    if (missing.length) {
      showValidation(
        'err',
        '<strong>Missing required column' + (missing.length > 1 ? 's' : '') + ':</strong> ' +
        missing.join(', ') +
        '.<br>Found columns: ' +
        table.headers.map((h) => '<code>' + escHtml(h) + '</code>').join(', ')
      );
      colMap = null;
      return false;
    }

    showValidation(
      'ok',
      '<strong>Columns detected —</strong> Requirement: <code>' + escHtml(table.headers[map.req]) +
      '</code>, Test: <code>' + escHtml(table.headers[map.test]) +
      '</code>, Defect: <code>' + escHtml(table.headers[map.def]) + '</code>'
    );
    colMap = map;
    return true;
  }

  // ---------- rendering ----------
  function renderStats(rows) {
    const total = rows.length;
    const covered = rows.filter((r) => r.covered).length;
    const notCovered = total - covered;
    const withDefects = rows.filter((r) => r.hasDefects).length;

    statsEl.innerHTML = [
      { n: total, l: 'Requirements' },
      { n: covered, l: 'Covered' },
      { n: notCovered, l: 'Not covered' },
      { n: withDefects, l: 'With defects' }
    ]
      .map((s) => '<div class="stat"><div class="n">' + s.n + '</div><div class="l">' + s.l + '</div></div>')
      .join('');
    statsEl.classList.add('show');
  }

  function formatDefects(r) {
    if (!r.defects.length) return null;
    return r.defects
      .map((d) => {
        const linked = r.defectTests && r.defectTests[d] ? r.defectTests[d] : [];
        return linked.length
          ? escHtml(d) + ' <span class="linked-test">(' + linked.map(escHtml).join(', ') + ')</span>'
          : escHtml(d);
      })
      .join(', ');
  }

  // function renderMatrix(rows) {
  //   matrixBody.innerHTML = rows
  //     .map((r) => {
  //       const testsHtml = r.tests.length
  //         ? '<span class="id-list">' + r.tests.map(escHtml).join(', ') + '</span>'
  //         : '<span class="id-list empty">—</span>';
  //       const defsHtml = r.defects.length
  //         ? '<span class="id-list">' + r.defects.map(escHtml).join(', ') + '</span>'
  //         : '<span class="id-list empty">—</span>';
  //       const covBadge = r.covered
  //         ? '<span class="badge covered">Covered</span>'
  //         : '<span class="badge not-covered">Not covered</span>';
  //       const defBadge = r.hasDefects
  //         ? '<span class="badge hasdefect">Has defects</span>'
  //         : '<span class="badge clear">Clear</span>';

  //       return (
  //         '<tr>' +
  //         '<td class="req-id">' + escHtml(r.reqId) + '</td>' +
  //         '<td>' + testsHtml + '</td>' +
  //         '<td>' + defsHtml + '</td>' +
  //         '<td>' + covBadge + '</td>' +
  //         '<td>' + defBadge + '</td>' +
  //         '</tr>'
  //       );
  //     })
  //     .join('');

  //   matrixWrap.classList.add('show');
  //   downloadActions.style.display = 'flex';
  // }

  // function renderDiagram(table, map) {
  //   heroTrace.innerHTML = buildTraceSVG(table, map);
  //   heroTrace.classList.add('show');
  // }

  function renderMatrix(rows) {
    matrixBody.innerHTML = rows
      .map((r) => {
        const testsHtml = r.tests.length
          ? '<span class="id-list">' + r.tests.map(escHtml).join(', ') + '</span>'
          : '<span class="id-list empty">—</span>';
        const defsHtml = r.defects.length
          ? '<span class="id-list">' + formatDefects(r) + '</span>'
          : '<span class="id-list empty">—</span>';
        const covBadge = r.covered
          ? '<span class="badge covered">Covered</span>'
          : '<span class="badge not-covered">Not covered</span>';
        const defBadge = r.hasDefects
          ? '<span class="badge hasdefect">Has defects</span>'
          : '<span class="badge clear">Clear</span>';

        return (
          '<tr>' +
          '<td class="req-id">' + escHtml(r.reqId) + '</td>' +
          '<td>' + testsHtml + '</td>' +
          '<td>' + defsHtml + '</td>' +
          '<td>' + covBadge + '</td>' +
          '<td>' + defBadge + '</td>' +
          '</tr>'
        );
      })
      .join('');

    matrixWrap.classList.add('show');
    downloadActions.style.display = 'flex';
  }

  function renderDiagram(table, map) {
    heroTrace.innerHTML = buildTraceSVG(table, map);
    heroTrace.classList.add('show');
    diagramActions.style.display = 'flex';
  }

  // function resetPreview() {
  //   statsEl.classList.remove('show');
  //   statsEl.innerHTML = '';
  //   matrixWrap.classList.remove('show');
  //   matrixBody.innerHTML = '';
  //   downloadActions.style.display = 'none';
  //   heroTrace.classList.remove('show');
  //   heroTrace.innerHTML = '';
  //   rtmRows = null;
  // }

  function resetPreview() {
    statsEl.classList.remove('show');
    statsEl.innerHTML = '';
    matrixWrap.classList.remove('show');
    matrixBody.innerHTML = '';
    downloadActions.style.display = 'none';
    heroTrace.classList.remove('show');
    heroTrace.innerHTML = '';
    diagramActions.style.display = 'none';
    filtersEl.classList.remove('show');
    filterCoverage.value = 'all';
    filterDefect.value = 'all';
    rtmRows = null;
  }

  // ---------- Filters ----------
  function applyFilters() {
    if (!rtmRows) return;
    const covVal = filterCoverage.value;
    const defVal = filterDefect.value;
    filteredRows = rtmRows.filter((r) => {
      const covOk =
        covVal === 'all' ||
        (covVal === 'covered' && r.covered) ||
        (covVal === 'not-covered' && !r.covered);
      const defOk =
        defVal === 'all' ||
        (defVal === 'hasdefect' && r.hasDefects) ||
        (defVal === 'clear' && !r.hasDefects);
      return covOk && defOk;
    });
    currentPage = 1;
    renderPaginated();
  }

  // ---------- file handling ----------
  function handleFile(file) {
    fileNameEl.textContent = file.name;
    fileChip.classList.add('show');
    hideValidation();
    generateBtn.disabled = true;
    parsedTable = null;
    colMap = null;
    resetPreview();

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const table = parseCSV(e.target.result);
        parsedTable = table;
        generateBtn.disabled = !validateAndPrep(table);
      };
      reader.onerror = () => showValidation('err', 'Could not read the file.');
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const table = parseXLSX(e.target.result);
          parsedTable = table;
          generateBtn.disabled = !validateAndPrep(table);
        } catch (err) {
          showValidation('err', 'Could not parse this spreadsheet file.');
        }
      };
      reader.onerror = () => showValidation('err', 'Could not read the file.');
      reader.readAsArrayBuffer(file);
    } else if (ext === 'md' || ext === 'markdown') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const table = parseMarkdownTable(e.target.result);
        if (!table) {
          showValidation('err', 'No markdown table found in this file.');
          return;
        }
        parsedTable = table;
        generateBtn.disabled = !validateAndPrep(table);
      };
      reader.onerror = () => showValidation('err', 'Could not read the file.');
      reader.readAsText(file);
    } else {
      showValidation('err', 'Unsupported file type. Use .csv, .xlsx, .xls, or .md.');
    }
  }

  // ---------- Show percentage next to each stat ----------

  function pct(n, total) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
  }

  function renderStats(rows) {
    const total = rows.length;
    const covered = rows.filter((r) => r.covered).length;
    const notCovered = total - covered;
    const withDefects = rows.filter((r) => r.hasDefects).length;

    statsEl.innerHTML = [
      { n: total, l: 'Requirements', p: null },
      { n: covered, l: 'Covered', p: pct(covered, total) },
      { n: notCovered, l: 'Not covered', p: pct(notCovered, total) },
      { n: withDefects, l: 'With defects', p: pct(withDefects, total) }
    ]
      .map(
        (s) =>
          '<div class="stat"><div class="n">' +
          s.n +
          (s.p !== null ? ' <span class="pct">(' + s.p + '%)</span>' : '') +
          '</div><div class="l">' +
          s.l +
          '</div></div>'
      )
      .join('');
    statsEl.classList.add('show');
  }

  function renderPaginated() {
    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageRows = filteredRows.slice(start, start + pageSize);

    renderMatrix(pageRows);

    pageInfoEl.textContent =
      total === 0 ? 'No results' : 'Page ' + currentPage + ' of ' + totalPages + ' (' + total + ' results)';
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    paginationEl.classList.toggle('show', total > 0);
  }

  function resetPreview() {
    statsEl.classList.remove('show');
    statsEl.innerHTML = '';
    matrixWrap.classList.remove('show');
    matrixBody.innerHTML = '';
    downloadActions.style.display = 'none';
    heroTrace.classList.remove('show');
    heroTrace.innerHTML = '';
    diagramActions.style.display = 'none';
    filtersEl.classList.remove('show');
    filterCoverage.value = 'all';
    filterDefect.value = 'all';
    paginationEl.classList.remove('show');
    pageSizeEl.value = '10';
    pageSize = 10;
    currentPage = 1;
    filteredRows = [];
    rtmRows = null;
  }

  // ---------- events ----------
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  ['dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      handleFile(e.dataTransfer.files[0]);
    }
  });

  clearFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.value = '';
    fileChip.classList.remove('show');
    hideValidation();
    generateBtn.disabled = true;
    parsedTable = null;
    colMap = null;
    resetPreview();
  });

  // generateBtn.addEventListener('click', () => {
  //   if (!parsedTable || !colMap) return;
  //   rtmRows = buildRTM(parsedTable, colMap);
  //   renderDiagram(parsedTable, colMap);
  //   renderStats(rtmRows);
  //   renderMatrix(rtmRows);
  //   document.getElementById('step-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  // });

  generateBtn.addEventListener('click', () => {
    if (!parsedTable || !colMap) return;
    rtmRows = buildRTM(parsedTable, colMap);
    renderDiagram(parsedTable, colMap);
    renderStats(rtmRows);
    filtersEl.classList.add('show');
    applyFilters();
    document.getElementById('step-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  downloadBtn.addEventListener('click', () => {
    if (!rtmRows) return;
    const md = rowsToMarkdown(rtmRows);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Requirement_Traceability_Matrix.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileChip.classList.remove('show');
    hideValidation();
    generateBtn.disabled = true;
    parsedTable = null;
    colMap = null;
    resetPreview();
    document.getElementById('step-upload').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  filterCoverage.addEventListener('change', applyFilters);
  filterDefect.addEventListener('change', applyFilters);

  pageSizeEl.addEventListener('change', () => {
    pageSize = parseInt(pageSizeEl.value, 10) || 10;
    currentPage = 1;
    renderPaginated();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPaginated();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    renderPaginated();
  });

  downloadDiagramBtn.addEventListener('click', () => {
    if (!parsedTable || !colMap) return;
    const svgMarkup = buildTraceSVG(parsedTable, colMap, { full: true });
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FAFAF7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'Requirement_Traceability_Diagram.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showValidation('err', 'Could not render the diagram as an image.');
    };
    img.src = url;
  });
})();
