/**
 * AIGenerator: Two-step overlay for AI-powered presentation generation.
 * Step 1: User enters a prompt describing the desired presentation.
 * Step 2: Review and edit generated slides before creating them.
 * Follows the SlideImporter singleton pattern.
 */

const AIGenerator = {
  state: {
    step: 'prompt',            // 'prompt' | 'review'
    userPrompt: '',
    generatedSlides: [],       // AI-generated slide data (editable)
    isGenerating: false
  },

  /**
   * Initialize the AIGenerator overlay and bind global events.
   */
  init: function () {
    this._renderOverlay();
    this._bindGlobalEvents();
  },

  /**
   * Render the overlay DOM structure into the document body.
   */
  _renderOverlay: function () {
    if (document.getElementById('ai-generator-overlay')) return;

    const html = `
      <div id="ai-generator-overlay">
        <div id="ai-generator-window">
          <div class="aig-header" id="aig-header">
            <h2><i class="material-icons">auto_awesome</i> Generate with AI</h2>
            <button class="btn-aig-close" id="btn-aig-close"><i class="material-icons">close</i></button>
          </div>
          <div class="aig-body" id="aig-body">
            <!-- Content injected per step -->
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  /**
   * Bind global event listeners (close, escape key).
   */
  _bindGlobalEvents: function () {
    document.getElementById('ai-generator-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'ai-generator-overlay') this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const overlay = document.getElementById('ai-generator-overlay');
        if (overlay && overlay.classList.contains('active')) {
          if (this.state.step === 'review') {
            this._showPromptStep();
          } else {
            this.close();
          }
        }
      }
    });
  },

  /**
   * Open the AI Generator overlay.
   */
  open: function () {
    const overlay = document.getElementById('ai-generator-overlay');
    overlay.classList.add('active');

    if (!window.AIService || !AIService.isConfigured()) {
      this._showNotConfigured();
      return;
    }

    if (this.state.step === 'review' && this.state.generatedSlides.length > 0) {
      this._showReviewStep();
    } else {
      this._showPromptStep();
    }
  },

  /**
   * Close the AI Generator overlay.
   */
  close: function () {
    document.getElementById('ai-generator-overlay').classList.remove('active');
  },

  /**
   * Show the "not configured" state directing users to Settings > AI.
   */
  _showNotConfigured: function () {
    const body = document.getElementById('aig-body');
    body.innerHTML = `
      <div class="aig-not-configured">
        <i class="material-icons">smart_toy</i>
        <p>AI is not configured yet. Go to <b>Settings &gt; AI</b> to select a provider, enter your API key, and choose a model.</p>
        <button class="btn-aig-settings" id="btn-aig-open-settings">
          <i class="material-icons">settings</i> Open Settings
        </button>
      </div>
    `;

    document.getElementById('btn-aig-open-settings').addEventListener('click', () => {
      this.close();
      if (window.app && window.app.settingsController) {
        window.app.settingsController.showPanel();
        window.app.settingsController.switchTab('ai');
      }
    });
  },

  /**
   * Render Step 1: the prompt input.
   */
  _showPromptStep: function () {
    this.state.step = 'prompt';
    const body = document.getElementById('aig-body');

    body.innerHTML = `
      <div class="aig-prompt-step">
        <label class="aig-prompt-label">Describe the presentation you want to create:</label>
        <textarea class="aig-prompt-textarea" id="aig-prompt-input"
          placeholder="e.g. A 5-slide presentation about renewable energy sources, covering solar, wind, hydro power, with a professional blue color scheme..."
        >${this._escapeHtml(this.state.userPrompt)}</textarea>
        <div class="aig-prompt-actions">
          <button class="btn-aig-generate" id="btn-aig-generate">
            <i class="material-icons">auto_awesome</i> Generate
          </button>
        </div>
      </div>
    `;

    const promptInput = document.getElementById('aig-prompt-input');
    promptInput.focus();

    // Save prompt text as user types
    promptInput.addEventListener('input', () => {
      this.state.userPrompt = promptInput.value;
    });

    document.getElementById('btn-aig-generate').addEventListener('click', () => {
      this._generate();
    });

    // Ctrl+Enter to generate
    promptInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this._generate();
      }
    });
  },

  /**
   * Run the AI generation: show loading, call AIService, transition to review.
   */
  _generate: async function () {
    const prompt = this.state.userPrompt.trim();
    if (!prompt) return;
    if (this.state.isGenerating) return;

    this.state.isGenerating = true;
    const body = document.getElementById('aig-body');

    // Show loading
    body.innerHTML = `
      <div class="aig-loading">
        <div class="aig-spinner"></div>
        <span class="aig-loading-text">Generating your presentation...</span>
      </div>
    `;

    try {
      const result = await AIService.generateSlides(prompt);
      this.state.generatedSlides = result.slides || [];
      this.state.step = 'review';
      this._showReviewStep();
    } catch (err) {
      console.error('AI generation failed:', err);
      // Return to prompt with error
      this._showPromptStep();
      const body2 = document.getElementById('aig-body');
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'color: #ef5350; padding: 0 30px 10px; font-size: 13px;';
      errDiv.textContent = 'Generation failed: ' + err.message;
      body2.querySelector('.aig-prompt-step').prepend(errDiv);
    } finally {
      this.state.isGenerating = false;
    }
  },

  /**
   * Render Step 2: the review/edit list.
   */
  _showReviewStep: function () {
    this.state.step = 'review';
    const body = document.getElementById('aig-body');
    const slideCount = this.state.generatedSlides.length;

    body.innerHTML = `
      <div class="aig-review-step">
        <div class="aig-review-toolbar">
          <span class="aig-review-count">${slideCount} slide${slideCount !== 1 ? 's' : ''} generated</span>
          <span class="aig-toolbar-spacer"></span>
          <button class="btn-aig-tool" id="btn-aig-clear">
            <i class="material-icons" style="font-size:16px;vertical-align:middle;">refresh</i> Clear All
          </button>
          <button class="btn-aig-create" id="btn-aig-create">
            <i class="material-icons">add_circle</i> Generate Presentation
          </button>
        </div>
        <div class="aig-review-list" id="aig-review-list">
          <!-- Slide cards injected here -->
        </div>
      </div>
    `;

    this._renderSlideCards();

    document.getElementById('btn-aig-clear').addEventListener('click', () => {
      this.state.generatedSlides = [];
      this._showPromptStep();
    });

    document.getElementById('btn-aig-create').addEventListener('click', () => {
      this._createSlides();
    });
  },

  /**
   * Render all slide cards into the review list.
   */
  _renderSlideCards: function () {
    const list = document.getElementById('aig-review-list');
    if (!list) return;

    list.innerHTML = this.state.generatedSlides.map((slide, idx) =>
      this._renderSlideCard(slide, idx)
    ).join('');

    this._bindCardEvents();
  },

  /**
   * Render a single slide card HTML.
   * @param {Object} slide - Generated slide data
   * @param {number} index - Slide index
   * @returns {string} HTML string
   */
  _renderSlideCard: function (slide, index) {
    const total = this.state.generatedSlides.length;

    let elementsHTML = '';
    if (slide.elements && slide.elements.length > 0) {
      slide.elements.forEach((el, elIdx) => {
        if (el.type === 'text') {
          elementsHTML += `
            <div class="aig-element-row" data-slide-idx="${index}" data-el-idx="${elIdx}">
              <span class="aig-element-badge">${el.role || 'text'}</span>
              <div class="aig-element-content">
                <textarea class="aig-element-textarea aig-edit-text" data-slide-idx="${index}" data-el-idx="${elIdx}"
                  rows="2">${this._escapeHtml(el.content || '')}</textarea>
              </div>
            </div>`;
        } else if (el.type === 'list') {
          const itemsText = (el.items || []).join('\n');
          elementsHTML += `
            <div class="aig-element-row" data-slide-idx="${index}" data-el-idx="${elIdx}">
              <span class="aig-element-badge">${el.listType || 'list'}</span>
              <div class="aig-element-content">
                <textarea class="aig-element-textarea aig-edit-list" data-slide-idx="${index}" data-el-idx="${elIdx}"
                  rows="${Math.min(6, (el.items || []).length + 1)}">${this._escapeHtml(itemsText)}</textarea>
                <div class="aig-element-summary">${(el.items || []).length} items (one per line)</div>
              </div>
            </div>`;
        } else if (el.type === 'shape') {
          elementsHTML += `
            <div class="aig-element-row">
              <span class="aig-element-badge">shape</span>
              <div class="aig-element-content">
                <span class="aig-element-summary">${el.shapeType || 'rectangle'} — ${el.fillColor || '#ccc'}</span>
              </div>
            </div>`;
        }
      });
    }

    return `
      <div class="aig-slide-card" data-slide-idx="${index}">
        <div class="aig-card-header">
          <div class="aig-card-number">${index + 1}</div>
          <input type="text" class="aig-card-title-input aig-edit-title" data-slide-idx="${index}"
            value="${this._escapeAttr(slide.title || 'Untitled Slide')}">
          <div class="aig-card-actions">
            <button title="Move up" class="aig-move-up" data-slide-idx="${index}" ${index === 0 ? 'disabled' : ''}>
              <i class="material-icons">arrow_upward</i>
            </button>
            <button title="Move down" class="aig-move-down" data-slide-idx="${index}" ${index >= total - 1 ? 'disabled' : ''}>
              <i class="material-icons">arrow_downward</i>
            </button>
            <button title="Delete slide" class="aig-delete-btn" data-slide-idx="${index}">
              <i class="material-icons">delete</i>
            </button>
          </div>
        </div>
        <div class="aig-card-body">
          ${elementsHTML || '<span class="aig-element-summary">No elements</span>'}
        </div>
      </div>
    `;
  },

  /**
   * Bind event listeners on all slide card controls.
   */
  _bindCardEvents: function () {
    // Title edits
    document.querySelectorAll('.aig-edit-title').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.slideIdx);
        if (this.state.generatedSlides[idx]) {
          this.state.generatedSlides[idx].title = e.target.value;
        }
      });
    });

    // Text element edits
    document.querySelectorAll('.aig-edit-text').forEach(textarea => {
      textarea.addEventListener('change', (e) => {
        const sIdx = parseInt(e.target.dataset.slideIdx);
        const eIdx = parseInt(e.target.dataset.elIdx);
        const el = this.state.generatedSlides[sIdx]?.elements?.[eIdx];
        if (el) el.content = e.target.value;
      });
    });

    // List element edits
    document.querySelectorAll('.aig-edit-list').forEach(textarea => {
      textarea.addEventListener('change', (e) => {
        const sIdx = parseInt(e.target.dataset.slideIdx);
        const eIdx = parseInt(e.target.dataset.elIdx);
        const el = this.state.generatedSlides[sIdx]?.elements?.[eIdx];
        if (el) {
          el.items = e.target.value.split('\n').filter(line => line.trim() !== '');
        }
      });
    });

    // Move up
    document.querySelectorAll('.aig-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.slideIdx);
        if (idx <= 0) return;
        const slides = this.state.generatedSlides;
        [slides[idx - 1], slides[idx]] = [slides[idx], slides[idx - 1]];
        this._renderSlideCards();
        this._updateToolbarCount();
      });
    });

    // Move down
    document.querySelectorAll('.aig-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.slideIdx);
        const slides = this.state.generatedSlides;
        if (idx >= slides.length - 1) return;
        [slides[idx], slides[idx + 1]] = [slides[idx + 1], slides[idx]];
        this._renderSlideCards();
        this._updateToolbarCount();
      });
    });

    // Delete
    document.querySelectorAll('.aig-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.slideIdx);
        this.state.generatedSlides.splice(idx, 1);
        if (this.state.generatedSlides.length === 0) {
          this._showPromptStep();
        } else {
          this._renderSlideCards();
          this._updateToolbarCount();
        }
      });
    });
  },

  /**
   * Update the slide count in the review toolbar.
   */
  _updateToolbarCount: function () {
    const countEl = document.querySelector('.aig-review-count');
    if (!countEl) return;
    const n = this.state.generatedSlides.length;
    countEl.textContent = `${n} slide${n !== 1 ? 's' : ''} generated`;
  },

  /**
   * Create actual WOW3 slides from the reviewed AI data and import them.
   */
  _createSlides: async function () {
    if (this.state.generatedSlides.length === 0) return;
    if (!window.AIService || !window.app?.editor) return;

    const slidesJSON = this.state.generatedSlides.map(
      (s) => AIService.convertToSlideJSON(s)
    );

    this.close();

    await window.app.editor.importSlidesFromPresentation(slidesJSON);

    // Reset state for next use
    this.state.generatedSlides = [];
    this.state.step = 'prompt';
  },

  /**
   * Escape HTML special characters.
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  _escapeHtml: function (str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /**
   * Escape a string for use in an HTML attribute value.
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  _escapeAttr: function (str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

window.AIGenerator = AIGenerator;
