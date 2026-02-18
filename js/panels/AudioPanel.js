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
        <div id="audio-media-selector"></div>
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

        <div class="control-group">
          <label>
            <input type="checkbox" id="audio-continue" class="filled-in" ${props.continueOnSlides ? 'checked' : ''}>
            <span>Continue on Slides</span>
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

    // Audio source selector
    new ImageSelector('audio-media-selector', {
      label: 'Audio Source',
      accept: 'audio/*',
      mediaType: 'audio',
      placeholder: 'Enter URL or media ID',
      value: element.properties.url || '',
      onMediaChange: (value) => updateMediaUrl(value)
    });

    // Initialize Materialize checkboxes
    setTimeout(() => {
      M.updateTextFields();
    }, 0);

    // Audio settings
    const checkboxes = [
      { id: 'audio-controls', path: 'properties.controls' },
      { id: 'audio-autoplay', path: 'properties.autoplay' },
      { id: 'audio-loop', path: 'properties.loop' },
      { id: 'audio-muted', path: 'properties.muted' },
      { id: 'audio-continue', path: 'properties.continueOnSlides' }
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
