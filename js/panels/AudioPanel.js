/**
 * Audio Element Property Panel
 */

export class AudioPanel {
  static render(element) {
    const props = element.properties;

    return `
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="content">Content</button>
        <button class="panel-tab" data-tab="settings">Settings</button>
      </div>

      <div class="panel-tab-content active" data-tab-content="content">
        <div class="control-group">
          <label>Audio Source</label>
          <div class="media-input-group">
            <input type="text" id="audio-url" class="panel-input" value="${props.url || ''}" placeholder="Enter URL or media ID">
            <button id="btn-select-from-library" class="btn-icon" title="Select from Media Library">
              <i class="material-icons">photo_library</i>
            </button>
          </div>
        </div>

        <div class="control-group">
          <label>Upload Audio</label>
          <div class="upload-area" id="upload-area">
            <input type="file" id="file-input" accept="audio/*" style="display: none;">
            <button id="btn-upload" class="btn-upload">
              <i class="material-icons">cloud_upload</i>
              <span>Choose File or Drag & Drop</span>
            </button>
          </div>
        </div>
      </div>

      <div class="panel-tab-content" data-tab-content="settings">
        <div class="control-group">
          <label>
            <input type="checkbox" id="audio-controls" class="filled-in" ${props.controls !== false ? 'checked' : ''}>
            <span>Show Controls</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="audio-autoplay" class="filled-in" ${props.autoplay ? 'checked' : ''}>
            <span>Autoplay</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="audio-loop" class="filled-in" ${props.loop ? 'checked' : ''}>
            <span>Loop</span>
          </label>
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="audio-muted" class="filled-in" ${props.muted ? 'checked' : ''}>
            <span>Muted</span>
          </label>
        </div>
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

    // Audio URL
    const audioUrl = document.getElementById('audio-url');
    if (audioUrl) {
      audioUrl.addEventListener('change', (e) => updateMediaUrl(e.target.value));
    }

    // Select from library
    const btnLibrary = document.getElementById('btn-select-from-library');
    if (btnLibrary) {
      btnLibrary.addEventListener('click', () => {
        MediaManager.open(async (data) => {
          const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
          if (mediaId) {
            await updateMediaUrl(mediaId);
            if (audioUrl) audioUrl.value = mediaId;
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
          M.toast({ html: 'Uploading audio...', classes: 'blue' });
          try {
            await updateMediaUrl(file);
            M.toast({ html: 'Audio uploaded successfully!', classes: 'green' });
          } catch (error) {
            console.error('Upload failed:', error);
            M.toast({ html: 'Failed to upload audio', classes: 'red' });
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
        if (file && file.type.startsWith('audio/')) {
          M.toast({ html: 'Uploading audio...', classes: 'blue' });
          try {
            await updateMediaUrl(file);
            M.toast({ html: 'Audio uploaded successfully!', classes: 'green' });
          } catch (error) {
            console.error('Upload failed:', error);
            M.toast({ html: 'Failed to upload audio', classes: 'red' });
          }
        }
      });
    }

    // Audio settings
    const checkboxes = [
      { id: 'audio-controls', path: 'properties.controls' },
      { id: 'audio-autoplay', path: 'properties.autoplay' },
      { id: 'audio-loop', path: 'properties.loop' },
      { id: 'audio-muted', path: 'properties.muted' }
    ];

    checkboxes.forEach(({ id, path }) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          updateProperty(path, e.target.checked);
        });
      }
    });
  }
}

export default AudioPanel;
