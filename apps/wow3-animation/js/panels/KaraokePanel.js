/**
 * Karaoke Element Property Panel.
 * Style-only panel: font settings, text color (solid), highlight color (gradient).
 */
export class KaraokePanel {
  /**
   * @param {import('@wow/core/models/Element.js').Element} element
   * @returns {string} HTML
   */
  static render(element) {
    const font = element.properties.font || {};
    const colorPrev = element.properties.colorPrev || '#888888';
    const colorCurrent = element.properties.colorCurrent || '#ff9800';

    return `
      <div class="control-group">
        <label>Font Family</label>
        ${PanelUtils.renderFontFamilyPicker('font-family', font.family)}
      </div>

      ${PanelUtils.renderSlider('Font Size', 'font-size', font.size, 8, 144, 1, 'px')}

      ${PanelUtils.renderColorPicker('Text Color', 'karaoke-text-color', colorPrev)}

      ${PanelUtils.renderGradientPicker('Highlight Color', 'karaoke-highlight-gradient-selector', colorCurrent)}

      <div class="control-group">
        <label>Text Style</label>
        <div class="icon-toggle-row">
          <div class="icon-toggle-group" id="font-weight">
            <button class="icon-toggle-btn ${font.weight === '300' ? 'active' : ''}" data-value="300" title="Light">
              <span class="weight-preview" style="font-weight:300">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === 'normal' || font.weight === '400' || (!font.weight || font.weight === '') ? 'active' : ''}" data-value="normal" title="Normal">
              <span class="weight-preview" style="font-weight:400">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === 'bold' || font.weight === '700' ? 'active' : ''}" data-value="bold" title="Bold">
              <span class="weight-preview" style="font-weight:700">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === '900' ? 'active' : ''}" data-value="900" title="Black">
              <span class="weight-preview" style="font-weight:900">A</span>
            </button>
          </div>
          <div class="icon-toggle-group" id="font-style">
            <button class="icon-toggle-btn ${font.style === 'italic' ? 'active' : ''}" data-value="italic" title="Italic">
              <i class="material-icons">format_italic</i>
            </button>
          </div>
        </div>
      </div>

      <div class="control-group">
        <label>Horizontal Alignment</label>
        <div class="icon-toggle-group" id="text-alignment">
          <button class="icon-toggle-btn ${font.alignment === 'left' ? 'active' : ''}" data-value="left">
            <i class="material-icons">format_align_left</i>
          </button>
          <button class="icon-toggle-btn ${font.alignment === 'center' ? 'active' : ''}" data-value="center">
            <i class="material-icons">format_align_center</i>
          </button>
          <button class="icon-toggle-btn ${font.alignment === 'right' ? 'active' : ''}" data-value="right">
            <i class="material-icons">format_align_right</i>
          </button>
        </div>
      </div>

      <div class="control-group">
        <label>
          <input type="checkbox" id="shadow-enabled" ${font.shadow?.enabled ? 'checked' : ''} />
          <span>Text Shadow</span>
        </label>
        <div id="shadow-options" style="display:${font.shadow?.enabled ? 'block' : 'none'}; margin-top:8px;">
          ${PanelUtils.renderColorPicker('Color', 'shadow-color', font.shadow?.color || '#000000')}
          ${PanelUtils.renderSlider('Offset X', 'shadow-offset-x', font.shadow?.offsetX ?? 2, -20, 20, 1, 'px')}
          ${PanelUtils.renderSlider('Offset Y', 'shadow-offset-y', font.shadow?.offsetY ?? 2, -20, 20, 1, 'px')}
          ${PanelUtils.renderSlider('Blur', 'shadow-blur', font.shadow?.blur ?? 4, 0, 30, 1, 'px')}
        </div>
      </div>

      <div class="control-group">
        <label>
          <input type="checkbox" id="stroke-enabled" ${font.stroke?.enabled ? 'checked' : ''} />
          <span>Text Stroke</span>
        </label>
        <div id="stroke-options" style="display:${font.stroke?.enabled ? 'block' : 'none'}; margin-top:8px;">
          ${PanelUtils.renderColorPicker('Color', 'stroke-color', font.stroke?.color || '#000000')}
          ${PanelUtils.renderSlider('Width', 'stroke-width', font.stroke?.width ?? 1, 0.5, 10, 0.5, 'px')}
        </div>
      </div>
    `;
  }

  /**
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  static bindEvents(element) {
    const updateProperty = (path, value) => {
      window.app.editor.elementController.updateElementProperty(path, value);
    };

    // Font family
    PanelUtils.bindFontFamilyPicker('font-family', (value) => {
      updateProperty('properties.font.family', value);
    });

    // Font size
    PanelUtils.bindSlider('font-size', (value) => {
      updateProperty('properties.font.size', parseInt(value));
    });

    // Text color (solid — for prev/next lines)
    PanelUtils.bindColorPicker('karaoke-text-color', (value) => {
      updateProperty('properties.colorPrev', value);
      updateProperty('properties.colorNext', value);
    });

    // Highlight color (gradient — for current line)
    PanelUtils.bindGradientPicker('karaoke-highlight-gradient-selector', element.properties.colorCurrent, (value) => {
      updateProperty('properties.colorCurrent', value);
    });

    // Font weight
    document.querySelectorAll('#font-weight .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#font-weight .icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.weight', btn.dataset.value);
      });
    });

    // Font style (italic)
    document.querySelectorAll('#font-style .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.classList.toggle('active');
        updateProperty('properties.font.style', isActive ? 'italic' : 'normal');
      });
    });

    // Alignment
    document.querySelectorAll('#text-alignment .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#text-alignment .icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.alignment', btn.dataset.value);
      });
    });

    // Shadow
    const shadowCheck = document.getElementById('shadow-enabled');
    const shadowOpts = document.getElementById('shadow-options');
    shadowCheck?.addEventListener('change', () => {
      updateProperty('properties.font.shadow.enabled', shadowCheck.checked);
      if (shadowOpts) shadowOpts.style.display = shadowCheck.checked ? 'block' : 'none';
    });
    PanelUtils.bindColorPicker('shadow-color', (v) => updateProperty('properties.font.shadow.color', v));
    PanelUtils.bindSlider('shadow-offset-x', (v) => updateProperty('properties.font.shadow.offsetX', parseFloat(v)));
    PanelUtils.bindSlider('shadow-offset-y', (v) => updateProperty('properties.font.shadow.offsetY', parseFloat(v)));
    PanelUtils.bindSlider('shadow-blur', (v) => updateProperty('properties.font.shadow.blur', parseFloat(v)));

    // Stroke
    const strokeCheck = document.getElementById('stroke-enabled');
    const strokeOpts = document.getElementById('stroke-options');
    strokeCheck?.addEventListener('change', () => {
      updateProperty('properties.font.stroke.enabled', strokeCheck.checked);
      if (strokeOpts) strokeOpts.style.display = strokeCheck.checked ? 'block' : 'none';
    });
    PanelUtils.bindColorPicker('stroke-color', (v) => updateProperty('properties.font.stroke.color', v));
    PanelUtils.bindSlider('stroke-width', (v) => updateProperty('properties.font.stroke.width', parseFloat(v)));
  }
}
