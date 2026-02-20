/**
 * WOW3 UI Manager
 * Manages all UI components and state
 */

import { RightSidebar } from "./RightSidebar.js";
import { StatusBar } from "./StatusBar.js";
import { toast } from "../utils/toasts.js";

export class UIManager {
	constructor() {
		this.rightSidebar = null;
		this.statusBar = null;
		this.currentMode = "editor"; // 'editor' or 'presentation'
	}

	/**
	 * Initialize UI manager
	 */
	async init() {
		console.log("Initializing UIManager...");

		// Initialize components
		this.rightSidebar = new RightSidebar();
		this.statusBar = new StatusBar();
		await this.rightSidebar.init();
		await this.statusBar.init();

		// Initialize MaterializeCSS tabs
		this.initTabs();

		// Initialize global MediaManager and attach button handler
		await MediaManager.init();
		this.attachMediaManagerButton();

		// Initialize global PresentationManager and attach button handler
		await PresentationManager.init();
		this.attachPresentationManagerButton();

		// Initialize global TemplateManager and attach button handler
		await TemplateManager.init();
		this.attachTemplateManagerButton();

		// Attach About dialog to brand logo
		this.attachAboutDialog();

		console.log("UIManager initialized");
	}

	/**
	 * Attach media manager button click handler
	 */
	attachMediaManagerButton() {
		const btn = document.getElementById("open-media-manager");
		if (btn) {
			btn.addEventListener("click", () => {
				MediaManager.open();
			});
		}
	}

	/**
	 * Attach presentation manager button click handler
	 */
	attachPresentationManagerButton() {
		const btn = document.getElementById("open-btn");
		if (btn) {
			btn.addEventListener("click", () => {
				PresentationManager.open();
			});
		}
	}

	/**
	 * Attach template manager button click handler
	 */
	attachTemplateManagerButton() {
		const btn = document.getElementById("open-templates-btn");
		if (btn) {
			btn.addEventListener("click", () => {
				TemplateManager.open();
			});
		}
	}

	/**
	 * Attach About dialog to the brand logo click
	 */
	attachAboutDialog() {
		const logo = document.getElementById("brand-logo");
		if (!logo) return;

		logo.addEventListener("click", (e) => {
			e.preventDefault();
			Dialog.show({
				title: "About",
				body: `
          <div style="text-align: center; line-height: 1.8;">
            <img src="icons/icon-192x192.png" alt="WOW3" style="width: 96px; height: 96px; margin-bottom: 10px;">
            <h4 style="margin: 0 0 5px 0; font-weight: bold;">wow3</h4>
            <p style="margin: 0 0 15px 0;">the browser based presentation app</p>
            <p style="margin: 0 0 10px 0;">written by <a href="https://github.com/fsoft72" target="_blank" rel="noopener">Fabio "fsoft" Rotondo</a></p>
            <p style="margin: 0 0 10px 0;">This software is Open Source under the MIT license</p>
            <p style="margin: 0 0 15px 0;">Please, star us on <a href="https://github.com/fsoft72/wow3" target="_blank" rel="noopener">Github</a>!</p>
            <p style="margin: 0; font-size: 0.9em; color: #888;">v. 0.9.3</p>
          </div>
        `,
				buttons: [{ text: "OK", type: "primary", value: true }],
				onRender: (box) => {
					const btn = box.querySelector(".dialog-btn-primary");
					if (btn) btn.focus();
				},
			});
		});
	}

	/**
	 * Initialize MaterializeCSS tabs
	 */
	initTabs() {
		const tabs = document.querySelectorAll(".tabs");
		M.Tabs.init(tabs, {
			onShow: (tab) => {
				// Handle tab changes if needed
			},
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
	 * Handle window resize
	 */
	handleResize() {
		// Handle responsive behavior
		const width = window.innerWidth;

		if (width < 1024) {
			// Adjust for smaller screens
			document.documentElement.style.setProperty("--sidebar-width", "200px");
		} else {
			document.documentElement.style.setProperty("--sidebar-width", "250px");
		}
	}

	/**
	 * Enter play mode
	 */
	enterPlayMode() {
		this.currentMode = "presentation";

		// Hide editor UI
		const appContainer = document.getElementById("app-container");
		const topMenu = document.getElementById("top-menu");
		const statusBar = document.getElementById("status-bar");

		if (appContainer) appContainer.style.display = "none";
		if (topMenu) topMenu.style.display = "none";
		if (statusBar) statusBar.style.display = "none";
	}

	/**
	 * Exit play mode
	 */
	exitPlayMode() {
		this.currentMode = "editor";

		// Show editor UI
		const appContainer = document.getElementById("app-container");
		const topMenu = document.getElementById("top-menu");
		const statusBar = document.getElementById("status-bar");

		if (appContainer) appContainer.style.display = "flex";
		if (topMenu) topMenu.style.display = "block";
		if (statusBar) statusBar.style.display = "flex";
	}

	/**
	 * Show loading indicator
	 * @param {string} message - Loading message
	 */
	showLoading(message = "Loading...") {
		// Create or show loading overlay
		let overlay = document.getElementById("loading-overlay");

		if (!overlay) {
			overlay = document.createElement("div");
			overlay.id = "loading-overlay";
			overlay.className = "spinner-overlay";
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

		overlay.style.display = "flex";
	}

	/**
	 * Hide loading indicator
	 */
	hideLoading() {
		const overlay = document.getElementById("loading-overlay");
		if (overlay) {
			overlay.style.display = "none";
		}
	}

	/**
	 * Show toast message
	 * @param {string} message - Message to show
	 * @param {string} type - Toast type: 'green'→success, 'red'→error, 'orange'→warning, 'blue'→info
	 */
	showToast(message, type = "") {
		const COLOR_MAP = {
			green: "success",
			red: "error",
			orange: "warning",
			blue: "info",
		};
		const fn = toast[COLOR_MAP[type]] || toast.info;
		fn(message);
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
