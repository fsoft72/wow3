/**
 * WOW3 Remote Controller
 * Mobile remote control for presentations via WebRTC (PeerJS).
 */

import { Peer } from 'peerjs';

(() => {
  'use strict';

  // ── Constants ──
  const RECONNECT_DELAY_MS = 2000;
  const MAX_RECONNECT_ATTEMPTS = 30;

  // ── DOM refs ──
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const connectScreen = document.getElementById('connect-screen');
  const app = document.getElementById('app');

  // ── State ──
  let peer = null;
  let conn = null;
  let peerCode = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let isConnected = false;

  /**
   * Read the peer code from URL query param
   * @returns {string|null}
   */
  const getPeerCode = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code');
  };

  /**
   * Update the status UI
   * @param {'connecting'|'connected'|'disconnected'|'error'} state
   * @param {string} [message]
   */
  const setStatus = (state, message) => {
    statusDot.className = 'status-dot';

    if (state === 'connecting') {
      statusDot.classList.add('connecting');
      statusText.textContent = message || 'Connecting...';
    } else if (state === 'connected') {
      statusDot.classList.add('connected');
      statusText.textContent = message || 'Connected';
    } else if (state === 'disconnected' || state === 'error') {
      statusText.textContent = message || 'Disconnected';
    }
  };

  /**
   * Show the remote control buttons
   */
  const showButtons = () => {
    connectScreen.remove();

    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.innerHTML = `
      <button class="btn-remote btn-prev" id="btn-prev">
        <span class="btn-arrow">&#9664;</span>
        <span>PREV</span>
      </button>
      <button class="btn-remote btn-next" id="btn-next">
        <span>NEXT</span>
        <span class="btn-arrow">&#9654;</span>
      </button>
    `;
    app.appendChild(buttons);

    document.getElementById('btn-prev').addEventListener('click', () => sendCommand('prev'));
    document.getElementById('btn-next').addEventListener('click', () => sendCommand('next'));
  };

  /**
   * Send a command to the presentation
   * @param {string} cmd - 'next' or 'prev'
   */
  const sendCommand = (cmd) => {
    if (!conn || !conn.open) return;
    conn.send(cmd);
  };

  /**
   * Connect to the presentation peer
   */
  const connect = () => {
    if (!peerCode) return;

    // Clean up any existing peer
    if (peer) {
      peer.destroy();
      peer = null;
    }

    setStatus('connecting', 'Connecting...');

    peer = new Peer();

    peer.on('open', () => {
      conn = peer.connect(peerCode, { reliable: true });

      conn.on('open', () => {
        isConnected = true;
        reconnectAttempts = 0;
        setStatus('connected');

        // Show buttons on first connection
        if (document.getElementById('connect-screen')) {
          showButtons();
        }
      });

      conn.on('close', () => {
        isConnected = false;
        setStatus('disconnected', 'Disconnected');
        scheduleReconnect();
      });

      conn.on('error', () => {
        isConnected = false;
        setStatus('error', 'Connection error');
        scheduleReconnect();
      });
    });

    peer.on('error', (err) => {
      console.warn('[Remote] Peer error:', err);
      isConnected = false;

      if (err.type === 'peer-unavailable') {
        setStatus('error', 'Presentation not found');
      } else {
        setStatus('error', 'Connection error');
      }
      scheduleReconnect();
    });

    peer.on('disconnected', () => {
      if (!isConnected) {
        scheduleReconnect();
      }
    });
  };

  /**
   * Schedule a reconnection attempt
   */
  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error', 'Could not reconnect');

      // Show retry button if still on connect screen
      if (document.getElementById('connect-screen')) {
        connectScreen.innerHTML = `
          <div class="error-text">Could not connect to presentation.<br>Check the code and try again.</div>
          <button class="retry-btn" onclick="location.reload()">Retry</button>
        `;
      }
      return;
    }

    reconnectAttempts++;
    setStatus('connecting', `Reconnecting (${reconnectAttempts})...`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  };

  // ── Init ──
  peerCode = getPeerCode();

  if (!peerCode) {
    setStatus('error', 'No code provided');
    connectScreen.innerHTML = `
      <div class="error-text">No presentation code found in the URL.</div>
    `;
  } else {
    // Try to lock landscape orientation
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    connect();
  }
})();
