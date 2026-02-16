/**
 * AudioManager - Centralized audio playback management
 *
 * Singleton service that manages all audio element playback across the presentation.
 * Handles cross-slide audio continuity, fade-out transitions, and centralized control.
 */
class AudioManager {
	constructor() {
		if ( AudioManager._instance ) {
			return AudioManager._instance;
		}

		AudioManager._instance = this;

		// Audio registry: Map<elementId, { element: HTMLAudioElement, properties: Object }>
		this._audioRegistry = new Map();

		// ID of audio that should continue playing across slides
		this._continuingAudioId = null;

		// Set of audio elements currently fading out
		this._fadingAudios = new Set();

		// Event handlers: Map<event, callback[]>
		this._eventHandlers = new Map();
	}

	/**
	 * Get singleton instance
	 * @returns {AudioManager}
	 */
	static getInstance() {
		if ( ! AudioManager._instance ) {
			new AudioManager();
		}
		return AudioManager._instance;
	}

	// ========================================
	// Registration
	// ========================================

	/**
	 * Register an audio element
	 * @param {string} elementId - Element ID
	 * @param {HTMLAudioElement} audioElement - HTML audio element
	 * @param {Object} properties - Audio properties (continueOnSlides, url, autoplay, loop)
	 */
	register(elementId, audioElement, properties) {
		if ( ! elementId || ! audioElement ) return;

		this._audioRegistry.set(elementId, {
			element: audioElement,
			properties: properties || {}
		});

		// Set up event listeners
		audioElement.addEventListener('play', () => {
			// If this audio has continueOnSlides enabled, mark it as continuing
			if ( properties.continueOnSlides ) {
				this._continuingAudioId = elementId;
			}
			this.emit('playStateChanged', { elementId, playing: true });
		});

		audioElement.addEventListener('pause', () => {
			// If this was the continuing audio, clear it
			if ( this._continuingAudioId === elementId ) {
				this._continuingAudioId = null;
			}
			this.emit('playStateChanged', { elementId, playing: false });
		});

		audioElement.addEventListener('ended', () => {
			// If this was the continuing audio, clear it
			if ( this._continuingAudioId === elementId ) {
				this._continuingAudioId = null;
			}
			this.emit('playStateChanged', { elementId, playing: false });
		});
	}

	/**
	 * Unregister an audio element
	 * @param {string} elementId - Element ID
	 */
	unregister(elementId) {
		if ( ! elementId ) return;

		// Stop if currently playing
		this.stop(elementId);

		// Remove from registry
		this._audioRegistry.delete(elementId);

		// Clear if it was the continuing audio
		if ( this._continuingAudioId === elementId ) {
			this._continuingAudioId = null;
		}
	}

	// ========================================
	// Playback Control
	// ========================================

	/**
	 * Play an audio element
	 * @param {string} elementId - Element ID
	 */
	play(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio ) return;

		// Cancel any ongoing fade-out
		if ( this._fadingAudios.has(elementId) ) {
			this._fadingAudios.delete(elementId);
		}

		audio.element.play().catch(err => {
			console.warn('AudioManager: Failed to play audio', elementId, err);
		});
	}

	/**
	 * Pause an audio element
	 * @param {string} elementId - Element ID
	 */
	pause(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio ) return;

		audio.element.pause();
	}

	/**
	 * Stop an audio element (pause and reset to beginning)
	 * @param {string} elementId - Element ID
	 */
	stop(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio ) return;

		audio.element.pause();
		audio.element.currentTime = 0;
	}

	/**
	 * Toggle play/pause for an audio element
	 * @param {string} elementId - Element ID
	 */
	toggle(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio ) return;

		if ( audio.element.paused ) {
			this.play(elementId);
		} else {
			this.pause(elementId);
		}
	}

	// ========================================
	// Slide Transitions
	// ========================================

	/**
	 * Handle slide change
	 * @param {Object} slide - The new slide object
	 */
	onSlideChange(slide) {
		if ( ! slide ) return;

		// Check if new slide has any audio elements
		const hasAudioElements = slide.elements && slide.elements.some(el => el.type === 'audio');

		if ( hasAudioElements ) {
			// New slide has audio - fade out and stop continuing audio
			if ( this._continuingAudioId ) {
				this._fadeOutAndStop(this._continuingAudioId);
				this._continuingAudioId = null;
			}
		}
		// If no audio elements, let continuing audio continue playing

		// Start autoplay audio if present on new slide
		if ( slide.elements ) {
			slide.elements.forEach(el => {
				if ( el.type === 'audio' && el.properties && el.properties.autoplay ) {
					// Small delay to ensure element is rendered
					setTimeout(() => {
						this.play(el.id);
					}, 100);
				}
			});
		}
	}

	/**
	 * Stop all audio elements
	 * @param {boolean} fadeOut - Whether to fade out (default: false)
	 */
	stopAll(fadeOut = false) {
		this._audioRegistry.forEach((audio, elementId) => {
			if ( fadeOut ) {
				this._fadeOutAndStop(elementId);
			} else {
				this.stop(elementId);
			}
		});

		this._continuingAudioId = null;
	}

	/**
	 * Fade out and stop an audio element
	 * @param {string} elementId - Element ID
	 * @private
	 */
	_fadeOutAndStop(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio || audio.element.paused ) return;

		// Prevent multiple fade-outs
		if ( this._fadingAudios.has(elementId) ) return;
		this._fadingAudios.add(elementId);

		const element = audio.element;
		const originalVolume = element.volume;
		const fadeStart = performance.now();
		const fadeDuration = 500; // 500ms fade

		const fadeStep = (timestamp) => {
			const elapsed = timestamp - fadeStart;
			const progress = Math.min(elapsed / fadeDuration, 1);

			element.volume = originalVolume * (1 - progress);

			if ( progress < 1 ) {
				requestAnimationFrame(fadeStep);
			} else {
				// Fade complete
				element.pause();
				element.volume = originalVolume; // Restore volume
				this._fadingAudios.delete(elementId);
			}
		};

		requestAnimationFrame(fadeStep);
	}

	// ========================================
	// State Queries
	// ========================================

	/**
	 * Check if an audio element is currently playing
	 * @param {string} elementId - Element ID
	 * @returns {boolean}
	 */
	isPlaying(elementId) {
		const audio = this._audioRegistry.get(elementId);
		if ( ! audio ) return false;

		return ! audio.element.paused;
	}

	/**
	 * Get IDs of all currently playing audio elements
	 * @returns {string[]}
	 */
	getCurrentlyPlaying() {
		const playing = [];
		this._audioRegistry.forEach((audio, elementId) => {
			if ( ! audio.element.paused ) {
				playing.push(elementId);
			}
		});
		return playing;
	}

	/**
	 * Get the ID of the audio that should continue across slides
	 * @returns {string|null}
	 */
	getContinuingAudio() {
		return this._continuingAudioId;
	}

	// ========================================
	// Event System
	// ========================================

	/**
	 * Register event handler
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback function
	 */
	on(event, callback) {
		if ( ! this._eventHandlers.has(event) ) {
			this._eventHandlers.set(event, []);
		}
		this._eventHandlers.get(event).push(callback);
	}

	/**
	 * Emit event
	 * @param {string} event - Event name
	 * @param {*} data - Event data
	 */
	emit(event, data) {
		if ( ! this._eventHandlers.has(event) ) return;

		this._eventHandlers.get(event).forEach(callback => {
			try {
				callback(data);
			} catch (err) {
				console.error('AudioManager: Error in event handler', event, err);
			}
		});
	}
}

// Make singleton globally available
window.AudioManager = AudioManager.getInstance();
