/**
 * exportService.js
 * Owns the Blob / canvas / anchor-click boilerplate for both downloads
 * (Markdown RTM and PNG diagram). Depends on RTM.core and RTM.diagram
 * for the actual content, not on any UI module.
 *
 * Exposed on the global RTM namespace as RTM.exportService.
 */
(function (global) {
  'use strict';

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadMarkdown(rtmRows) {
    if (!rtmRows) return;
    const md = global.RTM.core.rowsToMarkdown(rtmRows);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'Requirement_Traceability_Matrix.md');
    URL.revokeObjectURL(url);
  }

  /**
   * @param {object} table parsed table
   * @param {object} colMap column map
   * @param {Function} [onError] called if rendering the PNG fails
   */
  function downloadDiagramPNG(table, colMap, onError) {
    if (!table || !colMap) return;
    const svgMarkup = global.RTM.diagram.buildTraceSVG(table, colMap, { full: true });
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
        triggerDownload(pngUrl, 'Requirement_Traceability_Diagram.png');
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (onError) onError();
    };
    img.src = url;
  }

  global.RTM = global.RTM || {};
  global.RTM.exportService = { downloadMarkdown, downloadDiagramPNG };
})(window);
