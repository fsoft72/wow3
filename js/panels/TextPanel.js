/**
 * Text Element Property Panel
 */

export class TextPanel {
  static render(element) {
    const props = element.properties;
    const font = props.font;

    return `
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="content">Content</button>
        <button class="panel-tab" data-tab="style">Style</button>
      </div>

      <div class="panel-tab-content active" data-tab-content="content">
        <div class="control-group">
          <label>Text Content</label>
          <textarea id="text-content" class="panel-textarea" rows="5">${props.text || ''}</textarea>
          <div class="placeholder-hint">
            Placeholders: <code>#SLIDE_TITLE#</code> <code>#SLIDE_NUMBER#</code> <code>#SLIDE_TOTAL#</code> <code>#NEXT_SLIDE#</code>
          </div>
        </div>
      </div>

      <div class="panel-tab-content" data-tab-content="style">
        <div class="control-group">
          <label>Font Family</label>
          <select id="font-family" class="panel-select">
            ${PanelUtils.fontFamilyOptions(font.family)}
          </select>
        </div>

        ${PanelUtils.renderSlider('Font Size', 'font-size', font.size, 8, 144, 1, 'px')}

        ${PanelUtils.renderColorPicker('Text Color', 'font-color', font.color)}

        <div class="control-group">
          <label>Font Weight</label>
          <select id="font-weight" class="panel-select">
            <option value="300" ${font.weight === '300' ? 'selected' : ''}>Light</option>
            <option value="normal" ${font.weight === 'normal' || font.weight === '400' ? 'selected' : ''}>Normal</option>
            <option value="bold" ${font.weight === 'bold' || font.weight === '700' ? 'selected' : ''}>Bold</option>
            <option value="900" ${font.weight === '900' ? 'selected' : ''}>Black</option>
          </select>
        </div>

        <div class="control-group">
          <label>Font Style</label>
          <select id="font-style" class="panel-select">
            <option value="normal" ${font.style === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="italic" ${font.style === 'italic' ? 'selected' : ''}>Italic</option>
          </select>
        </div>

        <div class="control-group">
          <label>Text Decoration</label>
          <select id="font-decoration" class="panel-select">
            <option value="none" ${font.decoration === 'none' ? 'selected' : ''}>None</option>
            <option value="underline" ${font.decoration === 'underline' ? 'selected' : ''}>Underline</option>
            <option value="line-through" ${font.decoration === 'line-through' ? 'selected' : ''}>Line Through</option>
          </select>
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
            <button class="icon-toggle-btn ${font.alignment === 'justify' ? 'active' : ''}" data-value="justify">
              <i class="material-icons">format_align_justify</i>
            </button>
          </div>
        </div>

        <div class="control-group">
          <label>Vertical Alignment</label>
          <div class="icon-toggle-group" id="vertical-alignment">
            <button class="icon-toggle-btn ${font.verticalAlign === 'top' ? 'active' : ''}" data-value="top">
              <i class="material-icons">vertical_align_top</i>
            </button>
            <button class="icon-toggle-btn ${font.verticalAlign === 'middle' ? 'active' : ''}" data-value="middle">
              <i class="material-icons">vertical_align_center</i>
            </button>
            <button class="icon-toggle-btn ${font.verticalAlign === 'bottom' ? 'active' : ''}" data-value="bottom">
              <i class="material-icons">vertical_align_bottom</i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static bindEvents(element) {
    const updateProperty = (path, value) => {
      window.app.editor.elementController.updateElementProperty(path, value);
    };

    // Tab switching
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
        if (content) content.classList.add('active');
      });
    });

    // Content
    const textContent = document.getElementById('text-content');
    if (textContent) {
      textContent.addEventListener('change', (e) => {
        updateProperty('properties.text', e.target.value);
      });
    }

    // Font family
    const fontFamily = document.getElementById('font-family');
    if (fontFamily) {
      fontFamily.addEventListener('change', (e) => {
        updateProperty('properties.font.family', e.target.value);
      });
    }

    // Font size slider
    PanelUtils.bindSlider('font-size', (value) => {
      updateProperty('properties.font.size', parseInt(value));
    });

    // Font color
    PanelUtils.bindColorPicker('font-color', (value) => {
      updateProperty('properties.font.color', value);
    });

    // Font weight
    const fontWeight = document.getElementById('font-weight');
    if (fontWeight) {
      fontWeight.addEventListener('change', (e) => {
        updateProperty('properties.font.weight', e.target.value);
      });
    }

    // Font style
    const fontStyle = document.getElementById('font-style');
    if (fontStyle) {
      fontStyle.addEventListener('change', (e) => {
        updateProperty('properties.font.style', e.target.value);
      });
    }

    // Font decoration
    const fontDecoration = document.getElementById('font-decoration');
    if (fontDecoration) {
      fontDecoration.addEventListener('change', (e) => {
        updateProperty('properties.font.decoration', e.target.value);
      });
    }

    // Text alignment
    const alignmentGroup = document.getElementById('text-alignment');
    if (alignmentGroup) {
      alignmentGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;

        alignmentGroup.querySelectorAll('.icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.alignment', btn.dataset.value);
      });
    }

    // Vertical alignment
    const vAlignGroup = document.getElementById('vertical-alignment');
    if (vAlignGroup) {
      vAlignGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;

        vAlignGroup.querySelectorAll('.icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.verticalAlign', btn.dataset.value);
      });
    }
  }
}

export default TextPanel;
