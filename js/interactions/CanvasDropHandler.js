/**
 * WOW3 Canvas Drop Handler
 * Handles drag-and-drop of media files from the file system onto the canvas
 */

export class CanvasDropHandler {
  /**
   * Create canvas drop handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this._canvas = null;
  }

  /**
   * Initialize drop handler (attach dragover/dragleave/drop on canvas)
   */
  init() {
    this._canvas = document.getElementById('slide-canvas');
    if (!this._canvas) return;

    this._canvas.addEventListener('dragover', (e) => this._onDragOver(e));
    this._canvas.addEventListener('dragleave', (e) => this._onDragLeave(e));
    this._canvas.addEventListener('drop', (e) => this._onDrop(e));
  }

  /**
   * Check whether a drag event contains external files (not internal element drags)
   * @param {DragEvent} e
   * @returns {boolean}
   */
  _hasFiles(e) {
    if (!e.dataTransfer) return false;
    return Array.from(e.dataTransfer.types).includes('Files');
  }

  /**
   * Handle dragover — allow drop and show visual feedback
   * @param {DragEvent} e
   */
  _onDragOver(e) {
    if (!this._hasFiles(e)) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this._canvas.classList.add('canvas-drop-active');
  }

  /**
   * Handle dragleave — remove visual feedback (only when actually leaving canvas)
   * @param {DragEvent} e
   */
  _onDragLeave(e) {
    // Only react when the pointer actually leaves the canvas element
    if (e.relatedTarget && this._canvas.contains(e.relatedTarget)) return;

    this._canvas.classList.remove('canvas-drop-active');
  }

  /**
   * Handle drop — upload files and create media elements
   * @param {DragEvent} e
   */
  _onDrop(e) {
    e.preventDefault();
    this._canvas.classList.remove('canvas-drop-active');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const canvasRect = this._canvas.getBoundingClientRect();

    for (const file of files) {
      const type = this._getMediaType(file);
      if (!type) continue;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;

      this.elementController.createMediaElement(type, file, { x, y });
    }
  }

  /**
   * Determine element type from file MIME type
   * @param {File} file
   * @returns {string|null} 'image', 'video', 'audio', or null if unsupported
   */
  _getMediaType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return null;
  }
}
