/**
 * app.js
 * Thin orchestrator only: wires DOM events to services and views.
 * No rendering markup and no data-shaping logic lives here —
 *   - js/core/*     pure business logic (parsing, matrix building, diagram SVG)
 *   - js/services/* state, filtering/pagination math, download logic
 *   - js/ui/*       all DOM rendering, one file per screen region
 * If you're changing *what the app does*, start in core/ or services/.
 * If you're changing *how it looks*, start in ui/ or css/styles.css.
 * This file should only ever grow by a few lines when wiring a new event.
 */
(function () {
  'use strict';

  const { detectColumns, parseMarkdownTable, parseCSV, parseXLSX } = window.RTM.parsers;
  const { buildRTM } = window.RTM.core;
  const state = window.RTM.state;
  const filterService = window.RTM.filterService;
  const exportService = window.RTM.exportService;
  const { validation, stats, matrix, diagram } = window.RTM.ui;

  // ---------- DOM elements app.js itself needs to wire up ----------
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileChip = document.getElementById('fileChip');
  const fileNameEl = document.getElementById('fileName');
  const clearFileBtn = document.getElementById('clearFile');
  const generateBtn = document.getElementById('generateBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const downloadDiagramBtn = document.getElementById('downloadDiagramBtn');

  function escHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ---------- column detection / validation ----------
  // Returns the colMap on success, null on failure — and updates the
  // validation banner either way.
  function validateAndPrep(table) {
    if (!table || !table.headers || table.headers.length === 0) {
      validation.showError('Could not find a table in this file. Check the format and try again.');
      return null;
    }
    const map = detectColumns(table.headers);
    const missing = [];
    if (map.req === -1) missing.push('<code>REQ.IDs</code>');
    if (map.test === -1) missing.push('<code>TEST.IDs</code>');
    if (map.def === -1) missing.push('<code>DEF.IDs</code>');

    if (missing.length) {
      validation.showError(
        '<strong>Missing required column' + (missing.length > 1 ? 's' : '') + ':</strong> ' +
        missing.join(', ') +
        '.<br>Found columns: ' +
        table.headers.map((h) => '<code>' + escHtml(h) + '</code>').join(', ')
      );
      return null;
    }

    validation.showOk(
      '<strong>Columns detected —</strong> Requirement: <code>' + escHtml(table.headers[map.req]) +
      '</code>, Test: <code>' + escHtml(table.headers[map.test]) +
      '</code>, Defect: <code>' + escHtml(table.headers[map.def]) + '</code>'
    );
    return map;
  }

  // ---------- filters + pagination ----------
  function applyFilters() {
    const { rtmRows } = state.get();
    if (!rtmRows) return;
    const filteredRows = filterService.applyFilters(rtmRows, {
      coverage: matrix.filterCoverage.value,
      defect: matrix.filterDefect.value
    });
    state.set({ filteredRows, currentPage: 1 });
    renderPage();
  }

  function renderPage() {
    const { filteredRows, currentPage, pageSize } = state.get();
    const result = filterService.paginate(filteredRows, currentPage, pageSize);
    state.set({ currentPage: result.page });
    matrix.renderRows(result.pageRows);
    matrix.renderPagination(result);
  }

  // ---------- file handling ----------
  function handleFile(file) {
    fileNameEl.textContent = file.name;
    fileChip.classList.add('show');
    validation.hide();
    generateBtn.disabled = true;
    resetPreview();

    const ext = file.name.split('.').pop().toLowerCase();
    const onParsed = (table) => {
      const map = validateAndPrep(table);
      state.set({ parsedTable: table, colMap: map });
      generateBtn.disabled = !map;
    };

    if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => onParsed(parseCSV(e.target.result));
      reader.onerror = () => validation.showError('Could not read the file.');
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          onParsed(parseXLSX(e.target.result));
        } catch (err) {
          validation.showError('Could not parse this spreadsheet file.');
        }
      };
      reader.onerror = () => validation.showError('Could not read the file.');
      reader.readAsArrayBuffer(file);
    } else if (ext === 'md' || ext === 'markdown') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const table = parseMarkdownTable(e.target.result);
        if (!table) {
          validation.showError('No markdown table found in this file.');
          return;
        }
        onParsed(table);
      };
      reader.onerror = () => validation.showError('Could not read the file.');
      reader.readAsText(file);
    } else {
      validation.showError('Unsupported file type. Use .csv, .xlsx, .xls, or .md.');
    }
  }

  function resetPreview() {
    stats.clear();
    matrix.reset();
    diagram.reset();
    state.reset();
  }

  function clearFile() {
    fileInput.value = '';
    fileChip.classList.remove('show');
    validation.hide();
    generateBtn.disabled = true;
    resetPreview();
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
    clearFile();
  });

  generateBtn.addEventListener('click', () => {
    const { parsedTable, colMap } = state.get();
    if (!parsedTable || !colMap) return;
    const rtmRows = buildRTM(parsedTable, colMap);
    state.set({ rtmRows });
    diagram.render(parsedTable, colMap);
    stats.render(rtmRows);
    matrix.showFilters();
    applyFilters();
    document.getElementById('step-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  downloadBtn.addEventListener('click', () => {
    exportService.downloadMarkdown(state.get().rtmRows);
  });

  resetBtn.addEventListener('click', () => {
    clearFile();
    document.getElementById('step-upload').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  matrix.filterCoverage.addEventListener('change', applyFilters);
  matrix.filterDefect.addEventListener('change', applyFilters);

  matrix.pageSizeEl.addEventListener('change', () => {
    state.set({ pageSize: parseInt(matrix.pageSizeEl.value, 10) || 10, currentPage: 1 });
    renderPage();
  });

  matrix.prevPageBtn.addEventListener('click', () => {
    const { currentPage } = state.get();
    if (currentPage > 1) {
      state.set({ currentPage: currentPage - 1 });
      renderPage();
    }
  });

  matrix.nextPageBtn.addEventListener('click', () => {
    state.set({ currentPage: state.get().currentPage + 1 });
    renderPage();
  });

  downloadDiagramBtn.addEventListener('click', () => {
    const { parsedTable, colMap } = state.get();
    exportService.downloadDiagramPNG(parsedTable, colMap, () =>
      validation.showError('Could not render the diagram as an image.')
    );
  });
})();
