/**
 * WOW3 Toast Notification System
 * Standalone ES6 module — no dependencies.
 *
 * Usage:
 *   import { toast } from './utils/toasts.js';
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.warning('Careful...', { duration: 6000 });
 *   toast.info('FYI', { position: 'TR', closable: false });
 */

/* ── constants ────────────────────────────────────── */

const DEFAULT_DURATION = 4000;
const ANIMATION_DURATION = 300;
const TOAST_GAP = 8;
const Z_INDEX = 99999;

/** Position codes → CSS placement */
const POSITIONS = {
	TL: { top: '16px', left: '16px' },
	TC: { top: '16px', left: '50%', transform: 'translateX(-50%)' },
	TR: { top: '16px', right: '16px' },
	BL: { bottom: '16px', left: '16px' },
	BC: { bottom: '16px', left: '50%', transform: 'translateX(-50%)' },
	BR: { bottom: '16px', right: '16px' },
};

/** Slide direction per position */
const SLIDE_DIR = {
	TL: 'translateX(-120%)',
	TC: 'translateY(-120%)',
	TR: 'translateX(120%)',
	BL: 'translateX(-120%)',
	BC: 'translateY(120%)',
	BR: 'translateX(120%)',
};

/** Type → colour palette { bg, border, icon, progress } */
const TYPE_PALETTE = {
	success: { bg: '#E8F5E9', border: '#4CAF50', icon: '#388E3C', progress: '#4CAF50' },
	error:   { bg: '#FFEBEE', border: '#F44336', icon: '#C62828', progress: '#F44336' },
	warning: { bg: '#FFF3E0', border: '#FF9800', icon: '#E65100', progress: '#FF9800' },
	info:    { bg: '#E3F2FD', border: '#2196F3', icon: '#1565C0', progress: '#2196F3' },
};

/** Inline SVG icons (24×24) per type */
const ICONS = {
	success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
	error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
	warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
	info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

/* ── style injection ──────────────────────────────── */

let styleInjected = false;

/** Inject the toast stylesheet once into <head> */
const _injectStyles = () => {
	if (styleInjected) return;
	styleInjected = true;

	const style = document.createElement('style');
	style.textContent = `
.wow3-toast-container {
	position: fixed;
	display: flex;
	flex-direction: column;
	gap: ${TOAST_GAP}px;
	z-index: ${Z_INDEX};
	pointer-events: none;
}
.wow3-toast {
	pointer-events: auto;
	display: flex;
	align-items: flex-start;
	gap: 10px;
	min-width: 280px;
	max-width: 420px;
	padding: 12px 14px;
	border-radius: 6px;
	border-left: 4px solid transparent;
	box-shadow: 0 4px 14px rgba(0,0,0,.15);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	line-height: 1.4;
	color: #333;
	overflow: hidden;
	position: relative;
}
.wow3-toast-icon {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	margin-top: 1px;
}
.wow3-toast-message {
	flex: 1;
	word-break: break-word;
}
.wow3-toast-close {
	flex-shrink: 0;
	background: none;
	border: none;
	cursor: pointer;
	padding: 0 0 0 4px;
	color: #999;
	font-size: 18px;
	line-height: 1;
	transition: color .15s;
}
.wow3-toast-close:hover {
	color: #333;
}
.wow3-toast-progress {
	position: absolute;
	bottom: 0;
	left: 0;
	height: 3px;
	border-radius: 0 0 0 6px;
}
`;
	document.head.appendChild(style);
};

/* ── deduplication ────────────────────────────────── */

/** @type {Set<string>} Active toast keys (type::message) to prevent duplicates */
const _activeToasts = new Set();

/* ── container cache ──────────────────────────────── */

/** @type {Record<string, HTMLDivElement>} */
const containers = {};

/**
 * Get (or create) the container element for a given position code
 * @param {string} pos - Position code (TL, TC, TR, BL, BC, BR)
 * @returns {HTMLDivElement}
 */
const _getContainer = (pos) => {
	if (containers[pos]) return containers[pos];

	const el = document.createElement('div');
	el.className = `wow3-toast-container wow3-toast-container-${pos}`;

	const placement = POSITIONS[pos];
	Object.assign(el.style, placement);

	/* bottom positions stack upward */
	if (pos.startsWith('B')) {
		el.style.flexDirection = 'column-reverse';
	}

	document.body.appendChild(el);
	containers[pos] = el;
	return el;
};

/* ── core: create & show a toast ──────────────────── */

/**
 * Show a toast notification
 * @param {string} type - Toast type: success | error | warning | info
 * @param {string} message - Message text (plain text or simple HTML)
 * @param {object} [opts] - Options
 * @param {number} [opts.duration=4000] - Auto-dismiss ms (0 = no auto-dismiss)
 * @param {boolean} [opts.closable=true] - Show close button
 * @param {string} [opts.position='BR'] - Position code
 */
const _show = (type, message, opts = {}) => {
	_injectStyles();

	// Deduplicate: skip if an identical toast is already visible
	const toastKey = `${type}::${message}`;
	if (_activeToasts.has(toastKey)) return;
	_activeToasts.add(toastKey);

	const {
		duration = DEFAULT_DURATION,
		closable = true,
		position = 'BR',
	} = opts;

	const palette = TYPE_PALETTE[type] || TYPE_PALETTE.info;
	const pos = POSITIONS[position] ? position : 'BR';
	const container = _getContainer(pos);

	/* ── build DOM ──────────────── */
	const el = document.createElement('div');
	el.className = `wow3-toast wow3-toast-${type}`;
	el.style.backgroundColor = palette.bg;
	el.style.borderLeftColor = palette.border;

	let html = `
		<span class="wow3-toast-icon" style="color:${palette.icon}">${ICONS[type] || ICONS.info}</span>
		<span class="wow3-toast-message">${message}</span>
	`;

	if (closable) {
		html += `<button class="wow3-toast-close" aria-label="Close">&times;</button>`;
	}

	el.innerHTML = html;

	/* progress bar (only when auto-dismiss is active) */
	let progressEl = null;
	if (duration > 0) {
		progressEl = document.createElement('div');
		progressEl.className = 'wow3-toast-progress';
		progressEl.style.backgroundColor = palette.progress;
		progressEl.style.width = '100%';
		el.appendChild(progressEl);
	}

	/* ── animate in ─────────────── */
	const slideFrom = SLIDE_DIR[pos];
	el.animate(
		[
			{ transform: slideFrom, opacity: 0 },
			{ transform: 'translateX(0) translateY(0)', opacity: 1 },
		],
		{ duration: ANIMATION_DURATION, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
	);

	container.appendChild(el);

	/* ── dismiss logic ──────────── */
	let timer = null;
	let remainingMs = duration;
	let startedAt = 0;
	let progressAnim = null;

	/** Start (or resume) the auto-dismiss countdown */
	const _startTimer = () => {
		if (duration <= 0) return;

		startedAt = Date.now();

		/* progress bar animation */
		if (progressEl) {
			progressAnim = progressEl.animate(
				[
					{ width: progressEl.style.width },
					{ width: '0%' },
				],
				{ duration: remainingMs, easing: 'linear', fill: 'forwards' },
			);
		}

		timer = setTimeout(() => _dismiss(), remainingMs);
	};

	/** Pause countdown (on hover) */
	const _pauseTimer = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (progressAnim) {
			progressAnim.pause();
		}
		const elapsed = Date.now() - startedAt;
		remainingMs = Math.max(remainingMs - elapsed, 0);
		/* snapshot current progress width so resume starts from here */
		if (progressEl && progressAnim) {
			const pct = duration > 0 ? (remainingMs / duration) * 100 : 0;
			progressEl.style.width = `${pct}%`;
		}
	};

	/** Dismiss a toast with exit animation + collapse */
	const _dismiss = () => {
		_activeToasts.delete(toastKey);
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (progressAnim) {
			progressAnim.cancel();
		}

		/* slide out */
		const exit = el.animate(
			[
				{ transform: 'translateX(0) translateY(0)', opacity: 1 },
				{ transform: slideFrom, opacity: 0 },
			],
			{ duration: ANIMATION_DURATION, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
		);

		exit.onfinish = () => {
			/* collapse height so siblings shift smoothly */
			const h = el.offsetHeight;
			el.style.minHeight = '0';
			el.style.padding = '0';
			el.style.margin = '0';
			el.style.overflow = 'hidden';

			const collapse = el.animate(
				[{ height: `${h}px` }, { height: '0px' }],
				{ duration: 200, easing: 'ease' },
			);
			collapse.onfinish = () => el.remove();
		};
	};

	/* ── event listeners ────────── */
	el.addEventListener('mouseenter', _pauseTimer);
	el.addEventListener('mouseleave', _startTimer);

	if (closable) {
		const closeBtn = el.querySelector('.wow3-toast-close');
		if (closeBtn) closeBtn.addEventListener('click', _dismiss);
	}

	/* kick off auto-dismiss */
	_startTimer();
};

/* ── public API ───────────────────────────────────── */

/**
 * Toast notification helper.
 * Call as toast.success(msg), toast.error(msg), toast.warning(msg), toast.info(msg).
 */
export const toast = {
	/**
	 * Show a success toast
	 * @param {string} message - Message to display
	 * @param {object} [options] - { duration, closable, position }
	 */
	success: (message, options) => _show('success', message, options),

	/**
	 * Show an error toast
	 * @param {string} message - Message to display
	 * @param {object} [options] - { duration, closable, position }
	 */
	error: (message, options) => _show('error', message, options),

	/**
	 * Show a warning toast
	 * @param {string} message - Message to display
	 * @param {object} [options] - { duration, closable, position }
	 */
	warning: (message, options) => _show('warning', message, options),

	/**
	 * Show an info toast
	 * @param {string} message - Message to display
	 * @param {object} [options] - { duration, closable, position }
	 */
	info: (message, options) => _show('info', message, options),
};

/* Expose globally for non-module scripts (template_manager, presentation_manager, etc.) */
window.toast = toast;

export default toast;
