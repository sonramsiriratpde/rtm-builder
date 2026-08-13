/**
 * statsView.js
 * Owns the #stats strip and nothing else.
 * Exposed on the global RTM namespace as RTM.ui.stats.
 */
(function (global) {
  'use strict';

  const el = document.getElementById('stats');

  function pct(n, total) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
  }

  function render(rows) {
    const total = rows.length;
    const covered = rows.filter((r) => r.covered).length;
    const notCovered = total - covered;
    const withDefects = rows.filter((r) => r.hasDefects).length;

    el.innerHTML = [
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
    el.classList.add('show');
  }

  function clear() {
    el.classList.remove('show');
    el.innerHTML = '';
  }

  global.RTM = global.RTM || {};
  global.RTM.ui = global.RTM.ui || {};
  global.RTM.ui.stats = { render, clear };
})(window);
