/**
 * WOW3 Media Manager
 * Manages media library stored in IndexedDB
 */

export class MediaManager {
  constructor() {
    this.modal = null;
    this.mediaGrid = null;
  }

  /**
   * Initialize media manager
   */
  async init() {
    console.log('Initializing MediaManager...');

    // Get modal reference
    this.modal = document.getElementById('media-manager-modal');
    this.mediaGrid = document.getElementById('media-grid');

    // Initialize modal
    if (this.modal) {
      M.Modal.init(this.modal, {
        dismissible: true,
        onOpenStart: () => this.loadMedia()
      });
    }

    console.log('MediaManager initialized');
  }

  /**
   * Open media manager modal
   */
  open() {
    if (this.modal) {
      const instance = M.Modal.getInstance(this.modal);
      instance.open();
    }
  }

  /**
   * Load and display all media
   */
  async loadMedia() {
    if (!this.mediaGrid) return;

    try {
      // Show loading
      this.mediaGrid.innerHTML = '<div class="center-align" style="padding: 40px;"><div class="preloader-wrapper small active"><div class="spinner-layer spinner-blue-only"><div class="circle-clipper left"><div class="circle"></div></div><div class="gap-patch"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div></div>';

      const mediaItems = await MediaDB.getAllMedia();

      if (mediaItems.length === 0) {
        this.mediaGrid.innerHTML = '<p class="grey-text center-align" style="padding: 40px;">No media files in library</p>';
        return;
      }

      // Clear grid
      this.mediaGrid.innerHTML = '';

      // Create grid items
      for (const item of mediaItems) {
        const card = await this.createMediaCard(item);
        this.mediaGrid.appendChild(card);
      }

    } catch (error) {
      console.error('Failed to load media:', error);
      this.mediaGrid.innerHTML = '<p class="red-text center-align" style="padding: 40px;">Failed to load media</p>';
    }
  }

  /**
   * Create media card element
   * @param {Object} item - Media item from IndexedDB
   * @returns {Promise<HTMLElement>} Card element
   */
  async createMediaCard(item) {
    const card = document.createElement('div');
    card.className = 'media-card';

    // Get preview URL
    const dataURL = await MediaDB.getMediaDataURL(item.id);

    // Create preview
    const preview = document.createElement('div');
    preview.className = 'media-preview';

    if (item.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = dataURL;
      img.alt = item.name;
      preview.appendChild(img);
    } else if (item.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = dataURL;
      video.controls = false;
      preview.appendChild(video);

      // Add play icon overlay
      const playIcon = document.createElement('i');
      playIcon.className = 'material-icons media-icon';
      playIcon.textContent = 'play_circle_filled';
      preview.appendChild(playIcon);
    } else if (item.type.startsWith('audio/')) {
      const icon = document.createElement('i');
      icon.className = 'material-icons media-icon-large';
      icon.textContent = 'audiotrack';
      preview.appendChild(icon);
    }

    card.appendChild(preview);

    // Create info section
    const info = document.createElement('div');
    info.className = 'media-info';

    const name = document.createElement('div');
    name.className = 'media-name';
    name.textContent = item.name;
    name.title = item.name;
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'media-meta';
    meta.textContent = `${this.formatFileSize(item.size)} • ${this.formatDate(item.createdAt)}`;
    info.appendChild(meta);

    card.appendChild(info);

    // Create actions
    const actions = document.createElement('div');
    actions.className = 'media-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-flat waves-effect red-text';
    deleteBtn.innerHTML = '<i class="material-icons">delete</i>';
    deleteBtn.title = 'Delete media';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteMedia(item.id);
    };

    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    return card;
  }

  /**
   * Delete media item
   * @param {string} mediaId - Media ID to delete
   */
  async deleteMedia(mediaId) {
    if (!confirm('Are you sure you want to delete this media file? Elements using this media will be affected.')) {
      return;
    }

    try {
      await MediaDB.deleteMedia(mediaId);
      M.toast({ html: 'Media deleted', classes: 'green' });

      // Reload media grid
      await this.loadMedia();

      // Re-render current slide to update affected elements
      if (window.app && window.app.editor && window.app.editor.slideController) {
        window.app.editor.slideController.renderCurrentSlide();
      }

    } catch (error) {
      console.error('Failed to delete media:', error);
      M.toast({ html: 'Failed to delete media', classes: 'red' });
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format date for display
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }
}

export default MediaManager;
