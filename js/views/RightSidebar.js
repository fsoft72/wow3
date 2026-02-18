/**
 * WOW3 Right Sidebar
 * Property panels for slides and elements
 */

import { TEXT_ALIGNMENTS } from '../utils/constants.js';
import { TextPanel, ImagePanel, VideoPanel, AudioPanel, CountdownTimerPanel } from '../panels/index.js';
import { toast } from '../utils/toasts.js';

export class RightSidebar {
  constructor() {
    this.slideTab = null;
    this.elementTab = null;
    this.activeTab = null; // Track active panel tab
    this.currentElementId = null; // Track currently displayed element
  }

  /**
   * Initialize right sidebar
   */
  async init() {
    console.log('Initializing RightSidebar...');

    this.slideTab = document.getElementById('tab-slide');
    this.elementTab = document.getElementById('tab-element');

    console.log('RightSidebar initialized');
  }

  /**
   * Update properties panel for element
   * @param {Element} element - Element to show properties for
   * @param {boolean} forceUpdate - Force re-render even if same element
   */
  updateProperties(element, forceUpdate = false) {
    if (!element || !this.elementTab) {
      this.clearProperties();
      return;
    }

    // If the element hasn't changed, don't re-render the panel
    if (!forceUpdate && this.currentElementId === element.id) {
      return;
    }

    // Track current element
    this.currentElementId = element.id;

    // Save current active tab before re-rendering
    const currentTab = document.querySelector('.panel-tab.active');
    const savedTab = currentTab ? currentTab.dataset.tab : null;

    this.elementTab.innerHTML = '';

    // Add element name input at the top
    this.addNameInput(element);

    // Add position properties (always show these)
    this.addPositionProperties(element);

    // Add type-specific panel
    let panelHTML = '';
    let panel = null;

    switch (element.type) {
      case 'text':
        panel = TextPanel;
        panelHTML = TextPanel.render(element);
        break;

      case 'image':
        panel = ImagePanel;
        panelHTML = ImagePanel.render(element);
        break;

      case 'video':
        panel = VideoPanel;
        panelHTML = VideoPanel.render(element);
        break;

      case 'audio':
        panel = AudioPanel;
        panelHTML = AudioPanel.render(element);
        break;

      case 'countdown_timer':
        panel = CountdownTimerPanel;
        panelHTML = CountdownTimerPanel.render(element);
        break;

      case 'shape':
        this.addShapeProperties(element);
        return;

      case 'link':
        this.addLinkProperties(element);
        return;

      case 'list':
        this.addListProperties(element);
        return;
    }

    if (panelHTML) {
      const section = this.createSection(element.type.charAt(0).toUpperCase() + element.type.slice(1));
      section.innerHTML = panelHTML;
      this.elementTab.appendChild(section);

      // Bind panel events
      if (panel) {
        setTimeout(() => {
          panel.bindEvents(element);

          // Restore previously active tab
          if (savedTab) {
            this.restoreActiveTab(savedTab);
          }
        }, 0);
      }
    }
  }

  /**
   * Restore the active tab after panel re-render
   * @param {string} tabName - Name of tab to activate
   */
  restoreActiveTab(tabName) {
    const tabs = document.querySelectorAll('.panel-tab');
    const contents = document.querySelectorAll('.panel-tab-content');

    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    contents.forEach(content => {
      if (content.dataset.tabContent === tabName) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * Show info panel for multi-element selection
   * @param {number} count - Number of selected elements
   */
  showMultiSelectionInfo(count) {
    this.currentElementId = null;
    if (this.elementTab) {
      this.elementTab.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <i class="material-icons grey-text" style="font-size: 48px;">select_all</i>
          <p class="grey-text">${count} elements selected</p>
          <p class="grey-text" style="font-size: 12px;">Press <kbd>Delete</kbd> to remove, or drag to move together</p>
        </div>
      `;
    }
  }

  /**
   * Clear properties panel
   */
  clearProperties() {
    this.currentElementId = null;
    if (this.elementTab) {
      this.elementTab.innerHTML = '<p class="grey-text center-align" style="padding: 20px;">No element selected</p>';
    }
    this.switchToSlideTab();
  }

  /**
   * Switch to the Slide tab in the right sidebar
   */
  switchToSlideTab() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return;
    const tabsInstance = M.Tabs.getInstance(tabs);
    if (tabsInstance) {
      tabsInstance.select('tab-slide');
    }
  }

  /**
   * Update position values in real-time (without re-rendering entire panel)
   * @param {Element} element - Element with updated position
   */
  updatePositionValues(element) {
    if (!element || this.currentElementId !== element.id) return;

    // Update position inputs
    const xInput = document.getElementById('prop-x');
    const yInput = document.getElementById('prop-y');
    const widthInput = document.getElementById('prop-width');
    const heightInput = document.getElementById('prop-height');
    if (xInput) xInput.value = Math.round(element.position.x);
    if (yInput) yInput.value = Math.round(element.position.y);
    if (widthInput) widthInput.value = Math.round(element.position.width);
    if (heightInput) heightInput.value = Math.round(element.position.height);
    if (this._rotationRange) this._rotationRange.update(Math.round(element.position.rotation));
  }

  /**
   * Add element name input field
   * @param {Object} element - Element model
   */
  addNameInput(element) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';
    wrapper.style.margin = '8px 0';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'prop-element-name';
    input.value = element.name || '';
    input.placeholder = this._getDefaultName(element);

    const label = document.createElement('label');
    label.setAttribute('for', 'prop-element-name');
    label.textContent = 'Element Name';
    label.classList.add('active');

    input.addEventListener('change', (e) => {
      element.name = e.target.value.trim();

      // Update the tooltip on the canvas DOM element
      const domEl = document.getElementById(element.id);
      if (domEl) {
        domEl.title = element.name || '';
      }

      // Refresh the elements tree to show the new name
      if (window.app?.editor?.uiManager?.elementsTree) {
        const slide = window.app.editor.getActiveSlide();
        window.app.editor.uiManager.elementsTree.render(slide.elements);
      }

      window.app.editor.recordHistory();
    });

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    this.elementTab.appendChild(wrapper);
  }

  /**
   * Get default display name for an element (used as placeholder)
   * @param {Object} element - Element model
   * @returns {string}
   * @private
   */
  _getDefaultName(element) {
    switch (element.type) {
      case 'text': return element.properties.text?.substring(0, 25) || 'Text';
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      case 'shape': return `Shape (${element.properties.shapeType})`;
      case 'list': return `List (${element.properties.listType})`;
      case 'link': return element.properties.text || 'Link';
      default: return element.type;
    }
  }

  /**
   * Add position properties
   * @param {Element} element - Element
   */
  addPositionProperties(element) {
    const section = this.createSection('Position & Size');

    const grid = document.createElement('div');
    grid.className = 'property-row two-col';

    grid.appendChild(
      this.createNumberInput('X', Math.round(element.position.x), (val) => {
        window.app.editor.elementController.updateElementProperty('position.x', parseInt(val));
      }, { step: 1 })
    );

    grid.appendChild(
      this.createNumberInput('Y', Math.round(element.position.y), (val) => {
        window.app.editor.elementController.updateElementProperty('position.y', parseInt(val));
      }, { step: 1 })
    );

    section.appendChild(grid);

    const grid2 = document.createElement('div');
    grid2.className = 'property-row two-col';

    grid2.appendChild(
      this.createNumberInput('Width', Math.round(element.position.width), (val) => {
        window.app.editor.elementController.updateElementProperty('position.width', parseInt(val));
      }, { min: 1, step: 1 })
    );

    grid2.appendChild(
      this.createNumberInput('Height', Math.round(element.position.height), (val) => {
        window.app.editor.elementController.updateElementProperty('position.height', parseInt(val));
      }, { min: 1, step: 1 })
    );

    section.appendChild(grid2);

    // Rotation — RangeInput slider (-360 to 360)
    const rotationWrapper = document.createElement('div');
    rotationWrapper.className = 'range-field';
    rotationWrapper.id = 'prop-rotation-range';
    section.appendChild(rotationWrapper);

    requestAnimationFrame(() => {
      this._rotationRange = new RangeInput('prop-rotation-range', {
        label: 'Rotation',
        value: element.position.rotation,
        min: -360,
        max: 360,
        step: 1,
        unit: '°',
        onChange: (val) => {
          window.app.editor.elementController.updateElementProperty('position.rotation', val);
        }
      });
    });

    this.elementTab.appendChild(section);
  }

  /**
   * Add text properties
   * @param {Element} element - Text element
   */
  addTextProperties(element) {
    const section = this.createSection('Text');

    // Font family picker with font previews
    const fontPickerWrapper = document.createElement('div');
    fontPickerWrapper.className = 'input-field';
    const fontPickerLabel = document.createElement('label');
    fontPickerLabel.textContent = 'Font';
    fontPickerLabel.classList.add('active');
    fontPickerWrapper.appendChild(fontPickerLabel);
    const fontPickerId = 'sidebar-font-family';
    fontPickerWrapper.insertAdjacentHTML('beforeend', PanelUtils.renderFontFamilyPicker(fontPickerId, element.properties.font.family));
    section.appendChild(fontPickerWrapper);
    // Defer binding so DOM is attached
    setTimeout(() => {
      PanelUtils.bindFontFamilyPicker(fontPickerId, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.family', val);
      });
    }, 0);

    section.appendChild(
      this.createNumberInput('Size', element.properties.font.size, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.size', parseInt(val));
      }, { min: 8, max: 144 })
    );

    // Text color — gradient selector (full width)
    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'input-field';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    colorLabel.classList.add('active');
    const colorContainer = document.createElement('div');
    colorContainer.id = 'text-color-gradient-selector';
    colorWrapper.appendChild(colorLabel);
    colorWrapper.appendChild(colorContainer);
    section.appendChild(colorWrapper);

    // Instantiate GradientSelector after DOM insertion
    requestAnimationFrame(() => {
      if ( window.GradientSelector ) {
        this._textColorSelector = new GradientSelector('text-color-gradient-selector', {
          value: element.properties.font.color,
          onChange: (val) => {
            window.app.editor.elementController.updateElementProperty('properties.font.color', val);
          }
        });
      }
    });

    section.appendChild(
      this.createSelect(
        'Alignment',
        element.properties.font.alignment,
        TEXT_ALIGNMENTS.map(a => a.value),
        (val) => {
          window.app.editor.elementController.updateElementProperty('properties.font.alignment', val);
        }
      )
    );

    this.elementTab.appendChild(section);
  }

  /**
   * Add media properties
   * @param {Element} element - Media element
   */
  addMediaProperties(element) {
    const section = this.createSection('Media');

    // File upload button
    const uploadBtn = this.createFileUploadButton(element);
    section.appendChild(uploadBtn);

    // URL input with library button
    const urlGroup = this.createMediaUrlInput(element);
    section.appendChild(urlGroup);

    // Show media info if it's a media ID
    if (element.properties.url && element.properties.url.startsWith('media_')) {
      const info = document.createElement('p');
      info.className = 'grey-text';
      info.style.fontSize = '12px';
      info.style.marginTop = '8px';
      info.innerHTML = `<i class="material-icons tiny">info</i> Stored in IndexedDB`;
      section.appendChild(info);
    }

    this.elementTab.appendChild(section);
  }

  /**
   * Create media URL input with library button
   * @param {Element} element - Media element
   * @returns {HTMLElement} URL input group
   */
  createMediaUrlInput(element) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';
    wrapper.style.marginBottom = '20px';

    const label = document.createElement('label');
    label.textContent = 'URL or Media ID';
    label.classList.add('active');

    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.gap = '8px';
    inputWrapper.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = element.properties.url || '';
    input.style.flex = '1';
    input.style.marginBottom = '0';
    input.addEventListener('change', async (e) => {
      await window.app.editor.elementController.updateMediaUrl(element, e.target.value);
    });

    const libraryBtn = document.createElement('button');
    libraryBtn.className = 'btn-flat waves-effect blue-text';
    libraryBtn.type = 'button';
    libraryBtn.title = 'Select from Media Library';
    libraryBtn.innerHTML = '<i class="material-icons">photo_library</i>';
    libraryBtn.style.minWidth = '40px';
    libraryBtn.style.padding = '0 8px';
    libraryBtn.addEventListener('click', () => {
      MediaManager.open(async (data) => {
        // Use the media ID (localUrl format: local://media_123_abc)
        const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
        if (mediaId) {
          await window.app.editor.elementController.updateMediaUrl(element, mediaId);
          input.value = mediaId;
        }
      });
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(libraryBtn);

    wrapper.appendChild(label);
    wrapper.appendChild(inputWrapper);

    return wrapper;
  }

  /**
   * Create file upload button
   * @param {Element} element - Media element
   * @returns {HTMLElement} Upload button wrapper
   */
  createFileUploadButton(element) {
    const wrapper = document.createElement('div');
    wrapper.className = 'file-field input-field';
    wrapper.style.marginBottom = '20px';

    const btn = document.createElement('div');
    btn.className = 'btn waves-effect blue darken-1';

    const btnText = document.createElement('span');
    btnText.innerHTML = '<i class="material-icons left">cloud_upload</i>Upload File';
    btn.appendChild(btnText);

    const input = document.createElement('input');
    input.type = 'file';

    // Set accept based on element type
    if (element.type === 'image') {
      input.accept = 'image/*';
    } else if (element.type === 'video') {
      input.accept = 'video/*';
    } else if (element.type === 'audio') {
      input.accept = 'audio/*';
    }

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Show loading state
          toast.info(`Uploading ${element.type}...`);

          // Upload to MediaDB via element's setUrl method
          await element.setUrl(file);

          // Update UI
          await window.app.editor.slideController.renderCurrentSlide();
          window.app.editor.elementController.selectElement(element);
          window.app.editor.recordHistory();

          toast.success(`${element.type} uploaded successfully!`);
        } catch (error) {
          console.error('Upload failed:', error);
          toast.error(`Failed to upload ${element.type}`);
        }
      }
    });

    btn.appendChild(input);
    wrapper.appendChild(btn);

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-path-wrapper';
    const filePathInput = document.createElement('input');
    filePathInput.className = 'file-path validate';
    filePathInput.type = 'text';
    filePathInput.placeholder = `Upload ${element.type} file or enter URL below`;
    fileInfo.appendChild(filePathInput);
    wrapper.appendChild(fileInfo);

    return wrapper;
  }

  /**
   * Add shape properties
   * @param {Element} element - Shape element
   */
  addShapeProperties(element) {
    const section = this.createSection('Shape');

    section.appendChild(
      this.createSelect(
        'Type',
        element.properties.shapeType,
        ['rectangle', 'circle', 'triangle', 'line'],
        (val) => {
          window.app.editor.elementController.updateElementProperty('properties.shapeType', val);
        }
      )
    );

    // Fill — gradient selector (full width)
    const fillWrapper = document.createElement('div');
    fillWrapper.className = 'input-field';
    const fillLabel = document.createElement('label');
    fillLabel.textContent = 'Fill';
    fillLabel.classList.add('active');
    const fillContainer = document.createElement('div');
    fillContainer.id = 'shape-fill-gradient-selector';
    fillWrapper.appendChild(fillLabel);
    fillWrapper.appendChild(fillContainer);
    section.appendChild(fillWrapper);

    // Instantiate GradientSelector after DOM insertion
    requestAnimationFrame(() => {
      if ( window.GradientSelector ) {
        this._shapeFillSelector = new GradientSelector('shape-fill-gradient-selector', {
          value: element.properties.fillColor,
          animationSpeed: element.properties.fillColorAnimationSpeed ?? 0,
          onChange: (val, animationSpeed) => {
            window.app.editor.elementController.updateElementProperty('properties.fillColor', val);
            window.app.editor.elementController.updateElementProperty('properties.fillColorAnimationSpeed', animationSpeed);
          }
        });
      }
    });

    // Stroke — gradient selector (full width)
    const strokeWrapper = document.createElement('div');
    strokeWrapper.className = 'input-field';
    const strokeLabel = document.createElement('label');
    strokeLabel.textContent = 'Stroke';
    strokeLabel.classList.add('active');
    const strokeContainer = document.createElement('div');
    strokeContainer.id = 'shape-stroke-gradient-selector';
    strokeWrapper.appendChild(strokeLabel);
    strokeWrapper.appendChild(strokeContainer);
    section.appendChild(strokeWrapper);

    // Instantiate stroke GradientSelector after DOM insertion
    requestAnimationFrame(() => {
      if ( window.GradientSelector ) {
        this._shapeStrokeSelector = new GradientSelector('shape-stroke-gradient-selector', {
          value: element.properties.strokeColor,
          animationSpeed: element.properties.strokeColorAnimationSpeed ?? 0,
          onChange: (val, animationSpeed) => {
            window.app.editor.elementController.updateElementProperty('properties.strokeColor', val);
            window.app.editor.elementController.updateElementProperty('properties.strokeColorAnimationSpeed', animationSpeed);
          }
        });
      }
    });

    // Stroke Width
    const widthWrapper = document.createElement('div');
    widthWrapper.className = 'range-field';
    widthWrapper.id = 'shape-stroke-width-range';
    section.appendChild(widthWrapper);

    // Instantiate RangeInput after DOM insertion
    requestAnimationFrame(() => {
      new RangeInput('shape-stroke-width-range', {
        label: 'Stroke Width',
        value: element.properties.strokeWidth,
        min: 0,
        max: 20,
        step: 0.5,
        unit: 'px',
        onChange: (val) => {
          window.app.editor.elementController.updateElementProperty('properties.strokeWidth', val);
        }
      });
    });

    this.elementTab.appendChild(section);
  }

  /**
   * Add link properties
   * @param {Element} element - Link element
   */
  addLinkProperties(element) {
    const section = this.createSection('Link');

    section.appendChild(
      this.createTextInput('Text', element.properties.text, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.text', val);
      })
    );

    section.appendChild(
      this.createTextInput('URL', element.properties.url, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.url', val);
      })
    );

    section.appendChild(
      this.createColorInput('Background', element.properties.backgroundColor, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.backgroundColor', val);
      })
    );

    this.elementTab.appendChild(section);
  }

  /**
   * Add list properties
   * @param {Element} element - List element
   */
  addListProperties(element) {
    const section = this.createSection('List');

    section.appendChild(
      this.createSelect(
        'Type',
        element.properties.listType,
        ['ordered', 'unordered'],
        (val) => {
          window.app.editor.elementController.updateElementProperty('properties.listType', val);
        }
      )
    );

    this.elementTab.appendChild(section);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Create section
   * @param {string} title - Section title
   * @returns {HTMLElement} Section element
   */
  createSection(title) {
    const section = document.createElement('div');
    section.className = 'property-section';

    const heading = document.createElement('h6');
    heading.textContent = title;
    section.appendChild(heading);

    return section;
  }

  /**
   * Create number input
   * @param {string} label - Input label
   * @param {number} value - Input value
   * @param {Function} onChange - Change handler
   * @param {Object} options - Input options (min, max, step)
   * @returns {HTMLElement} Input wrapper
   */
  createNumberInput(label, value, onChange, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(/\s+/g, '-')}`;

    if (options.min !== undefined) input.min = options.min;
    if (options.max !== undefined) input.max = options.max;
    if (options.step !== undefined) input.step = options.step;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  /**
   * Create text input
   * @param {string} label - Input label
   * @param {string} value - Input value
   * @param {Function} onChange - Change handler
   * @returns {HTMLElement} Input wrapper
   */
  createTextInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  /**
   * Create color input
   * @param {string} label - Input label
   * @param {string} value - Input value
   * @param {Function} onChange - Change handler
   * @returns {HTMLElement} Input wrapper
   */
  createColorInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  /**
   * Create select dropdown
   * @param {string} label - Select label
   * @param {string} value - Selected value
   * @param {Array} options - Option values
   * @param {Function} onChange - Change handler
   * @returns {HTMLElement} Select wrapper
   */
  createSelect(label, value, options, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const select = document.createElement('select');
    select.id = `prop-${label.toLowerCase().replace(/\s+/g, '-')}`;

    options.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      option.selected = opt === value;
      select.appendChild(option);
    });

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.classList.add('active'); // Mark label as active for Materialize

    select.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(select);
    wrapper.appendChild(labelEl);

    return wrapper;
  }
}

export default RightSidebar;
