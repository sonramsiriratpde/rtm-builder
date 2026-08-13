/**
 * parsers.js
 * Turns an uploaded file (CSV / XLSX / Markdown) into a plain
 * { headers: string[], rows: string[][] } shape, and figures out
 * which columns hold Requirement / Test / Defect IDs.
 *
 * No DOM access here — this module is pure I/O + data shaping,
 * which keeps it easy to unit test or reuse outside the browser UI.
 *
 * Exposed on the global RTM namespace as RTM.parsers.*
 */
(function (global) {
  'use strict';

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function detectColumns(headers) {
    const norm = headers.map(normalizeHeader);
    const find = (mustInclude) =>
      norm.findIndex((h) => mustInclude.every((token) => h.includes(token)));

    const reqIdx = find(['req', 'id']);
    const testIdx = find(['test', 'id']);
    // accept "def" or "defect"
    let defIdx = find(['defect', 'id']);
    if (defIdx === -1) defIdx = find(['def', 'id']);

    return { req: reqIdx, test: testIdx, def: defIdx };
  }

  function parseMarkdownTable(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
    if (lines.length < 2) return null;

    const splitRow = (line) => {
      let cells = line.trim();
      if (cells.startsWith('|')) cells = cells.slice(1);
      if (cells.endsWith('|')) cells = cells.slice(0, -1);
      return cells.split('|').map((c) => c.trim());
    };

    const isSeparator = (line) => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');

    const headerLine = lines[0];
    const headers = splitRow(headerLine);

    const bodyLines = lines.slice(1).filter((l) => !isSeparator(l));
    const rows = bodyLines.map(splitRow);

    return { headers, rows };
  }

  function parseCSV(text) {
    // Papa is loaded globally via the PapaParse CDN <script> tag in index.html
    const result = Papa.parse(text.trim(), { skipEmptyLines: true });
    const data = result.data;
    if (!data || data.length < 1) return null;
    const headers = data[0];
    const rows = data.slice(1);
    return { headers, rows };
  }

  function parseXLSX(arrayBuffer) {
    // XLSX is loaded globally via the SheetJS CDN <script> tag in index.html
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    if (!data || data.length < 1) return null;
    const headers = data[0].map((h) => (h === undefined || h === null ? '' : String(h)));
    const rows = data
      .slice(1)
      .map((r) => headers.map((_, i) => (r[i] === undefined || r[i] === null ? '' : String(r[i]))));
    return { headers, rows };
  }

  global.RTM = global.RTM || {};
  global.RTM.parsers = {
    normalizeHeader,
    detectColumns,
    parseMarkdownTable,
    parseCSV,
    parseXLSX
  };
})(window);
