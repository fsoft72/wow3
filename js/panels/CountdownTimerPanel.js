/**
 * Countdown Timer Element Property Panel
 * Provides Content (duration, sound, clear) and Style (font, background, border) tabs.
 */

import { FONT_FAMILIES } from '../utils/constants.js';

export class CountdownTimerPanel {
  /**
   * Render the panel HTML for the given countdown timer element
   * @param {import('../models/CountdownTimerElement.js').CountdownTimerElement} element
   * @returns {string} HTML string
   */
  static render(element) {
    const props = element.properties;
    const minutes = Math.floor(props.duration / 60);
    const seconds = props.duration % 60;
    const isClear = props.clear;

    const fontFamilyOptions = FONT_FAMILIES
      .map(f => `<option value="${f}" ${f === props.font.family ? 'selected' : ''}>${f}</option>`)
      .join('');

    return `
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="content">Content</button>
        <button class="panel-tab" data-tab="style">Style</button>
      </div>

      <div class="panel-tab-content active" data-tab-content="content">
        <div class="control-group">
          <label>Duration</label>
          <div class="duration-inputs" style="display:flex;gap:8px;align-items:center;">
            <div class="input-field" style="flex:1;margin:0;">
              <input type="number" id="ct-minutes" min="0" max="60" value="${minutes}" ${isClear ? 'disabled' : ''}>
              <label for="ct-minutes" class="active">Minutes</label>
            </div>
            <div class="input-field" style="flex:1;margin:0;">
              <input type="number" id="ct-seconds" min="0" max="59" value="${seconds}" ${isClear ? 'disabled' : ''}>
              <label for="ct-seconds" class="active">Seconds</label>
            </div>
          </div>
        </div>

        <div class="control-group">
          <label>Completion Sound</label>
          <div class="media-input-group">
            <input type="text" id="ct-sound-id" class="panel-input" value="${props.soundId || ''}" placeholder="Media ID or empty" ${isClear ? 'disabled' : ''}>
            <button id="ct-select-sound" class="btn-icon" title="Select from Media Library" ${isClear ? 'disabled' : ''}>
              <i class="material-icons">photo_library</i>
            </button>
          </div>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="ct-clear" class="filled-in" ${isClear ? 'checked' : ''}>
            <span>Clear timer (stops any active countdown)</span>
          </label>
        </div>
      </div>

      <div class="panel-tab-content" data-tab-content="style">
        <div class="control-group">
          <div class="input-field">
            <select id="ct-font-family">${fontFamilyOptions}</select>
            <label class="active">Font Family</label>
          </div>
        </div>

        <div class="control-group">
          <label for="ct-font-size" class="active">Font Size: <span id="ct-font-size-val">${props.font.size}</span></label>
          <input type="range" id="ct-font-size" min="8" max="200" value="${props.font.size}">
        </div>

        <div class="control-group">
          <div class="input-field">
            <input type="color" id="ct-font-color" value="${props.font.color}">
            <label for="ct-font-color" class="active">Font Color</label>
          </div>
        </div>

        <div class="control-group">
          <div class="input-field">
            <input type="color" id="ct-background" value="${props.background}">
            <label for="ct-background" class="active">Background Color</label>
          </div>
        </div>

        <div class="control-group">
          <div class="input-field">
            <input type="color" id="ct-border-color" value="${props.borderColor}">
            <label for="ct-border-color" class="active">Border Color</label>
          </div>
        </div>

        <div class="control-group">
          <label for="ct-border-width" class="active">Border Width: <span id="ct-border-width-val">${props.borderWidth}</span></label>
          <input type="range" id="ct-border-width" min="0" max="10" value="${props.borderWidth}">
        </div>

        <div class="control-group">
          <label for="ct-border-radius" class="active">Border Radius: <span id="ct-border-radius-val">${props.borderRadius}</span></label>
          <input type="range" id="ct-border-radius" min="0" max="50" value="${props.borderRadius}">
        </div>
      </div>
    `;
  }

  /**
   * Bind interactive events for the panel controls
   * @param {import('../models/CountdownTimerElement.js').CountdownTimerElement} element
   */
  static bindEvents(element) {
    const ec = window.app.editor.elementController;

    /** Update a property on the selected element only */
    const updateProperty = (path, value) => {
      ec.updateElementProperty(path, value);
    };

    /** Update a style property on the selected element AND sync to all other timers */
    const updateStyleProperty = (path, value) => {
      ec.updateElementProperty(path, value);
      ec.syncCountdownTimerStyle(path, value);
    };

    // --- Tab switching ---
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
        if (content) content.classList.add('active');
      });
    });

    // --- Duration ---
    const ctMinutes = document.getElementById('ct-minutes');
    const ctSeconds = document.getElementById('ct-seconds');

    const updateDuration = () => {
      const mins = parseInt(ctMinutes?.value || '0', 10);
      const secs = parseInt(ctSeconds?.value || '0', 10);
      updateProperty('properties.duration', mins * 60 + secs);
    };

    if (ctMinutes) ctMinutes.addEventListener('change', updateDuration);
    if (ctSeconds) ctSeconds.addEventListener('change', updateDuration);

    // --- Sound ID ---
    const ctSoundId = document.getElementById('ct-sound-id');
    if (ctSoundId) {
      ctSoundId.addEventListener('change', (e) => updateProperty('properties.soundId', e.target.value));
    }

    // --- Select sound from library ---
    const ctSelectSound = document.getElementById('ct-select-sound');
    if (ctSelectSound) {
      ctSelectSound.addEventListener('click', () => {
        if (typeof MediaManager === 'undefined') return;
        MediaManager.open((data) => {
          const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
          if (mediaId) {
            updateProperty('properties.soundId', mediaId);
            if (ctSoundId) ctSoundId.value = mediaId;
          }
        });
      });
    }

    // --- Clear checkbox ---
    const ctClear = document.getElementById('ct-clear');
    if (ctClear) {
      ctClear.addEventListener('change', (e) => {
        updateProperty('properties.clear', e.target.checked);

        // Disable/enable duration & sound fields
        const disabled = e.target.checked;
        [ctMinutes, ctSeconds, ctSoundId, ctSelectSound].forEach(el => {
          if (el) el.disabled = disabled;
        });
      });
    }

    // --- Style: Font family (global) ---
    const ctFontFamily = document.getElementById('ct-font-family');
    if (ctFontFamily) {
      ctFontFamily.addEventListener('change', (e) => updateStyleProperty('properties.font.family', e.target.value));
    }

    // --- Style: Font size slider (global) ---
    const ctFontSize = document.getElementById('ct-font-size');
    const ctFontSizeVal = document.getElementById('ct-font-size-val');
    if (ctFontSize) {
      ctFontSize.addEventListener('input', (e) => {
        if (ctFontSizeVal) ctFontSizeVal.textContent = e.target.value;
        updateStyleProperty('properties.font.size', parseInt(e.target.value, 10));
      });
    }

    // --- Style: Font color (global) ---
    const ctFontColor = document.getElementById('ct-font-color');
    if (ctFontColor) {
      ctFontColor.addEventListener('change', (e) => updateStyleProperty('properties.font.color', e.target.value));
    }

    // --- Style: Background (global) ---
    const ctBackground = document.getElementById('ct-background');
    if (ctBackground) {
      ctBackground.addEventListener('change', (e) => updateStyleProperty('properties.background', e.target.value));
    }

    // --- Style: Border color (global) ---
    const ctBorderColor = document.getElementById('ct-border-color');
    if (ctBorderColor) {
      ctBorderColor.addEventListener('change', (e) => updateStyleProperty('properties.borderColor', e.target.value));
    }

    // --- Style: Border width slider (global) ---
    const ctBorderWidth = document.getElementById('ct-border-width');
    const ctBorderWidthVal = document.getElementById('ct-border-width-val');
    if (ctBorderWidth) {
      ctBorderWidth.addEventListener('input', (e) => {
        if (ctBorderWidthVal) ctBorderWidthVal.textContent = e.target.value;
        updateStyleProperty('properties.borderWidth', parseInt(e.target.value, 10));
      });
    }

    // --- Style: Border radius slider (global) ---
    const ctBorderRadius = document.getElementById('ct-border-radius');
    const ctBorderRadiusVal = document.getElementById('ct-border-radius-val');
    if (ctBorderRadius) {
      ctBorderRadius.addEventListener('input', (e) => {
        if (ctBorderRadiusVal) ctBorderRadiusVal.textContent = e.target.value;
        updateStyleProperty('properties.borderRadius', parseInt(e.target.value, 10));
      });
    }

    // Initialize Materialize text fields
    setTimeout(() => {
      M.updateTextFields();
    }, 0);
  }
}

export default CountdownTimerPanel;
