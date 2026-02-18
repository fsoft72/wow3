/**
 * Image Element Property Panel
 */

export class ImagePanel {
  static render(element) {
    const props = element.properties;

    return `
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="content">Content</button>
        <button class="panel-tab" data-tab="style">Style</button>
      </div>

      <div class="panel-tab-content active" data-tab-content="content">
        <div id="image-media-selector"></div>

        <div class="control-group">
          <label>Alt Text</label>
          <input type="text" id="image-alt" class="panel-input" value="${props.alt || ''}" placeholder="Describe the image">
        </div>
      </div>

      ${props.crop ? `
        <div class="control-group" style="margin-top:8px;">
          <button id="btn-reset-crop" class="btn-small orange white-text" style="width:100%;">
            <i class="material-icons left" style="margin-right:4px;">crop_free</i>Reset Crop
          </button>
        </div>
      ` : ''}

      <div class="panel-tab-content" data-tab-content="style">
        <div class="control-group">
          <label>Object Fit</label>
          <select id="image-fit" class="panel-select">
            <option value="cover" ${props.fit === 'cover' ? 'selected' : ''}>Cover</option>
            <option value="contain" ${props.fit === 'contain' ? 'selected' : ''}>Contain</option>
            <option value="fill" ${props.fit === 'fill' ? 'selected' : ''}>Fill</option>
            <option value="none" ${props.fit === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>

        <div class="control-group">
          <label>Clip Shape</label>
          <select id="clip-shape" class="panel-select">
            <option value="none" ${(props.clipShape || 'none') === 'none' ? 'selected' : ''}>None</option>
            <option value="circle" ${props.clipShape === 'circle' ? 'selected' : ''}>Circle</option>
            <option value="rectangle" ${props.clipShape === 'rectangle' ? 'selected' : ''}>Rectangle</option>
          </select>
        </div>

        ${props.clipShape && props.clipShape !== 'none' ? `
          ${props.clipShape === 'rectangle' ? PanelUtils.renderSlider('Border Radius', 'border-radius', props.borderRadius || 0, 0, 50, 1, 'px') : ''}
          ${PanelUtils.renderSlider('Border Width', 'shape-border-width', props.shapeBorderWidth || 0, 0, 20, 1, 'px')}
          ${PanelUtils.renderColorPicker('Border Color', 'shape-border-color', props.shapeBorderColor || '#000000')}
          ${PanelUtils.renderSlider('Content Scale', 'shape-scale', props.shapeScale || 100, 50, 200, 1, '%')}
        ` : `
          ${PanelUtils.renderSlider('Border Radius', 'border-radius', props.borderRadius || 0, 0, 50, 1, 'px')}
        `}

        ${PanelUtils.renderSlider('Opacity', 'opacity', (props.opacity !== undefined ? props.opacity : 1) * 100, 0, 100, 1, '%')}
      </div>
    `;
  }

  static bindEvents(element) {
    const updateProperty = (path, value) => {
      window.app.editor.elementController.updateElementProperty(path, value);
    };

    const updateMediaUrl = async (value) => {
      await window.app.editor.elementController.updateMediaUrl(element, value);
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

    // Image source selector
    new ImageSelector('image-media-selector', {
      label: 'Image Source',
      accept: 'image/*',
      mediaType: 'image',
      placeholder: 'Enter URL or media ID',
      value: element.properties.url || '',
      onMediaChange: (value) => updateMediaUrl(value)
    });

    // Reset crop
    const btnResetCrop = document.getElementById('btn-reset-crop');
    if (btnResetCrop) {
      btnResetCrop.addEventListener('click', () => {
        updateProperty('properties.crop', null);
      });
    }

    // Alt text
    const imageAlt = document.getElementById('image-alt');
    if (imageAlt) {
      imageAlt.addEventListener('change', (e) => {
        updateProperty('properties.alt', e.target.value);
      });
    }

    // Object fit
    const imageFit = document.getElementById('image-fit');
    if (imageFit) {
      imageFit.addEventListener('change', (e) => {
        updateProperty('properties.fit', e.target.value);
      });
    }

    // Clip shape
    const clipShapeSelect = document.getElementById('clip-shape');
    if (clipShapeSelect) {
      clipShapeSelect.addEventListener('change', (e) => {
        const newShape = e.target.value;

        updateProperty('properties.clipShape', newShape);

        // Force panel re-render to show/hide conditional controls
        if (window.app.editor.uiManager?.rightSidebar) {
          window.app.editor.uiManager.rightSidebar.updateProperties(element, true);
        }
      });
    }

    // Border radius (shown for rectangle shape or when no shape)
    PanelUtils.bindSlider('border-radius', (value) => {
      updateProperty('properties.borderRadius', parseInt(value));
    });

    // Shape border width
    PanelUtils.bindSlider('shape-border-width', (value) => {
      updateProperty('properties.shapeBorderWidth', parseInt(value));
    });

    // Shape border color
    PanelUtils.bindColorPicker('shape-border-color', (value) => {
      updateProperty('properties.shapeBorderColor', value);
    });

    // Shape content scale
    PanelUtils.bindSlider('shape-scale', (value) => {
      updateProperty('properties.shapeScale', parseInt(value));
    });

    // Opacity
    PanelUtils.bindSlider('opacity', (value) => {
      updateProperty('properties.opacity', value / 100);
    });
  }
}

export default ImagePanel;
