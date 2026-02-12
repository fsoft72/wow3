/**
 * WOW3 Right Sidebar
 * Property panels for slides and elements
 */

import { FONT_FAMILIES, TEXT_ALIGNMENTS } from '../utils/constants.js';
import { TextPanel, ImagePanel, VideoPanel, AudioPanel } from '../panels/index.js';

export class RightSidebar {
  constructor() {
    this.slideTab = null;
    this.elementTab = null;
    this.animationTab = null;
    this.activeTab = null; // Track active panel tab
  }

  /**
   * Initialize right sidebar
   */
  async init() {
    console.log('Initializing RightSidebar...');

    this.slideTab = document.getElementById('tab-slide');
    this.elementTab = document.getElementById('tab-element');
    this.animationTab = document.getElementById('tab-animation');

    console.log('RightSidebar initialized');
  }

  /**
   * Update properties panel for element
   * @param {Element} element - Element to show properties for
   */
  updateProperties(element) {
    if (!element || !this.elementTab) {
      this.clearProperties();
      return;
    }

    // Save current active tab before re-rendering
    const currentTab = document.querySelector('.panel-tab.active');
    const savedTab = currentTab ? currentTab.dataset.tab : null;

    this.elementTab.innerHTML = '';

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
   * Clear properties panel
   */
  clearProperties() {
    if (this.elementTab) {
      this.elementTab.innerHTML = '<p class="grey-text center-align" style="padding: 20px;">No element selected</p>';
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
      this.createNumberInput('X', element.position.x, (val) => {
        window.app.editor.elementController.updateElementProperty('position.x', parseFloat(val));
      })
    );

    grid.appendChild(
      this.createNumberInput('Y', element.position.y, (val) => {
        window.app.editor.elementController.updateElementProperty('position.y', parseFloat(val));
      })
    );

    section.appendChild(grid);

    const grid2 = document.createElement('div');
    grid2.className = 'property-row two-col';

    grid2.appendChild(
      this.createNumberInput('Width', element.position.width, (val) => {
        window.app.editor.elementController.updateElementProperty('position.width', parseFloat(val));
      })
    );

    grid2.appendChild(
      this.createNumberInput('Height', element.position.height, (val) => {
        window.app.editor.elementController.updateElementProperty('position.height', parseFloat(val));
      })
    );

    section.appendChild(grid2);

    section.appendChild(
      this.createNumberInput('Rotation', element.position.rotation, (val) => {
        window.app.editor.elementController.updateElementProperty('position.rotation', parseFloat(val));
      }, { min: 0, max: 360, step: 1 })
    );

    this.elementTab.appendChild(section);
  }

  /**
   * Add text properties
   * @param {Element} element - Text element
   */
  addTextProperties(element) {
    const section = this.createSection('Text');

    section.appendChild(
      this.createSelect(
        'Font',
        element.properties.font.family,
        FONT_FAMILIES,
        (val) => {
          window.app.editor.elementController.updateElementProperty('properties.font.family', val);
        }
      )
    );

    section.appendChild(
      this.createNumberInput('Size', element.properties.font.size, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.size', parseInt(val));
      }, { min: 8, max: 144 })
    );

    section.appendChild(
      this.createColorInput('Color', element.properties.font.color, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.color', val);
      })
    );

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
          M.toast({ html: `Uploading ${element.type}...`, classes: 'blue' });

          // Upload to MediaDB via element's setUrl method
          await element.setUrl(file);

          // Update UI
          await window.app.editor.slideController.renderCurrentSlide();
          window.app.editor.elementController.selectElement(element);
          window.app.editor.recordHistory();

          M.toast({ html: `${element.type} uploaded successfully!`, classes: 'green' });
        } catch (error) {
          console.error('Upload failed:', error);
          M.toast({ html: `Failed to upload ${element.type}`, classes: 'red' });
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
        ['rectangle', 'circle', 'triangle'],
        (val) => {
          window.app.editor.elementController.updateElementProperty('properties.shapeType', val);
        }
      )
    );

    section.appendChild(
      this.createColorInput('Fill', element.properties.fillColor, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.fillColor', val);
      })
    );

    section.appendChild(
      this.createColorInput('Stroke', element.properties.strokeColor, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.strokeColor', val);
      })
    );

    section.appendChild(
      this.createNumberInput('Stroke Width', element.properties.strokeWidth, (val) => {
        window.app.editor.elementController.updateElementProperty('properties.strokeWidth', parseFloat(val));
      }, { min: 0, max: 20 })
    );

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

    // Initialize Materialize select
    setTimeout(() => M.FormSelect.init(select), 0);

    return wrapper;
  }
}

export default RightSidebar;
