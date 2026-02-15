/**
 * WOW3 Settings Controller
 * Manages the floating Settings panel with General and Theme tabs.
 * Follows the same pattern as AnimationEditorController.
 */

import { loadSettings, setSetting, getSetting, DEFAULT_SETTINGS } from '../utils/settings.js';

class SettingsController {
  /**
   * @param {Object} editorController - Reference to the main EditorController
   */
  constructor(editorController) {
    this.editor = editorController;
    this._panelVisible = false;
    this._activeTab = 'general';
    this._savedLeft = null;
    this._savedTop = null;
  }

  /**
   * Initialize the settings controller: cache DOM refs, attach handlers.
   */
  init() {
    this._panel = document.getElementById('settings-panel');
    this._toggleBtn = document.getElementById('settings-panel-btn');
    this._closeBtn = this._panel.querySelector('.settings-panel-close');
    this._tabButtons = this._panel.querySelectorAll('.settings-panel-tab');
    this._generalContent = document.getElementById('settings-tab-general');
    this._themeContent = document.getElementById('settings-tab-theme');

    // Toggle button in status bar
    this._toggleBtn.addEventListener('click', () => this.togglePanel());

    // Close button
    this._closeBtn.addEventListener('click', () => this.hidePanel());

    // Tab switching
    this._tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.settingsTab;
        if (tab) this.switchTab(tab);
      });
    });

    // Dragging
    this._initDrag();

    // Render initial tab contents
    this._renderGeneralTab();
    this._renderThemeTab();
  }

  /**
   * Toggle the settings panel open/closed.
   */
  togglePanel() {
    if (this._panelVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * Show the settings panel.
   */
  showPanel() {
    if (this._panelVisible) return;
    this._panelVisible = true;

    // Position: restore saved or center on screen
    if (this._savedLeft != null && this._savedTop != null) {
      this._panel.style.left = this._savedLeft + 'px';
      this._panel.style.top = this._savedTop + 'px';
    } else {
      const pw = 400;
      const ph = 420;
      this._panel.style.left = Math.round((window.innerWidth - pw) / 2) + 'px';
      this._panel.style.top = Math.round((window.innerHeight - ph) / 2) + 'px';
    }

    this._panel.classList.add('visible');
    this._toggleBtn.classList.add('active');

    // Refresh tab contents
    this._renderGeneralTab();
    this._renderThemeTab();
  }

  /**
   * Hide the settings panel.
   */
  hidePanel() {
    if (!this._panelVisible) return;
    this._panelVisible = false;

    // Save position
    this._savedLeft = parseInt(this._panel.style.left, 10);
    this._savedTop = parseInt(this._panel.style.top, 10);

    this._panel.classList.remove('visible');
    this._toggleBtn.classList.remove('active');
  }

  /**
   * Switch between "general" and "theme" tabs.
   * @param {string} tabName - "general" or "theme"
   */
  switchTab(tabName) {
    this._activeTab = tabName;

    // Update tab button active states
    this._tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
    });

    // Update content visibility
    this._generalContent.classList.toggle('active', tabName === 'general');
    this._themeContent.classList.toggle('active', tabName === 'theme');
  }

  /**
   * Initialize drag behavior on the panel header.
   */
  _initDrag() {
    const header = this._panel.querySelector('.settings-panel-header');
    let dragging = false;
    let startX, startY, panelStartX, panelStartY;

    const onPointerDown = (e) => {
      // Only drag from header, not from buttons
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      panelStartX = parseInt(this._panel.style.left, 10) || 0;
      panelStartY = parseInt(this._panel.style.top, 10) || 0;
      header.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = panelStartX + dx;
      let newTop = panelStartY + dy;

      // Clamp to viewport
      const rect = this._panel.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

      this._panel.style.left = newLeft + 'px';
      this._panel.style.top = newTop + 'px';
    };

    const onPointerUp = () => {
      dragging = false;
    };

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
  }

  /**
   * Render the General tab contents.
   */
  _renderGeneralTab() {
    const settings = loadSettings();
    const interval = settings.general.autosaveInterval;

    this._generalContent.innerHTML = `
      <div class="settings-form-group">
        <label class="settings-label">Autosave Interval</label>
        <div class="settings-row">
          <input type="number" id="settings-autosave-interval" class="settings-input"
            min="5" max="300" step="1" value="${interval}">
          <span class="settings-unit">seconds</span>
        </div>
        <span class="settings-helper">How often unsaved changes are auto-saved (5-300s)</span>
      </div>
    `;

    // Attach event listener
    const input = document.getElementById('settings-autosave-interval');
    input.addEventListener('change', () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 5) val = 5;
      if (val > 300) val = 300;
      input.value = val;
      setSetting('general.autosaveInterval', val);
      // Restart autosave timer
      if (window.app && window.app._startAutosave) {
        window.app._startAutosave();
      }
    });
  }

  /**
   * Render the Theme tab contents.
   */
  _renderThemeTab() {
    const settings = loadSettings();
    const theme = settings.theme;

    this._themeContent.innerHTML = `
      <div class="settings-form-group">
        <label class="settings-label">Appearance</label>
        <div class="settings-mode-toggle">
          <button class="settings-mode-btn ${theme.mode === 'light' ? 'active' : ''}" data-mode="light">
            <i class="material-icons">light_mode</i> Light
          </button>
          <button class="settings-mode-btn ${theme.mode === 'dark' ? 'active' : ''}" data-mode="dark">
            <i class="material-icons">dark_mode</i> Dark
          </button>
        </div>
      </div>

      <div class="settings-form-group">
        <label class="settings-label">Colors</label>
        ${this._renderColorRow('Navbar', 'navColor', theme.navColor)}
        ${this._renderColorRow('Buttons', 'buttonColor', theme.buttonColor)}
        ${this._renderColorRow('Panels', 'panelColor', theme.panelColor)}
      </div>
    `;

    // Mode toggle
    this._themeContent.querySelectorAll('.settings-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setSetting('theme.mode', mode);
        this._themeContent.querySelectorAll('.settings-mode-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === mode);
        });
        this.applyTheme();
      });
    });

    // Color pickers
    this._themeContent.querySelectorAll('.settings-color-row').forEach(row => {
      const key = row.dataset.colorKey;
      const colorInput = row.querySelector('input[type="color"]');
      const textInput = row.querySelector('input[type="text"]');
      const resetBtn = row.querySelector('.settings-color-reset');

      colorInput.addEventListener('input', () => {
        textInput.value = colorInput.value;
        setSetting(`theme.${key}`, colorInput.value);
        this.applyTheme();
      });

      textInput.addEventListener('change', () => {
        const val = textInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          colorInput.value = val;
          setSetting(`theme.${key}`, val);
          this.applyTheme();
        } else {
          // Revert to current value
          textInput.value = colorInput.value;
        }
      });

      resetBtn.addEventListener('click', () => {
        const defaultVal = DEFAULT_SETTINGS.theme[key];
        colorInput.value = defaultVal;
        textInput.value = defaultVal;
        setSetting(`theme.${key}`, defaultVal);
        this.applyTheme();
      });
    });
  }

  /**
   * Render a single color picker row.
   * @param {string} label - Display label
   * @param {string} key - Settings key (e.g. "navColor")
   * @param {string} value - Current hex color
   * @returns {string} HTML string
   */
  _renderColorRow(label, key, value) {
    return `
      <div class="settings-color-row" data-color-key="${key}">
        <span class="settings-color-label">${label}</span>
        <input type="color" value="${value}">
        <input type="text" value="${value}" maxlength="7" class="settings-color-text">
        <button class="settings-color-reset" title="Reset to default">
          <i class="material-icons">refresh</i>
        </button>
      </div>
    `;
  }

  /**
   * Apply the current theme settings to the page.
   * Sets CSS custom properties and toggles dark mode class.
   */
  applyTheme() {
    const settings = loadSettings();
    const theme = settings.theme;
    const root = document.documentElement;

    // Set CSS custom properties
    root.style.setProperty('--primary-nav', theme.navColor);
    root.style.setProperty('--primary-button', theme.buttonColor);
    root.style.setProperty('--primary-panel', theme.panelColor);

    // Apply nav color inline (overrides MaterializeCSS blue darken-2)
    const topMenu = document.getElementById('top-menu');
    if (topMenu) {
      topMenu.style.backgroundColor = theme.navColor;
    }

    // Apply button color to primary action buttons
    this._applyButtonColors(theme.buttonColor);

    // Dark mode toggle
    if (theme.mode === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  /**
   * Apply button color to primary action buttons.
   * @param {string} color - Hex color
   */
  _applyButtonColors(color) {
    const selectors = [
      '#add-slide-btn',
      '#open-media-manager',
    ];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.backgroundColor = color;
    });
  }
}

export { SettingsController };
