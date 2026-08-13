/**
 * state.js
 * Single source of truth for app data (parsed file, column map, computed
 * matrix, current filter/pagination). Every other module reads and writes
 * through this API instead of holding its own copy or reaching into
 * app.js's closures — that's what keeps ui/* and services/* decoupled
 * from each other.
 *
 * Exposed on the global RTM namespace as RTM.state.
 */
(function (global) {
  'use strict';

  function initial() {
    return {
      parsedTable: null, // { headers, rows }
      colMap: null,      // { req, test, def }
      rtmRows: null,      // output of RTM.core.buildRTM
      filteredRows: [],   // rtmRows after coverage/defect filters
      currentPage: 1,
      pageSize: 10
    };
  }

  let data = initial();

  function get() {
    return data;
  }

  function set(patch) {
    data = Object.assign({}, data, patch);
    return data;
  }

  function reset() {
    data = initial();
    return data;
  }

  global.RTM = global.RTM || {};
  global.RTM.state = { get, set, reset };
})(window);
