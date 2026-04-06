import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { Project } from '../models/Project.js';

/**
 * Full-screen modal for viewing and editing the raw project JSON.
 * Changes are applied to the project only when the JSON is valid.
 */
export class JsonEditorModal {
  /**
   * @param {import('../controllers/TimelineController.js').TimelineController} timeline
   * @param {Function} onApply - Called with no arguments after a valid JSON is applied.
   */
  constructor(timeline, onApply) {
    this.timeline = timeline;
    this.onApply = onApply;
    this._view = null;
    this._modal = null;
    this._statusEl = null;
    this._applyBtn = null;
    this._build();
  }

  /** @private */
  _build() {
    // Backdrop
    this._modal = document.createElement('div');
    this._modal.id = 'json-editor-modal';
    this._modal.innerHTML = `
      <div id="json-editor-dialog">
        <div id="json-editor-header">
          <span id="json-editor-title"><i class="material-icons">data_object</i> Project JSON</span>
          <span id="json-editor-status"></span>
          <div id="json-editor-actions">
            <button id="json-editor-apply" class="json-btn json-btn-primary" disabled>Apply</button>
            <button id="json-editor-close" class="json-btn">Close</button>
          </div>
        </div>
        <div id="json-editor-body"></div>
      </div>
    `;
    document.body.appendChild(this._modal);

    this._statusEl = this._modal.querySelector('#json-editor-status');
    this._applyBtn = this._modal.querySelector('#json-editor-apply');

    this._modal.querySelector('#json-editor-close').addEventListener('click', () => this.close());
    this._modal.addEventListener('click', (e) => { if (e.target === this._modal) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._isOpen()) this.close(); });

    this._applyBtn.addEventListener('click', () => this._applyJson());
  }

  /** Opens the modal and loads current project JSON into the editor. */
  open() {
    const jsonStr = JSON.stringify(this.timeline.project.toJSON(), null, 2);
    this._modal.classList.add('open');

    if (this._view) {
      this._view.destroy();
      this._view = null;
    }

    this._view = new EditorView({
      state: EditorState.create({
        doc: jsonStr,
        extensions: [
          basicSetup,
          json(),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this._onDocChanged();
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { overflow: 'auto', fontFamily: '"Fira Code", "Cascadia Code", monospace' },
          }),
        ],
      }),
      parent: this._modal.querySelector('#json-editor-body'),
    });

    this._setStatus('', false);
    this._applyBtn.disabled = true;
  }

  /** Closes the modal. */
  close() {
    this._modal.classList.remove('open');
  }

  /** @private */
  _isOpen() {
    return this._modal.classList.contains('open');
  }

  /** @private */
  _onDocChanged() {
    const raw = this._view.state.doc.toString();
    try {
      JSON.parse(raw);
      this._setStatus('Valid JSON', false);
      this._applyBtn.disabled = false;
    } catch {
      this._setStatus('Invalid JSON', true);
      this._applyBtn.disabled = true;
    }
  }

  /** @private */
  _applyJson() {
    const raw = this._view.state.doc.toString();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    try {
      this.timeline.project = Project.fromJSON(data);
      this.timeline.project.touch();
      if (this.onApply) this.onApply();
      this._setStatus('Applied ✓', false);
      this._applyBtn.disabled = true;
    } catch (err) {
      this._setStatus('Apply failed: ' + err.message, true);
    }
  }

  /**
   * @param {string} msg
   * @param {boolean} isError
   * @private
   */
  _setStatus(msg, isError) {
    this._statusEl.textContent = msg;
    this._statusEl.className = isError ? 'error' : 'ok';
  }
}
