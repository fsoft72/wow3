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
            <code class="placeholder-tag" data-placeholder="#SLIDE_TITLE#">#SLIDE_TITLE#</code>
            <code class="placeholder-tag" data-placeholder="#SLIDE_NUMBER#">#SLIDE_NUMBER#</code>
            <code class="placeholder-tag" data-placeholder="#SLIDE_TOTAL#">#SLIDE_TOTAL#</code>
            <code class="placeholder-tag" data-placeholder="#NEXT_SLIDE#">#NEXT_SLIDE#</code>
          </div>
        </div>

        <div class="section-title">Image Fill</div>
        <div id="text-bg-image-selector"></div>

        <div class="control-group" id="bg-direction-group" style="display:${props.backgroundImage?.url ? 'block' : 'none'}">
          <label>Movement Direction</label>
          <div class="direction-grid" id="bg-direction-grid">
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'up-left' ? 'active' : ''}" data-direction="up-left" title="Up-Left">
              <i class="material-icons">north_west</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'up' ? 'active' : ''}" data-direction="up" title="Up">
              <i class="material-icons">north</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'up-right' ? 'active' : ''}" data-direction="up-right" title="Up-Right">
              <i class="material-icons">north_east</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'left' ? 'active' : ''}" data-direction="left" title="Left">
              <i class="material-icons">west</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'none' ? 'active' : ''}" data-direction="none" title="None">
              <i class="material-icons">fiber_manual_record</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'right' ? 'active' : ''}" data-direction="right" title="Right">
              <i class="material-icons">east</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'down-left' ? 'active' : ''}" data-direction="down-left" title="Down-Left">
              <i class="material-icons">south_west</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'down' ? 'active' : ''}" data-direction="down" title="Down">
              <i class="material-icons">south</i>
            </button>
            <button class="icon-toggle-btn ${(props.backgroundImage?.direction || 'none') === 'down-right' ? 'active' : ''}" data-direction="down-right" title="Down-Right">
              <i class="material-icons">south_east</i>
            </button>
          </div>
        </div>

        <div id="bg-speed-range" style="display:${props.backgroundImage?.url ? 'block' : 'none'}"></div>
      </div>

      <div class="panel-tab-content" data-tab-content="style">
        <div class="control-group">
          <label>Font Family</label>
          ${PanelUtils.renderFontFamilyPicker('font-family', font.family)}
        </div>

        ${PanelUtils.renderSlider('Font Size', 'font-size', font.size, 8, 144, 1, 'px')}

        ${PanelUtils.renderGradientPicker('Text Color', 'font-color-gradient-selector', font.color)}

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
            <div class="icon-toggle-group" id="font-decoration">
              <button class="icon-toggle-btn ${font.decoration === 'underline' ? 'active' : ''}" data-value="underline" title="Underline">
                <i class="material-icons">format_underlined</i>
              </button>
              <button class="icon-toggle-btn ${font.decoration === 'line-through' ? 'active' : ''}" data-value="line-through" title="Strikethrough">
                <i class="material-icons">strikethrough_s</i>
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

    // Clickable placeholder tags — insert at cursor or append
    document.querySelectorAll('.placeholder-tag').forEach((tag) => {
      tag.addEventListener('click', () => {
        if (!textContent) return;
        const placeholder = tag.dataset.placeholder;
        const start = textContent.selectionStart;
        const end = textContent.selectionEnd;
        const val = textContent.value;
        textContent.value = val.substring(0, start) + placeholder + val.substring(end);
        textContent.focus();
        const cursor = start + placeholder.length;
        textContent.setSelectionRange(cursor, cursor);
        textContent.dispatchEvent(new Event('change'));
      });
    });

    // ── Image Fill controls ──

    /** Show/hide direction and speed controls based on image URL presence. */
    const toggleBgControls = (hasUrl) => {
      const dirGroup = document.getElementById('bg-direction-group');
      const speedRange = document.getElementById('bg-speed-range');
      if (dirGroup) dirGroup.style.display = hasUrl ? 'block' : 'none';
      if (speedRange) speedRange.style.display = hasUrl ? 'block' : 'none';
    };

    // Image selector for background fill
    new ImageSelector('text-bg-image-selector', {
      label: 'Background Image',
      accept: 'image/*',
      mediaType: 'image',
      placeholder: 'Enter URL or media ID',
      value: element.properties.backgroundImage?.url || '',
      onMediaChange: async (value) => {
        if (value instanceof File) {
          const item = await window.MediaDB.addMedia(value);
          updateProperty('properties.backgroundImage.url', item.id);
        } else {
          updateProperty('properties.backgroundImage.url', value);
        }
        toggleBgControls(!!value);
      }
    });

    // Direction grid (radio-style: one active at a time)
    const dirGrid = document.getElementById('bg-direction-grid');
    if (dirGrid) {
      dirGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;
        dirGrid.querySelectorAll('.icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.backgroundImage.direction', btn.dataset.direction);
      });
    }

    // Speed slider
    new RangeInput('bg-speed-range', {
      label: 'Movement Speed',
      value: element.properties.backgroundImage?.speed ?? 0,
      min: 0,
      max: 10,
      step: 1,
      onChange: (val) => {
        updateProperty('properties.backgroundImage.speed', val);
      }
    });

    // Font family
    PanelUtils.bindFontFamilyPicker('font-family', (value) => {
      updateProperty('properties.font.family', value);
    });

    // Font size slider
    PanelUtils.bindSlider('font-size', (value) => {
      updateProperty('properties.font.size', parseInt(value));
    });

    // Font color (gradient selector)
    PanelUtils.bindGradientPicker('font-color-gradient-selector', element.properties.font.color, (value, animationSpeed, animationType) => {
      updateProperty('properties.font.color', value);
      updateProperty('properties.font.colorAnimationSpeed', animationSpeed);
      updateProperty('properties.font.colorAnimationType', animationType);
    }, element.properties.font.colorAnimationSpeed, element.properties.font.colorAnimationType);

    // Font weight (radio-style: one active at a time)
    const fontWeight = document.getElementById('font-weight');
    if (fontWeight) {
      fontWeight.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;
        fontWeight.querySelectorAll('.icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.weight', btn.dataset.value);
      });
    }

    // Font style (toggle: click toggles italic on/off)
    const fontStyle = document.getElementById('font-style');
    if (fontStyle) {
      fontStyle.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;
        const isActive = btn.classList.toggle('active');
        updateProperty('properties.font.style', isActive ? btn.dataset.value : 'normal');
      });
    }

    // Font decoration (toggle: click toggles on/off, only one active)
    const fontDecoration = document.getElementById('font-decoration');
    if (fontDecoration) {
      fontDecoration.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-toggle-btn');
        if (!btn) return;
        const wasActive = btn.classList.contains('active');
        fontDecoration.querySelectorAll('.icon-toggle-btn').forEach(b => b.classList.remove('active'));
        if (!wasActive) btn.classList.add('active');
        updateProperty('properties.font.decoration', wasActive ? 'none' : btn.dataset.value);
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

    // Shadow toggle + options
    const shadowEnabled = document.getElementById('shadow-enabled');
    const shadowOptions = document.getElementById('shadow-options');
    if (shadowEnabled) {
      shadowEnabled.addEventListener('change', (e) => {
        updateProperty('properties.font.shadow.enabled', e.target.checked);
        if (shadowOptions) shadowOptions.style.display = e.target.checked ? 'block' : 'none';
      });
    }
    PanelUtils.bindColorPicker('shadow-color', (value) => {
      updateProperty('properties.font.shadow.color', value);
    });
    PanelUtils.bindSlider('shadow-offset-x', (value) => {
      updateProperty('properties.font.shadow.offsetX', parseInt(value));
    });
    PanelUtils.bindSlider('shadow-offset-y', (value) => {
      updateProperty('properties.font.shadow.offsetY', parseInt(value));
    });
    PanelUtils.bindSlider('shadow-blur', (value) => {
      updateProperty('properties.font.shadow.blur', parseInt(value));
    });

    // Stroke toggle + options
    const strokeEnabled = document.getElementById('stroke-enabled');
    const strokeOptions = document.getElementById('stroke-options');
    if (strokeEnabled) {
      strokeEnabled.addEventListener('change', (e) => {
        updateProperty('properties.font.stroke.enabled', e.target.checked);
        if (strokeOptions) strokeOptions.style.display = e.target.checked ? 'block' : 'none';
      });
    }
    PanelUtils.bindColorPicker('stroke-color', (value) => {
      updateProperty('properties.font.stroke.color', value);
    });
    PanelUtils.bindSlider('stroke-width', (value) => {
      updateProperty('properties.font.stroke.width', parseFloat(value));
    });
  }
}

export default TextPanel;
