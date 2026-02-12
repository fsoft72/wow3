/**
 * WOW3 Presentation Model
 * Top-level model containing all slides and metadata
 */

import { generateId } from '../utils/dom.js';
import { Slide } from './Slide.js';

export class Presentation {
  /**
   * Create a new presentation
   * @param {Object} properties - Presentation properties
   */
  constructor(properties = {}) {
    this.id = properties.id || generateId('presentation');
    this.title = properties.title || 'Untitled Presentation';
    this.currentSlideIndex = properties.currentSlideIndex || 0;

    // Metadata
    this.metadata = {
      created: properties.metadata?.created || new Date().toISOString(),
      modified: properties.metadata?.modified || new Date().toISOString(),
      author: properties.metadata?.author || '',
      version: properties.metadata?.version || '1.0.0'
    };

    // Shell — persistent layer rendered on every slide
    this.shell = properties.shell ? Slide.fromJSON(properties.shell) : null;
    this.shellMode = properties.shellMode || 'below'; // 'above' | 'below'

    // Slides
    this.slides = [];

    // Load slides if provided
    if (properties.slides && properties.slides.length > 0) {
      this.slides = properties.slides.map(slideData => Slide.fromJSON(slideData));
    } else {
      // Create at least one slide
      this.slides = [new Slide()];
    }
  }

  /**
   * Get current slide
   * @returns {Slide} Current slide
   */
  getCurrentSlide() {
    return this.slides[this.currentSlideIndex] || this.slides[0];
  }

  /**
   * Set current slide
   * @param {number} index - Slide index
   * @returns {boolean} Success status
   */
  setCurrentSlide(index) {
    if (index >= 0 && index < this.slides.length) {
      this.currentSlideIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Add new slide
   * @param {Slide} slide - Slide to add (optional, creates new if not provided)
   * @param {number} index - Index to insert at (optional, appends if not provided)
   * @returns {Slide} Added slide
   */
  addSlide(slide = null, index = null) {
    const newSlide = slide || new Slide({ title: `Slide ${this.slides.length + 1}` });

    if (index === null || index >= this.slides.length) {
      this.slides.push(newSlide);
    } else if (index >= 0) {
      this.slides.splice(index, 0, newSlide);
    }

    this.updateModified();
    return newSlide;
  }

  /**
   * Remove slide
   * @param {number} index - Slide index
   * @returns {boolean} Success status
   */
  removeSlide(index) {
    // Always keep at least one slide
    if (this.slides.length > 1 && index >= 0 && index < this.slides.length) {
      this.slides.splice(index, 1);

      // Adjust current slide index if necessary
      if (this.currentSlideIndex >= this.slides.length) {
        this.currentSlideIndex = this.slides.length - 1;
      }

      this.updateModified();
      return true;
    }
    return false;
  }

  /**
   * Get slide by index
   * @param {number} index - Slide index
   * @returns {Slide|null} Slide or null
   */
  getSlide(index) {
    return this.slides[index] || null;
  }

  /**
   * Get slide by ID
   * @param {string} slideId - Slide ID
   * @returns {Slide|null} Slide or null
   */
  getSlideById(slideId) {
    return this.slides.find(slide => slide.id === slideId) || null;
  }

  /**
   * Duplicate slide
   * @param {number} index - Slide index to duplicate
   * @returns {Slide|null} Cloned slide or null
   */
  duplicateSlide(index) {
    if (index >= 0 && index < this.slides.length) {
      const clonedSlide = this.slides[index].clone();
      clonedSlide.title = `${this.slides[index].title} (Copy)`;
      this.slides.splice(index + 1, 0, clonedSlide);
      this.updateModified();
      return clonedSlide;
    }
    return null;
  }

  /**
   * Reorder slides
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   * @returns {boolean} Success status
   */
  reorderSlides(fromIndex, toIndex) {
    if (
      fromIndex >= 0 && fromIndex < this.slides.length &&
      toIndex >= 0 && toIndex < this.slides.length
    ) {
      const [slide] = this.slides.splice(fromIndex, 1);
      this.slides.splice(toIndex, 0, slide);

      // Update current slide index if it was affected
      if (this.currentSlideIndex === fromIndex) {
        this.currentSlideIndex = toIndex;
      } else if (fromIndex < this.currentSlideIndex && toIndex >= this.currentSlideIndex) {
        this.currentSlideIndex--;
      } else if (fromIndex > this.currentSlideIndex && toIndex <= this.currentSlideIndex) {
        this.currentSlideIndex++;
      }

      this.updateModified();
      return true;
    }
    return false;
  }

  /**
   * Move to next slide
   * @returns {boolean} True if moved
   */
  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.currentSlideIndex++;
      return true;
    }
    return false;
  }

  /**
   * Move to previous slide
   * @returns {boolean} True if moved
   */
  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      return true;
    }
    return false;
  }

  /**
   * Move to first slide
   */
  firstSlide() {
    this.currentSlideIndex = 0;
  }

  /**
   * Move to last slide
   */
  lastSlide() {
    this.currentSlideIndex = this.slides.length - 1;
  }

  /**
   * Set presentation title
   * @param {string} title - Presentation title
   */
  setTitle(title) {
    this.title = title;
    this.updateModified();
  }

  /**
   * Set author
   * @param {string} author - Author name
   */
  setAuthor(author) {
    this.metadata.author = author;
    this.updateModified();
  }

  /**
   * Update modified timestamp
   */
  updateModified() {
    this.metadata.modified = new Date().toISOString();
  }

  /**
   * Get presentation statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    let totalElements = 0;
    let elementTypes = {};

    this.slides.forEach(slide => {
      const elements = slide.getAllElements();
      totalElements += elements.length;

      elements.forEach(element => {
        elementTypes[element.type] = (elementTypes[element.type] || 0) + 1;
      });
    });

    return {
      slideCount: this.slides.length,
      totalElements,
      elementTypes,
      created: this.metadata.created,
      modified: this.metadata.modified,
      author: this.metadata.author
    };
  }

  /**
   * Create the shell slide (persistent layer shown on every slide)
   * @returns {Slide} The created shell
   */
  createShell() {
    if (!this.shell) {
      this.shell = new Slide({ title: 'Shell', background: 'transparent' });
    }
    return this.shell;
  }

  /**
   * Remove the shell slide
   */
  removeShell() {
    this.shell = null;
  }

  /**
   * Check whether a shell exists
   * @returns {boolean}
   */
  hasShell() {
    return this.shell !== null;
  }

  /**
   * Convert presentation to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      currentSlideIndex: this.currentSlideIndex,
      metadata: { ...this.metadata },
      slides: this.slides.map(slide => slide.toJSON()),
      shell: this.shell?.toJSON() ?? null,
      shellMode: this.shellMode
    };
  }

  /**
   * Create presentation from JSON
   * @param {Object} data - JSON data
   * @returns {Presentation} Presentation instance
   */
  static fromJSON(data) {
    return new Presentation(data);
  }
}

export default Presentation;
