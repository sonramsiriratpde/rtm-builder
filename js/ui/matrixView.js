/**
 * matrixView.js
 * Owns the matrix table, the filters row, and the pagination controls —
 * everything under "Preview" except the hero diagram and stats strip.
 * Exposed on the global RTM namespace as RTM.ui.matrix.
 *
 * The filter <select>s and pagination buttons are exposed directly so
 * app.js can attach its own event listeners; this view only renders,
 * it doesn't decide what filtering/paging *means* (that's filterService).
 */
(function (global) {
  'use strict';

  const wrap = document.getElementById('matrixWrap');
  const body = document.getElementById('matrixBody');
  const downloadActions = document.getElementById('downloadActions');
  const filtersEl = document.getElementById('filters');
  const filterCoverage = document.getElementById('filterCoverage');
  const filterDefect = document.getElementById('filterDefect');
  const paginationEl = document.getElementById('pagination');
  const pageSizeEl = document.getElementById('pageSize');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfoEl = document.getElementById('pageInfo');

  function escHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
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

  function renderRows(rows) {
    body.innerHTML = rows
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

    wrap.classList.add('show');
    downloadActions.style.display = 'flex';
  }

  function renderPagination({ page, totalPages, total }) {
    pageInfoEl.textContent =
      total === 0 ? 'No results' : 'Page ' + page + ' of ' + totalPages + ' (' + total + ' results)';
    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= totalPages;
    paginationEl.classList.toggle('show', total > 0);
  }

  function showFilters() {
    filtersEl.classList.add('show');
  }

  function reset() {
    wrap.classList.remove('show');
    body.innerHTML = '';
    downloadActions.style.display = 'none';
    filtersEl.classList.remove('show');
    filterCoverage.value = 'all';
    filterDefect.value = 'all';
    paginationEl.classList.remove('show');
    pageSizeEl.value = '10';
  }

  global.RTM = global.RTM || {};
  global.RTM.ui = global.RTM.ui || {};
  global.RTM.ui.matrix = {
    renderRows,
    renderPagination,
    showFilters,
    reset,
    // controls app.js wires listeners onto directly
    filterCoverage,
    filterDefect,
    pageSizeEl,
    prevPageBtn,
    nextPageBtn
  };
})(window);
