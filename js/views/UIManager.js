/**
 * WOW3 UI Manager
 * Manages all UI components and state
 */

import { RightSidebar } from './RightSidebar.js';
import { StatusBar } from './StatusBar.js';
import { ElementsTree } from './ElementsTree.js';
import { MediaManager } from './MediaManager.js';

export class UIManager {
  constructor() {
    this.rightSidebar = null;
    this.statusBar = null;
    this.elementsTree = null;
    this.mediaManager = null;
    this.currentMode = 'editor'; // 'editor' or 'presentation'
  }

  /**
   * Initialize UI manager
   */
  async init() {
    console.log('Initializing UIManager...');

    // Initialize components
    this.rightSidebar = new RightSidebar();
    this.statusBar = new StatusBar();
    this.elementsTree = new ElementsTree();
    this.mediaManager = new MediaManager();

    await this.rightSidebar.init();
    await this.statusBar.init();
    await this.elementsTree.init();
    await this.mediaManager.init();

    // Initialize MaterializeCSS tabs
    this.initTabs();

    // Attach media manager button handler
    this.attachMediaManagerButton();

    console.log('UIManager initialized');
  }

  /**
   * Attach media manager button click handler
   */
  attachMediaManagerButton() {
    const btn = document.getElementById('open-media-manager');
    if (btn) {
      btn.addEventListener('click', () => {
        this.mediaManager.open();
      });
    }
  }

  /**
   * Initialize MaterializeCSS tabs
   */
  initTabs() {
    const tabs = document.querySelectorAll('.tabs');
    M.Tabs.init(tabs, {
      onShow: (tab) => {
        // Handle tab changes if needed
      }
    });
  }

  /**
   * Update status bar
   * @param {number} currentSlide - Current slide number (1-indexed)
   * @param {number} totalSlides - Total number of slides
   */
  updateStatusBar(currentSlide, totalSlides) {
    this.statusBar.update(currentSlide, totalSlides);
  }

  /**
   * Update elements tree
   * @param {Array} elements - Array of elements
   */
  updateElementsTree(elements) {
    this.elementsTree.render(elements);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Handle responsive behavior
    const width = window.innerWidth;

    if (width < 1024) {
      // Adjust for smaller screens
      document.documentElement.style.setProperty('--sidebar-width', '200px');
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '250px');
    }
  }

  /**
   * Enter play mode
   */
  enterPlayMode() {
    this.currentMode = 'presentation';

    // Hide editor UI
    const appContainer = document.getElementById('app-container');
    const topMenu = document.getElementById('top-menu');
    const statusBar = document.getElementById('status-bar');

    if (appContainer) appContainer.style.display = 'none';
    if (topMenu) topMenu.style.display = 'none';
    if (statusBar) statusBar.style.display = 'none';
  }

  /**
   * Exit play mode
   */
  exitPlayMode() {
    this.currentMode = 'editor';

    // Show editor UI
    const appContainer = document.getElementById('app-container');
    const topMenu = document.getElementById('top-menu');
    const statusBar = document.getElementById('status-bar');

    if (appContainer) appContainer.style.display = 'flex';
    if (topMenu) topMenu.style.display = 'block';
    if (statusBar) statusBar.style.display = 'flex';
  }

  /**
   * Show loading indicator
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    // Create or show loading overlay
    let overlay = document.getElementById('loading-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'spinner-overlay';
      overlay.innerHTML = `
        <div class="spinner-wrapper">
          <div class="preloader-wrapper big active">
            <div class="spinner-layer spinner-blue-only">
              <div class="circle-clipper left">
                <div class="circle"></div>
              </div>
              <div class="gap-patch">
                <div class="circle"></div>
              </div>
              <div class="circle-clipper right">
                <div class="circle"></div>
              </div>
            </div>
          </div>
          <p class="spinner-message">${message}</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    overlay.style.display = 'flex';
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Show toast message
   * @param {string} message - Message to show
   * @param {string} classes - CSS classes (e.g., 'green', 'red')
   */
  showToast(message, classes = '') {
    M.toast({ html: message, classes });
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} User confirmation
   */
  async confirm(message) {
    return new Promise((resolve) => {
      const result = window.confirm(message);
      resolve(result);
    });
  }
}

export default UIManager;
