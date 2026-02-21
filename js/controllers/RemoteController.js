/**
 * WOW3 Remote Controller
 * Handles WebRTC-based remote control via PeerJS.
 * Desktop-side: creates a PeerJS peer, shows QR code dialog,
 * and forwards next/prev commands to PlaybackController.
 */

import { toast } from '../utils/toasts.js';

// ─── Constants ───────────────────────────────────────────

/** Characters used to generate the random part of the peer ID */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Length of the random part of the peer ID */
const CODE_LENGTH = 6;

/** Prefix for peer IDs to avoid collisions */
const PEER_PREFIX = 'wow3-';

// ─── RemoteController Class ──────────────────────────────

export class RemoteController {
  /**
   * Create remote controller.
   * @param {import('./EditorController.js').EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;

    /** @type {Peer|null} PeerJS peer instance */
    this._peer = null;

    /** @type {DataConnection|null} Active data connection from remote */
    this._conn = null;

    /** @type {string|null} Current peer ID */
    this._peerId = null;

    /** @type {boolean} Whether a remote is currently connected */
    this.isConnected = false;
  }

  // ─── Public API ──────────────────────────────────────────

  /**
   * Initialize the remote controller.
   * Binds the remote button click handler.
   */
  init() {
    const remoteBtn = document.getElementById('remote-btn');
    if (remoteBtn) {
      remoteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showQRCode();
      });
    }
  }

  /**
   * Show the QR code dialog for remote pairing.
   * Creates a PeerJS peer if not already active, generates QR code,
   * and displays the pairing dialog.
   */
  async showQRCode() {
    // Create peer if needed
    if (!this._peer || this._peer.destroyed) {
      this._peerId = this._generateCode();
      await this._createPeer();
    }

    const mobileUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/mobile/')}?code=${this._peerId}`;

    // Build QR canvas
    const qrCanvas = document.createElement('canvas');
    try {
      await QRCode.toCanvas(qrCanvas, mobileUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (err) {
      console.error('[Remote] QR generation failed:', err);
      toast.error('Failed to generate QR code');
      return;
    }

    // Build dialog body
    const statusLabel = this.isConnected ? 'Connected' : 'Waiting for connection...';
    const statusColor = this.isConnected ? '#4caf50' : '#ff9800';

    const body = `
      <div class="remote-dialog-content">
        <div class="remote-qr-wrapper">
          <div id="remote-qr-container"></div>
        </div>
        <div class="remote-code-text">
          Code: <strong>${this._peerId.replace(PEER_PREFIX, '')}</strong>
        </div>
        <div class="remote-status" id="remote-dialog-status">
          <span class="remote-status-dot" style="background: ${statusColor}"></span>
          <span>${statusLabel}</span>
        </div>
        <div class="remote-instructions">
          Scan the QR code with your phone to control the presentation remotely.
        </div>
      </div>
    `;

    Dialog.show({
      title: 'Remote Controller',
      body,
      buttons: [
        { text: 'Close', type: 'secondary', value: false }
      ],
      onRender: (box) => {
        const container = box.querySelector('#remote-qr-container');
        if (container) {
          container.appendChild(qrCanvas);
        }
      }
    });
  }

  /**
   * Clean up the PeerJS peer and connection.
   */
  destroy() {
    if (this._conn) {
      this._conn.close();
      this._conn = null;
    }
    if (this._peer) {
      this._peer.destroy();
      this._peer = null;
    }
    this.isConnected = false;
    this._peerId = null;
  }

  // ─── Private Methods ────────────────────────────────────

  /**
   * Generate a random peer ID like "wow3-A1B2C3"
   * @returns {string} Peer ID
   */
  _generateCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return PEER_PREFIX + code;
  }

  /**
   * Create a PeerJS peer and set up connection listeners.
   * @returns {Promise<void>}
   */
  _createPeer() {
    return new Promise((resolve, reject) => {
      this._peer = new Peer(this._peerId);

      this._peer.on('open', () => {
        console.log('[Remote] Peer open:', this._peerId);
        resolve();
      });

      this._peer.on('connection', (conn) => {
        this._handleConnection(conn);
      });

      this._peer.on('error', (err) => {
        console.error('[Remote] Peer error:', err);
        if (err.type === 'unavailable-id') {
          // ID collision, regenerate
          this._peerId = this._generateCode();
          this._peer.destroy();
          this._createPeer().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Handle an incoming data connection from a remote device.
   * Listens for "next" and "prev" commands and forwards them
   * to PlaybackController when playback is active.
   * @param {DataConnection} conn - PeerJS data connection
   */
  _handleConnection(conn) {
    // Close previous connection if any
    if (this._conn) {
      this._conn.close();
    }

    this._conn = conn;

    conn.on('open', () => {
      this.isConnected = true;
      toast.success('Remote controller connected');
      this._updateDialogStatus(true);
    });

    conn.on('data', (data) => {
      const playback = this.editor.playbackController;
      if (!playback || !playback.isPlaying) return;

      if (data === 'next') {
        playback.advance();
      } else if (data === 'prev') {
        playback.previousSlide();
      }
    });

    conn.on('close', () => {
      this.isConnected = false;
      toast.warning('Remote controller disconnected');
      this._updateDialogStatus(false);
    });

    conn.on('error', (err) => {
      console.error('[Remote] Connection error:', err);
      this.isConnected = false;
      this._updateDialogStatus(false);
    });
  }

  /**
   * Update the status indicator in the QR dialog if it's still open.
   * @param {boolean} connected - Whether remote is connected
   */
  _updateDialogStatus(connected) {
    const statusEl = document.getElementById('remote-dialog-status');
    if (!statusEl) return;

    const color = connected ? '#4caf50' : '#ff9800';
    const label = connected ? 'Connected' : 'Waiting for connection...';
    statusEl.innerHTML = `
      <span class="remote-status-dot" style="background: ${color}"></span>
      <span>${label}</span>
    `;
  }
}

export default RemoteController;
