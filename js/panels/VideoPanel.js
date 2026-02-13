/**
 * Video Element Property Panel
 */
import { toast } from '../utils/toasts.js';

export class VideoPanel {
  static render(element) {
    const props = element.properties;

    return `
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="content">Content</button>
        <button class="panel-tab" data-tab="settings">Settings</button>
      </div>

      <div class="panel-tab-content active" data-tab-content="content">
        <div class="control-group">
          <label>Video Source</label>
          <div class="media-input-group">
            <input type="text" id="video-url" class="panel-input" value="${props.url || ''}" placeholder="YouTube URL/ID or Media ID">
            <button id="btn-select-from-library" class="btn-icon" title="Select from Media Library">
              <i class="material-icons">photo_library</i>
            </button>
          </div>
        </div>

        <div class="control-group">
          <label>Upload Video</label>
          <div class="upload-area" id="upload-area">
            <input type="file" id="file-input" accept="video/*" style="display: none;">
            <button id="btn-upload" class="btn-upload">
              <i class="material-icons">cloud_upload</i>
              <span>Choose File or Drag & Drop</span>
            </button>
          </div>
        </div>
      </div>

      ${props.crop ? `
        <div class="control-group" style="margin-top:8px;">
          <button id="btn-reset-crop" class="btn-small orange white-text" style="width:100%;">
            <i class="material-icons left" style="margin-right:4px;">crop_free</i>Reset Crop
          </button>
        </div>
      ` : ''}

      <div class="panel-tab-content" data-tab-content="settings">
        <div class="control-group">
          <label>
            <input type="checkbox" id="video-controls" class="filled-in" ${props.controls !== false ? 'checked' : ''}>
            <span>Show Controls</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="video-autoplay" class="filled-in" ${props.autoplay ? 'checked' : ''}>
            <span>Autoplay</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="video-loop" class="filled-in" ${props.loop ? 'checked' : ''}>
            <span>Loop</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="video-muted" class="filled-in" ${props.muted ? 'checked' : ''}>
            <span>Muted</span>
          </label>
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

    // Initialize Materialize checkboxes
    setTimeout(() => {
      M.updateTextFields();
    }, 0);

    // Video URL
    const videoUrl = document.getElementById('video-url');
    if (videoUrl) {
      videoUrl.addEventListener('change', (e) => updateMediaUrl(e.target.value));
    }

    // Select from library
    const btnLibrary = document.getElementById('btn-select-from-library');
    if (btnLibrary) {
      btnLibrary.addEventListener('click', () => {
        MediaManager.open(async (data) => {
          const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
          if (mediaId) {
            await updateMediaUrl(mediaId);
            if (videoUrl) videoUrl.value = mediaId;
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
          toast.info('Uploading video...');
          try {
            await updateMediaUrl(file);
            toast.success('Video uploaded successfully!');
          } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload video');
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
        if (file && file.type.startsWith('video/')) {
          toast.info('Uploading video...');
          try {
            await updateMediaUrl(file);
            toast.success('Video uploaded successfully!');
          } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload video');
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

    // Video settings
    const checkboxes = [
      { id: 'video-controls', path: 'properties.controls' },
      { id: 'video-autoplay', path: 'properties.autoplay' },
      { id: 'video-loop', path: 'properties.loop' },
      { id: 'video-muted', path: 'properties.muted' }
    ];

    checkboxes.forEach(({ id, path }) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          updateProperty(path, e.target.checked);
        });
      }
    });

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
  }
}

export default VideoPanel;
