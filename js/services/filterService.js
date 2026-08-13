/**
 * filterService.js
 * Pure filter + pagination math over RTM rows. No DOM access — testable
 * on its own, and reusable if the filter UI ever changes shape.
 *
 * Exposed on the global RTM namespace as RTM.filterService.
 */
(function (global) {
  'use strict';

  /**
   * @param {Array} rtmRows
   * @param {{coverage:string, defect:string}} filters values: 'all' | specific option
   */
  function applyFilters(rtmRows, filters) {
    if (!rtmRows) return [];
    const covVal = filters.coverage;
    const defVal = filters.defect;
    return rtmRows.filter((r) => {
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
  }

  /**
   * @param {Array} rows already-filtered rows
   * @param {number} page 1-indexed, clamped to valid range
   * @param {number} pageSize
   * @returns {{pageRows:Array, page:number, totalPages:number, total:number}}
   */
  function paginate(rows, page, pageSize) {
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      pageRows: rows.slice(start, start + pageSize),
      page: safePage,
      totalPages,
      total
    };
  }

  global.RTM = global.RTM || {};
  global.RTM.filterService = { applyFilters, paginate };
})(window);
