/**
 * TemplateManager: Handles UI and Logic for the Template Library.
 * Provides built-in slide templates and user-saved templates.
 */

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin_blank',
    name: 'Blank',
    slideData: {
      id: 'tpl_blank',
      title: 'Blank Slide',
      background: '#ffffff',
      visible: true,
      hideShell: false,
      elements: []
    }
  },
  {
    id: 'builtin_title_slide',
    name: 'Title Slide',
    slideData: {
      id: 'tpl_title_slide',
      title: 'Title Slide',
      background: '#1565C0',
      visible: true,
      hideShell: false,
      elements: [
        {
          id: 'tpl_ts_title',
          type: 'text',
          position: { x: 140, y: 260, width: 1000, height: 100, rotation: 0 },
          properties: {
            text: 'Presentation Title',
            font: { family: 'Roboto', size: 64, color: '#ffffff', bold: true, italic: false, underline: false },
            textAlign: 'center',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        },
        {
          id: 'tpl_ts_subtitle',
          type: 'text',
          position: { x: 240, y: 380, width: 800, height: 60, rotation: 0 },
          properties: {
            text: 'Subtitle goes here',
            font: { family: 'Roboto', size: 28, color: '#90CAF9', bold: false, italic: false, underline: false },
            textAlign: 'center',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        }
      ]
    }
  },
  {
    id: 'builtin_title_content',
    name: 'Title + Content',
    slideData: {
      id: 'tpl_title_content',
      title: 'Title + Content',
      background: '#ffffff',
      visible: true,
      hideShell: false,
      elements: [
        {
          id: 'tpl_tc_title',
          type: 'text',
          position: { x: 80, y: 40, width: 1120, height: 80, rotation: 0 },
          properties: {
            text: 'Slide Title',
            font: { family: 'Roboto', size: 40, color: '#1565C0', bold: true, italic: false, underline: false },
            textAlign: 'left',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        },
        {
          id: 'tpl_tc_divider',
          type: 'shape',
          position: { x: 80, y: 130, width: 1120, height: 4, rotation: 0 },
          properties: {
            shapeType: 'rectangle',
            fillColor: '#1565C0',
            strokeColor: 'transparent',
            strokeWidth: 0,
            borderRadius: 0,
            opacity: 1
          },
          children: []
        },
        {
          id: 'tpl_tc_body',
          type: 'text',
          position: { x: 80, y: 160, width: 1120, height: 480, rotation: 0 },
          properties: {
            text: 'Add your content here. Use bullet points, paragraphs, or any text you need.',
            font: { family: 'Roboto', size: 22, color: '#333333', bold: false, italic: false, underline: false },
            textAlign: 'left',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        }
      ]
    }
  },
  {
    id: 'builtin_section_divider',
    name: 'Section Divider',
    slideData: {
      id: 'tpl_section_divider',
      title: 'Section Divider',
      background: '#0D47A1',
      visible: true,
      hideShell: false,
      elements: [
        {
          id: 'tpl_sd_title',
          type: 'text',
          position: { x: 190, y: 280, width: 900, height: 90, rotation: 0 },
          properties: {
            text: 'Section Title',
            font: { family: 'Roboto', size: 52, color: '#ffffff', bold: true, italic: false, underline: false },
            textAlign: 'center',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        },
        {
          id: 'tpl_sd_line',
          type: 'shape',
          position: { x: 490, y: 390, width: 300, height: 3, rotation: 0 },
          properties: {
            shapeType: 'rectangle',
            fillColor: '#42A5F5',
            strokeColor: 'transparent',
            strokeWidth: 0,
            borderRadius: 0,
            opacity: 1
          },
          children: []
        }
      ]
    }
  },
  {
    id: 'builtin_two_column',
    name: 'Two Column',
    slideData: {
      id: 'tpl_two_column',
      title: 'Two Column',
      background: '#ffffff',
      visible: true,
      hideShell: false,
      elements: [
        {
          id: 'tpl_2c_title',
          type: 'text',
          position: { x: 80, y: 40, width: 1120, height: 70, rotation: 0 },
          properties: {
            text: 'Two Column Layout',
            font: { family: 'Roboto', size: 36, color: '#1565C0', bold: true, italic: false, underline: false },
            textAlign: 'left',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        },
        {
          id: 'tpl_2c_left',
          type: 'text',
          position: { x: 80, y: 140, width: 540, height: 480, rotation: 0 },
          properties: {
            text: 'Left column content. Add your text, data, or bullet points here.',
            font: { family: 'Roboto', size: 20, color: '#333333', bold: false, italic: false, underline: false },
            textAlign: 'left',
            backgroundColor: '#F5F5F5',
            borderColor: '#E0E0E0',
            borderWidth: 1,
            borderRadius: 8,
            opacity: 1,
            padding: 16
          },
          children: []
        },
        {
          id: 'tpl_2c_right',
          type: 'text',
          position: { x: 660, y: 140, width: 540, height: 480, rotation: 0 },
          properties: {
            text: 'Right column content. Add your text, data, or bullet points here.',
            font: { family: 'Roboto', size: 20, color: '#333333', bold: false, italic: false, underline: false },
            textAlign: 'left',
            backgroundColor: '#F5F5F5',
            borderColor: '#E0E0E0',
            borderWidth: 1,
            borderRadius: 8,
            opacity: 1,
            padding: 16
          },
          children: []
        }
      ]
    }
  },
  {
    id: 'builtin_image_focus',
    name: 'Image Focus',
    slideData: {
      id: 'tpl_image_focus',
      title: 'Image Focus',
      background: '#212121',
      visible: true,
      hideShell: false,
      elements: [
        {
          id: 'tpl_if_placeholder',
          type: 'shape',
          position: { x: 140, y: 60, width: 1000, height: 520, rotation: 0 },
          properties: {
            shapeType: 'rectangle',
            fillColor: '#333333',
            strokeColor: '#555555',
            strokeWidth: 2,
            borderRadius: 8,
            opacity: 1
          },
          children: []
        },
        {
          id: 'tpl_if_caption',
          type: 'text',
          position: { x: 140, y: 610, width: 1000, height: 50, rotation: 0 },
          properties: {
            text: 'Image caption or description',
            font: { family: 'Roboto', size: 18, color: '#BDBDBD', bold: false, italic: true, underline: false },
            textAlign: 'center',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            padding: 10
          },
          children: []
        }
      ]
    }
  }
];

const TemplateManager = {
  state: {
    userTemplates: [],
    searchQuery: ''
  },

  /**
   * Initialize the Template Manager
   */
  init: async function() {
    this.renderOverlay();
    this.bindGlobalEvents();
  },

  /**
   * Render the modal overlay into the DOM
   */
  renderOverlay: function() {
    if (document.getElementById('template-manager-overlay')) return;

    const html = `
      <div id="template-manager-overlay">
        <div id="template-manager-window">
          <div class="tm-header">
            <div class="tm-title-group">
              <h2>Templates <span class="tm-count" id="tm-total-count">0</span></h2>
            </div>
            <div class="tm-controls">
              <div class="tm-search-bar">
                <i class="material-icons">search</i>
                <input type="text" id="tm-search-input" placeholder="Search templates...">
              </div>
              <button class="btn-tm-icon" id="btn-tm-close"><i class="material-icons">close</i></button>
            </div>
          </div>
          <div class="tm-body">
            <div class="tm-content" id="tm-content-area">
              <!-- Grid injected here -->
            </div>
          </div>
        </div>
      </div>
      <div id="tm-context-menu"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  /**
   * Bind global event listeners for the modal
   */
  bindGlobalEvents: function() {
    const closeBtn = document.getElementById('btn-tm-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    const searchInput = document.getElementById('tm-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.state.searchQuery = e.target.value;
        this.refresh();
      };
    }

    // Dismiss context menu on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#tm-context-menu')) {
        const menu = document.getElementById('tm-context-menu');
        if (menu) menu.style.display = 'none';
      }
    });
  },

  /**
   * Open the Template Manager modal
   */
  open: async function() {
    document.getElementById('template-manager-overlay').classList.add('active');
    // Reset search
    const searchInput = document.getElementById('tm-search-input');
    if (searchInput) searchInput.value = '';
    this.state.searchQuery = '';
    await this.refresh();
  },

  /**
   * Close the Template Manager modal
   */
  close: function() {
    document.getElementById('template-manager-overlay').classList.remove('active');
  },

  /**
   * Refresh the template list from IndexedDB and re-render
   */
  refresh: async function() {
    try {
      this.state.userTemplates = await TemplatesDB.getAll();
    } catch (e) {
      console.error('Failed to load user templates:', e);
      this.state.userTemplates = [];
    }
    this.renderGrid();
  },

  /**
   * Render the grid of template cards
   */
  renderGrid: function() {
    const grid = document.getElementById('tm-content-area');
    const totalCount = document.getElementById('tm-total-count');
    if (!grid) return;

    const query = this.state.searchQuery.toLowerCase();

    // Filter built-in templates
    const filteredBuiltin = BUILTIN_TEMPLATES.filter(t =>
      !query || t.name.toLowerCase().includes(query)
    );

    // Filter user templates
    const filteredUser = this.state.userTemplates.filter(t =>
      !query || t.name.toLowerCase().includes(query)
    );

    const total = filteredBuiltin.length + filteredUser.length;
    if (totalCount) totalCount.innerText = total;

    let html = '';

    // Built-in Templates section
    if (filteredBuiltin.length > 0) {
      html += `
        <div class="tm-section-group">
          <div class="tm-section-header">Built-in Templates <span>(${filteredBuiltin.length})</span></div>
          <div class="tm-grid">
            ${filteredBuiltin.map(t => this.renderBuiltinCard(t)).join('')}
          </div>
        </div>
      `;
    }

    // User Templates section
    if (filteredUser.length > 0) {
      html += `
        <div class="tm-section-group">
          <div class="tm-section-header">My Templates <span>(${filteredUser.length})</span></div>
          <div class="tm-grid">
            ${filteredUser.map(t => this.renderUserCard(t)).join('')}
          </div>
        </div>
      `;
    }

    // Empty state
    if (total === 0 && query) {
      html = `
        <div class="tm-empty">
          <i class="material-icons">search_off</i>
          <p>No templates match your search.</p>
        </div>
      `;
    } else if (filteredUser.length === 0 && !query) {
      // Show hint if no user templates yet (built-in are always shown)
      html += `
        <div class="tm-section-group">
          <div class="tm-section-header">My Templates <span>(0)</span></div>
          <div class="tm-empty">
            <i class="material-icons">bookmark_border</i>
            <p>No saved templates yet. Use the <strong>+</strong> button on slide thumbnails to save one.</p>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  },

  /**
   * Render a built-in template card
   * @param {Object} template - Built-in template object
   * @returns {string} HTML string
   */
  renderBuiltinCard: function(template) {
    const preview = this._renderSlidePreviewHTML(template.slideData);

    return `
      <div class="tm-card tm-card-builtin" onclick="TemplateManager.useTemplate('${template.id}', true)">
        <div class="tm-card-preview">
          ${preview}
          <div class="tm-card-actions">
            <button class="btn-tm-action" onclick="event.stopPropagation(); TemplateManager.useTemplate('${template.id}', true)">
              <i class="material-icons">add</i> Use
            </button>
          </div>
        </div>
        <div class="tm-card-info">
          <div class="tm-card-title">${template.name} <span class="tm-badge-builtin">BUILT-IN</span></div>
        </div>
      </div>
    `;
  },

  /**
   * Render a user-saved template card
   * @param {Object} template - User template object
   * @returns {string} HTML string
   */
  renderUserCard: function(template) {
    const preview = this._renderSlidePreviewHTML(template.slideData);
    const date = new Date(template.createdAt || 0);
    const dateStr = date.toLocaleDateString();

    return `
      <div class="tm-card" onclick="TemplateManager.useTemplate('${template.id}', false)"
           oncontextmenu="TemplateManager.showContextMenu(event, '${template.id}')">
        <div class="tm-card-preview">
          ${preview}
          <button class="tm-card-delete" onclick="event.stopPropagation(); TemplateManager.deleteTemplate('${template.id}')" title="Delete template">
            <i class="material-icons">delete</i>
          </button>
          <div class="tm-card-actions">
            <button class="btn-tm-action" onclick="event.stopPropagation(); TemplateManager.useTemplate('${template.id}', false)">
              <i class="material-icons">add</i> Use
            </button>
          </div>
        </div>
        <div class="tm-card-info">
          <div class="tm-card-title" title="${template.name}">${template.name}</div>
          <div class="tm-card-meta">${dateStr}</div>
        </div>
      </div>
    `;
  },

  /**
   * Render a miniature slide preview as HTML
   * @param {Object} slideData - Slide JSON data
   * @returns {string} HTML string for the preview
   */
  _renderSlidePreviewHTML: function(slideData) {
    // Preview container is 240x140, slide is 1280x720
    const PREVIEW_WIDTH = 220;
    const SLIDE_WIDTH = 1280;
    const scale = PREVIEW_WIDTH / SLIDE_WIDTH; // ~0.17

    let elementsHTML = '';
    if (slideData.elements && slideData.elements.length > 0) {
      slideData.elements.forEach((el, idx) => {
        const pos = el.position || {};
        const props = el.properties || {};
        const left = (pos.x || 0) * scale;
        const top = (pos.y || 0) * scale;
        const width = (pos.width || 100) * scale;
        const height = (pos.height || 50) * scale;
        const rotation = pos.rotation || 0;

        let bg = 'rgba(200,200,200,0.3)';
        let textContent = '';
        let textColor = '#333';
        let fontSize = 3;

        if (el.type === 'shape') {
          bg = props.fillColor || '#ccc';
        } else if (el.type === 'text') {
          bg = props.backgroundColor && props.backgroundColor !== 'transparent'
            ? props.backgroundColor : 'transparent';
          textContent = (props.text || '').substring(0, 30);
          textColor = props.font?.color || '#333';
          fontSize = Math.max(2, (props.font?.size || 16) * scale);
        }

        elementsHTML += `<div class="tm-slide-preview-element" style="
          left:${left}px; top:${top}px; width:${width}px; height:${height}px;
          transform:rotate(${rotation}deg);
          background:${bg}; color:${textColor}; font-size:${fontSize}px;
          z-index:${idx}; overflow:hidden;
        ">${textContent}</div>`;
      });
    }

    return `<div class="tm-slide-preview" style="background:${slideData.background || '#fff'};">${elementsHTML}</div>`;
  },

  /**
   * Use a template to create a new slide
   * @param {string} id - Template ID
   * @param {boolean} isBuiltin - Whether the template is built-in
   */
  useTemplate: async function(id, isBuiltin) {
    let slideData;

    if (isBuiltin) {
      const tpl = BUILTIN_TEMPLATES.find(t => t.id === id);
      if (!tpl) return;
      slideData = JSON.parse(JSON.stringify(tpl.slideData));
    } else {
      const tpl = await TemplatesDB.get(id);
      if (!tpl) return;
      slideData = JSON.parse(JSON.stringify(tpl.slideData));
    }

    this.close();

    if (window.app && window.app.editor) {
      window.app.editor.addSlideFromTemplate(slideData);
    }
  },

  /**
   * Save a slide as a user template
   * @param {number} slideIndex - Index of the slide to save
   */
  saveSlideAsTemplate: async function(slideIndex) {
    if (!window.app || !window.app.editor) return;

    const presentation = window.app.editor.presentation;
    if (!presentation) return;

    const slide = presentation.slides[slideIndex];
    if (!slide) return;

    const name = await Dialog.prompt('Template name:', slide.title || 'My Template', 'Save Template');
    if (!name || !name.trim()) return;

    const template = {
      id: 'template_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      name: name.trim(),
      slideData: slide.toJSON(),
      createdAt: Date.now()
    };

    try {
      await TemplatesDB.save(template);
      M.toast({ html: 'Template saved', classes: 'green' });
    } catch (error) {
      console.error('Failed to save template:', error);
      M.toast({ html: 'Failed to save template', classes: 'red' });
    }
  },

  /**
   * Delete a user template
   * @param {string} id - Template ID
   */
  deleteTemplate: async function(id) {
    const confirmed = await Dialog.confirm('Delete this template permanently?', 'Delete Template');
    if (!confirmed) return;

    try {
      await TemplatesDB.delete(id);
      M.toast({ html: 'Template deleted', classes: 'green' });
      await this.refresh();
    } catch (error) {
      console.error('Failed to delete template:', error);
      M.toast({ html: 'Failed to delete template', classes: 'red' });
    }
  },

  /**
   * Rename a user template
   * @param {string} id - Template ID
   */
  renameTemplate: async function(id) {
    try {
      const tpl = await TemplatesDB.get(id);
      if (!tpl) return;

      const newName = await Dialog.prompt('Rename template:', tpl.name, 'Rename');
      if (!newName || !newName.trim()) return;

      await TemplatesDB.rename(id, newName.trim());
      M.toast({ html: 'Template renamed', classes: 'green' });
      await this.refresh();
    } catch (error) {
      console.error('Failed to rename template:', error);
      M.toast({ html: 'Failed to rename template', classes: 'red' });
    }
  },

  /**
   * Show context menu for a user template card
   * @param {MouseEvent} e - Mouse event
   * @param {string} id - Template ID
   */
  showContextMenu: function(e, id) {
    e.preventDefault();
    e.stopPropagation();

    const menu = document.getElementById('tm-context-menu');
    if (!menu) return;

    menu.style.top = e.clientY + 'px';
    menu.style.left = e.clientX + 'px';
    menu.style.display = 'block';

    menu.innerHTML = `
      <div class="tm-context-item" onclick="TemplateManager.useTemplate('${id}', false)">
        <i class="material-icons">add</i> Use
      </div>
      <div class="tm-context-item" onclick="TemplateManager.renameTemplate('${id}')">
        <i class="material-icons">edit</i> Rename
      </div>
      <div class="tm-context-separator"></div>
      <div class="tm-context-item" onclick="TemplateManager.deleteTemplate('${id}')">
        <i class="material-icons">delete</i> Delete
      </div>
    `;
  }
};

window.TemplateManager = TemplateManager;
