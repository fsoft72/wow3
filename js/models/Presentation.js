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

    // Shells — persistent layers that slides can reference
    this.shells = [];
    this.defaultShellId = properties.defaultShellId || null;

    // Backward compat: migrate old single `shell` into shells array
    if (properties.shell) {
      const migratedShell = Slide.fromJSON(properties.shell);
      if (!migratedShell.title || migratedShell.title === 'Shell' || migratedShell.title === 'Untitled Slide') {
        migratedShell.title = 'Shell 1';
      }
      this.shells.push(migratedShell);
      this.defaultShellId = migratedShell.id;
    }

    // Load shells from new format
    if (properties.shells && properties.shells.length > 0) {
      this.shells = properties.shells.map(s => Slide.fromJSON(s));
    }

    // Slides
    this.slides = [];

    // Load slides if provided
    if (properties.slides && properties.slides.length > 0) {
      this.slides = properties.slides.map(slideData => Slide.fromJSON(slideData));
    } else {
      // Create at least one slide
      this.slides = [new Slide()];
    }

    // Backward compat: if we migrated a single shell, assign its ID to slides
    // that didn't have hideShell === true (and don't already have a shellId)
    if (properties.shell && this.shells.length > 0) {
      const migratedId = this.shells[0].id;
      for (const slide of this.slides) {
        if (slide.shellId === null && properties.slides) {
          // Find original slide data to check if it had hideShell
          const origData = properties.slides.find(s => s.id === slide.id);
          if (origData && origData.hideShell !== true) {
            slide.shellId = migratedId;
          }
        }
      }
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
    const newSlide = slide || new Slide({
      title: `Slide ${this.slides.length + 1}`,
      shellId: this.defaultShellId
    });

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
   * Add a new shell and return it
   * @param {string} [name] - Optional display name
   * @returns {Slide} The created shell
   */
  addShell(name) {
    const shellName = name || `Shell ${this.shells.length + 1}`;
    const shell = new Slide({ title: shellName, background: 'transparent' });
    this.shells.push(shell);
    // If this is the first shell, make it the default
    if (this.shells.length === 1) {
      this.defaultShellId = shell.id;
    }
    this.updateModified();
    return shell;
  }

  /**
   * Remove a shell by ID. Updates all slides referencing it to null.
   * @param {string} shellId - Shell ID to remove
   * @returns {boolean} True if removed
   */
  removeShell(shellId) {
    const idx = this.shells.findIndex(s => s.id === shellId);
    if (idx === -1) return false;

    this.shells.splice(idx, 1);

    // Clear references from all slides
    for (const slide of this.slides) {
      if (slide.shellId === shellId) {
        slide.shellId = null;
      }
    }

    // Clear default if it was the removed shell
    if (this.defaultShellId === shellId) {
      this.defaultShellId = this.shells.length > 0 ? this.shells[0].id : null;
    }

    this.updateModified();
    return true;
  }

  /**
   * Check whether any shells exist
   * @returns {boolean}
   */
  hasShells() {
    return this.shells.length > 0;
  }

  /**
   * Get a shell by its ID
   * @param {string} shellId - Shell ID
   * @returns {Slide|null} Shell slide or null
   */
  getShellById(shellId) {
    if (!shellId) return null;
    return this.shells.find(s => s.id === shellId) || null;
  }

  /**
   * Get the default (starred) shell
   * @returns {Slide|null} Default shell or null
   */
  getDefaultShell() {
    return this.getShellById(this.defaultShellId);
  }

  /**
   * Set the default shell
   * @param {string|null} shellId - Shell ID or null to clear
   */
  setDefaultShell(shellId) {
    if (shellId === null || this.getShellById(shellId)) {
      this.defaultShellId = shellId;
      this.updateModified();
    }
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
      shells: this.shells.map(shell => shell.toJSON()),
      defaultShellId: this.defaultShellId
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
