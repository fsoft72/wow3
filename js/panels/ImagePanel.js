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
        <div class="control-group">
          <label>Image Source</label>
          <div class="media-input-group">
            <input type="text" id="image-url" class="panel-input" value="${props.url || ''}" placeholder="Enter URL or media ID">
            <button id="btn-select-from-library" class="btn-icon" title="Select from Media Library">
              <i class="material-icons">photo_library</i>
            </button>
          </div>
        </div>

        <div class="control-group">
          <label>Upload Image</label>
          <div class="upload-area" id="upload-area">
            <input type="file" id="file-input" accept="image/*" style="display: none;">
            <button id="btn-upload" class="btn-upload">
              <i class="material-icons">cloud_upload</i>
              <span>Choose File or Drag & Drop</span>
            </button>
          </div>
        </div>

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

        ${PanelUtils.renderSlider('Border Radius', 'border-radius', props.borderRadius || 0, 0, 50, 1, 'px')}

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

    // Image URL
    const imageUrl = document.getElementById('image-url');
    if (imageUrl) {
      imageUrl.addEventListener('change', (e) => updateMediaUrl(e.target.value));
    }

    // Select from library button
    const btnLibrary = document.getElementById('btn-select-from-library');
    if (btnLibrary) {
      btnLibrary.addEventListener('click', () => {
        MediaManager.open(async (data) => {
          const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
          if (mediaId) {
            await updateMediaUrl(mediaId);
            if (imageUrl) imageUrl.value = mediaId;
          }
        });
      });
    }

    // File upload
    const btnUpload = document.getElementById('btn-upload');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');

    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          M.toast({ html: 'Uploading image...', classes: 'blue' });
          try {
            await updateMediaUrl(file);
            M.toast({ html: 'Image uploaded successfully!', classes: 'green' });
          } catch (error) {
            console.error('Upload failed:', error);
            M.toast({ html: 'Failed to upload image', classes: 'red' });
          }
        }
      });
    }

    // Drag & drop
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });

      uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          M.toast({ html: 'Uploading image...', classes: 'blue' });
          try {
            await updateMediaUrl(file);
            M.toast({ html: 'Image uploaded successfully!', classes: 'green' });
          } catch (error) {
            console.error('Upload failed:', error);
            M.toast({ html: 'Failed to upload image', classes: 'red' });
          }
        }
      });
    }

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

    // Border radius
    PanelUtils.bindSlider('border-radius', (value) => {
      updateProperty('properties.borderRadius', parseInt(value));
    });

    // Opacity
    PanelUtils.bindSlider('opacity', (value) => {
      updateProperty('properties.opacity', value / 100);
    });
  }
}

export default ImagePanel;
