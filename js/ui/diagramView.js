/**
 * diagramView.js
 * Owns the hero trace diagram and its "download full diagram" actions row.
 * Exposed on the global RTM namespace as RTM.ui.diagram.
 */
(function (global) {
  'use strict';

  const heroTrace = document.getElementById('heroTrace');
  const diagramActions = document.getElementById('diagramActions');

  function render(table, colMap) {
    heroTrace.innerHTML = global.RTM.diagram.buildTraceSVG(table, colMap);
    heroTrace.classList.add('show');
    diagramActions.style.display = 'flex';
  }

  function reset() {
    heroTrace.classList.remove('show');
    heroTrace.innerHTML = '';
    diagramActions.style.display = 'none';
  }

  global.RTM = global.RTM || {};
  global.RTM.ui = global.RTM.ui || {};
  global.RTM.ui.diagram = { render, reset };
})(window);
