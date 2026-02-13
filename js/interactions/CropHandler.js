/**
 * WOW3 Crop Handler
 * Handles crop mode interactions: side crop handles, content panning, and content corner scaling
 */

const MIN_WRAPPER = 50;

export class CropHandler {
  /**
   * Create crop handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this.isCropMode = false;

    /** @type {Element|null} Current element in crop mode */
    this._element = null;
    /** @type {HTMLElement|null} Current element DOM */
    this._elementDOM = null;

    // Bound listeners for cleanup
    this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Check if an element supports cropping
   * @param {Element} element - Element model
   * @returns {boolean}
   */
  canCrop(element) {
    if (element.type === 'image') return true;
    if (element.type === 'video') {
      // YouTube videos use iframes and cannot be cropped
      const url = element.properties.url || '';
      const isYouTube = /youtu\.be|youtube\.com/.test(url) ||
        (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url));
      return !isYouTube;
    }
    return false;
  }

  /**
   * Enter crop mode for the given element
   * @param {Element} element - Element model
   * @param {HTMLElement} elementDOM - Element DOM node
   */
  enterCropMode(element, elementDOM) {
    if (this.isCropMode) this.exitCropMode();

    this.isCropMode = true;
    this._element = element;
    this._elementDOM = elementDOM;

    // Initialize crop state if null
    if (!element.properties.crop) {
      element.properties.crop = {
        contentWidth: element.position.width,
        contentHeight: element.position.height,
        contentLeft: 0,
        contentTop: 0
      };
    }

    // Apply crop visual state
    elementDOM.classList.add('crop-mode');
    elementDOM.classList.remove('selected');

    // Ensure a crop-clipper container exists (handles overflow hidden without clipping handles)
    this._ensureClipper(elementDOM);
    this._applyContentStyles();

    // Add crop handles (4 side + 4 corner)
    this._addCropHandles(elementDOM);

    // Listen for click-outside and Escape
    setTimeout(() => {
      document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
      document.addEventListener('keydown', this._onKeyDown);
    }, 0);
  }

  /**
   * Exit crop mode and return to transform mode
   */
  exitCropMode() {
    if (!this.isCropMode) return;

    const elementDOM = this._elementDOM;
    const element = this._element;

    // Remove crop handles
    if (elementDOM) {
      this._removeCropHandles(elementDOM);
      elementDOM.classList.remove('crop-mode');
    }

    // Clean up listeners
    document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.removeEventListener('keydown', this._onKeyDown);

    // Re-render the element to apply final crop state cleanly
    if (element && elementDOM) {
      this._reRenderElement(element, elementDOM);
    }

    this.isCropMode = false;
    this._element = null;
    this._elementDOM = null;
  }

  /**
   * Ensure a .crop-clipper wrapper exists around the media element.
   * If the element was rendered without crop (no clipper), wrap the media now.
   * @param {HTMLElement} elementDOM
   * @private
   */
  _ensureClipper(elementDOM) {
    let clipper = elementDOM.querySelector('.crop-clipper');
    if (clipper) return;

    const media = elementDOM.querySelector('img, video');
    if (!media) return;

    clipper = document.createElement('div');
    clipper.className = 'crop-clipper';
    clipper.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      overflow: hidden;
      pointer-events: none;
    `;

    // Move media into clipper
    media.parentNode.insertBefore(clipper, media);
    clipper.appendChild(media);
  }

  /**
   * Apply content positioning styles to the media element inside the wrapper
   * @private
   */
  _applyContentStyles() {
    if (!this._elementDOM || !this._element) return;

    const crop = this._element.properties.crop;
    if (!crop) return;

    const media = this._elementDOM.querySelector('img, video');
    if (!media) return;

    media.style.position = 'absolute';
    media.style.left = `${crop.contentLeft}px`;
    media.style.top = `${crop.contentTop}px`;
    media.style.width = `${crop.contentWidth}px`;
    media.style.height = `${crop.contentHeight}px`;
    media.style.objectFit = 'fill';
    media.style.pointerEvents = 'auto';
    media.style.cursor = 'grab';
  }

  /**
   * Add crop side handles and corner handles to the element DOM
   * @param {HTMLElement} elementDOM
   * @private
   */
  _addCropHandles(elementDOM) {
    // Side handles for cropping
    const sides = ['t', 'r', 'b', 'l'];
    sides.forEach(side => {
      const handle = document.createElement('div');
      handle.className = `crop-handle ${side}`;
      handle.dataset.cropSide = side;
      elementDOM.appendChild(handle);
      handle.addEventListener('mousedown', (e) => this._startCropSide(e, side));
    });

    // Corner handles for content scaling
    const corners = ['nw', 'ne', 'sw', 'se'];
    corners.forEach(corner => {
      const handle = document.createElement('div');
      handle.className = `crop-corner ${corner}`;
      handle.dataset.cropCorner = corner;
      elementDOM.appendChild(handle);
      handle.addEventListener('mousedown', (e) => this._startContentScale(e, corner));
    });

    // Attach content panning on the media element
    const media = elementDOM.querySelector('img, video');
    if (media) {
      media._cropPanHandler = (e) => this._startPan(e);
      media.addEventListener('mousedown', media._cropPanHandler);
    }
  }

  /**
   * Remove crop handles from element DOM
   * @param {HTMLElement} elementDOM
   * @private
   */
  _removeCropHandles(elementDOM) {
    elementDOM.querySelectorAll('.crop-handle, .crop-corner').forEach(h => h.remove());

    // Remove pan listener
    const media = elementDOM.querySelector('img, video');
    if (media && media._cropPanHandler) {
      media.removeEventListener('mousedown', media._cropPanHandler);
      delete media._cropPanHandler;
      media.style.cursor = '';
      media.style.pointerEvents = '';
    }
  }

  /**
   * Start crop from a side handle
   * @param {MouseEvent} e
   * @param {string} side - 't', 'r', 'b', 'l'
   * @private
   */
  _startCropSide(e, side) {
    e.preventDefault();
    e.stopPropagation();

    const element = this._element;
    const elementDOM = this._elementDOM;
    if (!element || !elementDOM) return;

    const crop = element.properties.crop;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.position.width;
    const startHeight = element.position.height;
    const startElX = element.position.x;
    const startElY = element.position.y;
    const startContentLeft = crop.contentLeft;
    const startContentTop = crop.contentTop;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startElX;
      let newY = startElY;
      let newContentLeft = startContentLeft;
      let newContentTop = startContentTop;

      switch (side) {
        case 'r':
          newWidth = startWidth + dx;
          break;
        case 'l':
          newWidth = startWidth - dx;
          newX = startElX + dx;
          newContentLeft = startContentLeft + dx;
          break;
        case 'b':
          newHeight = startHeight + dy;
          break;
        case 't':
          newHeight = startHeight - dy;
          newY = startElY + dy;
          newContentTop = startContentTop + dy;
          break;
      }

      // Minimum wrapper size
      newWidth = Math.max(MIN_WRAPPER, newWidth);
      newHeight = Math.max(MIN_WRAPPER, newHeight);

      // Wrapper cannot exceed content dimensions
      newWidth = Math.min(newWidth, crop.contentWidth);
      newHeight = Math.min(newHeight, crop.contentHeight);

      // Recalculate position if clamped on left/top
      if (side === 'l') {
        newX = startElX + (startWidth - newWidth);
        newContentLeft = startContentLeft + (startWidth - newWidth);
      }
      if (side === 't') {
        newY = startElY + (startHeight - newHeight);
        newContentTop = startContentTop + (startHeight - newHeight);
      }

      // Clamp content position
      const minLeft = Math.min(0, newWidth - crop.contentWidth);
      const minTop = Math.min(0, newHeight - crop.contentHeight);
      newContentLeft = Math.max(minLeft, Math.min(0, newContentLeft));
      newContentTop = Math.max(minTop, Math.min(0, newContentTop));

      // Apply wrapper size and position
      element.updatePosition({ x: newX, y: newY, width: newWidth, height: newHeight });
      elementDOM.style.left = `${newX}px`;
      elementDOM.style.top = `${newY}px`;
      elementDOM.style.width = `${newWidth}px`;
      elementDOM.style.height = `${newHeight}px`;

      // Update crop content offsets
      crop.contentLeft = newContentLeft;
      crop.contentTop = newContentTop;

      this._applyContentStyles();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.elementController.editor.recordHistory();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Start content panning (drag the image inside the crop frame)
   * @param {MouseEvent} e
   * @private
   */
  _startPan(e) {
    e.preventDefault();
    e.stopPropagation();

    const element = this._element;
    if (!element) return;

    const crop = element.properties.crop;
    const startX = e.clientX;
    const startY = e.clientY;
    const startContentLeft = crop.contentLeft;
    const startContentTop = crop.contentTop;
    const wrapperWidth = element.position.width;
    const wrapperHeight = element.position.height;

    const media = this._elementDOM?.querySelector('img, video');
    if (media) media.style.cursor = 'grabbing';

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = startContentLeft + dx;
      let newTop = startContentTop + dy;

      // Clamp: content must always cover the wrapper
      const minLeft = Math.min(0, wrapperWidth - crop.contentWidth);
      const minTop = Math.min(0, wrapperHeight - crop.contentHeight);
      newLeft = Math.max(minLeft, Math.min(0, newLeft));
      newTop = Math.max(minTop, Math.min(0, newTop));

      crop.contentLeft = newLeft;
      crop.contentTop = newTop;

      this._applyContentStyles();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (media) media.style.cursor = 'grab';
      this.elementController.editor.recordHistory();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Start content scaling from a corner handle
   * @param {MouseEvent} e
   * @param {string} corner - 'nw', 'ne', 'sw', 'se'
   * @private
   */
  _startContentScale(e, corner) {
    e.preventDefault();
    e.stopPropagation();

    const element = this._element;
    const elementDOM = this._elementDOM;
    if (!element || !elementDOM) return;

    const crop = element.properties.crop;
    const startX = e.clientX;
    const startY = e.clientY;
    const startContentWidth = crop.contentWidth;
    const startContentHeight = crop.contentHeight;
    const startContentLeft = crop.contentLeft;
    const startContentTop = crop.contentTop;
    const contentAspect = startContentWidth / startContentHeight;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Determine primary delta based on corner
      let delta = 0;
      switch (corner) {
        case 'se': delta = Math.max(dx, dy); break;
        case 'sw': delta = Math.max(-dx, dy); break;
        case 'ne': delta = Math.max(dx, -dy); break;
        case 'nw': delta = Math.max(-dx, -dy); break;
      }

      let newContentWidth = startContentWidth + delta;
      let newContentHeight = newContentWidth / contentAspect;

      // Content cannot be smaller than wrapper
      const wrapperWidth = element.position.width;
      const wrapperHeight = element.position.height;
      if (newContentWidth < wrapperWidth) {
        newContentWidth = wrapperWidth;
        newContentHeight = newContentWidth / contentAspect;
      }
      if (newContentHeight < wrapperHeight) {
        newContentHeight = wrapperHeight;
        newContentWidth = newContentHeight * contentAspect;
      }

      // Adjust content position to anchor opposite corner
      const scaleRatio = newContentWidth / startContentWidth;
      let newContentLeft = startContentLeft;
      let newContentTop = startContentTop;

      if (corner === 'nw' || corner === 'sw') {
        // Anchor right edge: adjust left
        newContentLeft = startContentLeft - (newContentWidth - startContentWidth);
      }
      if (corner === 'nw' || corner === 'ne') {
        // Anchor bottom edge: adjust top
        newContentTop = startContentTop - (newContentHeight - startContentHeight);
      }

      // Clamp position
      const minLeft = Math.min(0, wrapperWidth - newContentWidth);
      const minTop = Math.min(0, wrapperHeight - newContentHeight);
      newContentLeft = Math.max(minLeft, Math.min(0, newContentLeft));
      newContentTop = Math.max(minTop, Math.min(0, newContentTop));

      crop.contentWidth = newContentWidth;
      crop.contentHeight = newContentHeight;
      crop.contentLeft = newContentLeft;
      crop.contentTop = newContentTop;

      this._applyContentStyles();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.elementController.editor.recordHistory();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Handle click outside the element to exit crop mode
   * @param {PointerEvent} e
   * @private
   */
  _onDocumentPointerDown(e) {
    if (!this.isCropMode || !this._elementDOM) return;

    // Check if click is inside the crop element
    if (this._elementDOM.contains(e.target)) return;

    this.elementController.exitCropMode();
  }

  /**
   * Handle Escape key to exit crop mode
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeyDown(e) {
    if (e.key === 'Escape' && this.isCropMode) {
      e.preventDefault();
      e.stopPropagation();
      this.elementController.exitCropMode();
    }
  }

  /**
   * Re-render the element to apply final crop state
   * @param {Element} element - Element model
   * @param {HTMLElement} oldDOM - Current DOM node
   * @private
   */
  _reRenderElement(element, oldDOM) {
    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return;

    const activeSlide = this.elementController.editor.getActiveSlide();
    const zIndex = activeSlide.elements.indexOf(element);
    const nextSibling = oldDOM.nextSibling;

    // Remove ALL DOM nodes with this ID to prevent duplicates
    // (oldDOM reference may be stale if element was re-rendered while in crop mode)
    canvas.querySelectorAll(`#${CSS.escape(element.id)}`).forEach(el => el.remove());

    const newDOM = element.render(zIndex >= 0 ? zIndex : 0);

    if (nextSibling && nextSibling.parentNode === canvas) {
      canvas.insertBefore(newDOM, nextSibling);
    } else {
      canvas.appendChild(newDOM);
    }

    // Re-attach handlers and select
    this.elementController.attachHandlers(newDOM, element);
    this.elementController._selectedElements.clear();
    this.elementController._selectedElements.add(element);
    newDOM.classList.add('selected');
    this.elementController.addHandles(newDOM);
  }
}

export default CropHandler;
