/**
 * validationView.js
 * Owns the #validation banner and nothing else.
 * Exposed on the global RTM namespace as RTM.ui.validation.
 */
(function (global) {
  'use strict';

  const el = document.getElementById('validation');

  function showError(html) {
    el.className = 'validation show err';
    el.innerHTML = html;
  }

  function showOk(html) {
    el.className = 'validation show ok';
    el.innerHTML = html;
  }

  function hide() {
    el.className = 'validation';
    el.innerHTML = '';
  }

  global.RTM = global.RTM || {};
  global.RTM.ui = global.RTM.ui || {};
  global.RTM.ui.validation = { showError, showOk, hide };
})(window);
