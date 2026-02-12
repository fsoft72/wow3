/**
 * WOW3 Status Bar
 * Bottom status bar component
 */

export class StatusBar {
  constructor() {
    this.slideCounter = null;
    this.zoomLevel = null;
  }

  /**
   * Initialize status bar
   */
  async init() {
    console.log('Initializing StatusBar...');

    this.slideCounter = document.getElementById('slide-counter');
    this.zoomLevel = document.getElementById('zoom-level');

    console.log('StatusBar initialized');
  }

  /**
   * Update status bar
   * @param {number} currentSlide - Current slide number (1-indexed)
   * @param {number} totalSlides - Total number of slides
   */
  update(currentSlide, totalSlides) {
    if (this.slideCounter) {
      this.slideCounter.textContent = `Slide ${currentSlide} of ${totalSlides}`;
    }
  }

  /**
   * Update zoom level
   * @param {number} zoom - Zoom percentage
   */
  updateZoom(zoom) {
    if (this.zoomLevel) {
      this.zoomLevel.textContent = `${Math.round(zoom)}%`;
    }
  }
}

export default StatusBar;
