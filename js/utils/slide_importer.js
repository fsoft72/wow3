/**
 * SlideImporter: Two-step overlay for cherry-picking slides from other presentations.
 * Step 1: Pick a presentation from the saved library.
 * Step 2: Pick individual slides to import after the current slide.
 */

const SlideImporter = {
    state: {
        step: 'presentations',       // 'presentations' | 'slides'
        presentations: [],
        searchQuery: '',
        selectedPresentationData: null,
        selectedSlideIds: new Set(),
        thumbnailMap: new Map()
    },

    /**
     * Initialize the SlideImporter overlay and bind events
     */
    init: async function () {
        this.renderOverlay();
        this.bindGlobalEvents();
    },

    /**
     * Render the overlay DOM structure into the document body
     */
    renderOverlay: function () {
        if (document.getElementById('slide-importer-overlay')) return;

        const html = `
            <div id="slide-importer-overlay">
                <div id="slide-importer-window">
                    <div class="si-header" id="si-header">
                        <!-- Header content injected per step -->
                    </div>
                    <div class="si-toolbar" id="si-toolbar" style="display:none;">
                        <!-- Toolbar for step 2 -->
                    </div>
                    <div class="si-body">
                        <div class="si-content" id="si-content-area">
                            <!-- Grid injected here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    /**
     * Bind global event listeners (close button, search, keyboard)
     */
    bindGlobalEvents: function () {
        document.getElementById('slide-importer-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'slide-importer-overlay') this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('slide-importer-overlay');
                if (overlay && overlay.classList.contains('active')) {
                    if (this.state.step === 'slides') {
                        this.goBack();
                    } else {
                        this.close();
                    }
                }
            }
        });
    },

    /**
     * Open the slide importer overlay and refresh data
     */
    open: async function () {
        this.state.step = 'presentations';
        this.state.searchQuery = '';
        this.state.selectedPresentationData = null;
        this.state.selectedSlideIds.clear();
        this.state.thumbnailMap.clear();

        document.getElementById('slide-importer-overlay').classList.add('active');
        this.renderHeader();
        document.getElementById('si-toolbar').style.display = 'none';
        await this.refresh();
    },

    /**
     * Close the slide importer overlay
     */
    close: function () {
        document.getElementById('slide-importer-overlay').classList.remove('active');
    },

    /**
     * Refresh the presentation list from the database and render
     */
    refresh: async function () {
        if (this.state.searchQuery) {
            this.state.presentations = await PresentationsDB.searchPresentations(this.state.searchQuery);
        } else {
            this.state.presentations = await PresentationsDB.getAllPresentations();
        }

        // Exclude current presentation
        const currentId = window.app?.editor?.presentation?.id;
        if (currentId) {
            this.state.presentations = this.state.presentations.filter(p => p.id !== currentId);
        }

        this.renderGrid();
    },

    /**
     * Render the header based on current step
     */
    renderHeader: function () {
        const header = document.getElementById('si-header');

        if (this.state.step === 'presentations') {
            header.innerHTML = `
                <div class="si-title-group">
                    <h2>${__('insert_slides')} <span class="si-count" id="si-total-count">0</span></h2>
                </div>
                <div class="si-controls">
                    <div class="si-search-bar">
                        <i class="material-icons">search</i>
                        <input type="text" id="si-search-input" placeholder="${__('search_presentations')}" value="${this.state.searchQuery}">
                    </div>
                    <button class="btn-si-icon" id="btn-si-close"><i class="material-icons">close</i></button>
                </div>
            `;

            document.getElementById('btn-si-close').onclick = () => this.close();
            document.getElementById('si-search-input').oninput = (e) => {
                this.state.searchQuery = e.target.value;
                this.refresh();
            };
        } else {
            const pres = this.state.selectedPresentationData;
            const slideCount = pres?.slides?.length || 0;

            header.innerHTML = `
                <div class="si-title-group" style="display:flex; align-items:center; gap:15px;">
                    <button class="btn-si-back" id="btn-si-back">
                        <i class="material-icons">arrow_back</i> Back
                    </button>
                    <h2>${pres?.title || 'Presentation'} <span class="si-count">${slideCount} slides</span></h2>
                </div>
                <div class="si-controls">
                    <button class="btn-si-icon" id="btn-si-close"><i class="material-icons">close</i></button>
                </div>
            `;

            document.getElementById('btn-si-back').onclick = () => this.goBack();
            document.getElementById('btn-si-close').onclick = () => this.close();
        }
    },

    /**
     * Render the presentation grid (step 1)
     */
    renderGrid: function () {
        const grid = document.getElementById('si-content-area');
        const totalCount = document.getElementById('si-total-count');
        if (totalCount) totalCount.innerText = this.state.presentations.length;

        if (this.state.presentations.length === 0) {
            grid.innerHTML = `
                <div class="si-empty">
                    <i class="material-icons">slideshow</i>
                    <p>No other presentations found.</p>
                </div>
            `;
            return;
        }

        // Group by date
        const groups = { 'Today': [], 'Yesterday': [], 'Older': [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        this.state.presentations.forEach(pres => {
            const modified = new Date(pres.metadata?.modified || pres.metadata?.created || 0).getTime();
            if (modified >= today) groups['Today'].push(pres);
            else if (modified >= yesterday) groups['Yesterday'].push(pres);
            else groups['Older'].push(pres);
        });

        let html = '';
        for (const [label, items] of Object.entries(groups)) {
            if (items.length === 0) continue;
            html += `
                <div class="si-date-group">
                    <div class="si-date-header">${label} <span>(${items.length})</span></div>
                    <div class="si-grid">
                        ${items.map(pres => this.renderCard(pres)).join('')}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    /**
     * Render a single presentation card
     * @param {Object} pres - Presentation data
     * @returns {string} HTML string
     */
    renderCard: function (pres) {
        const slideCount = pres.slides?.length || 0;
        const modified = new Date(pres.metadata?.modified || pres.metadata?.created || 0);
        const date = modified.toLocaleDateString();
        const time = modified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const thumbnail = pres.thumbnail
            ? `<img src="${pres.thumbnail}" loading="lazy">`
            : `<div class="si-card-placeholder"><i class="material-icons">slideshow</i></div>`;

        return `
            <div class="si-card" onclick="SlideImporter.selectPresentation('${pres.id}')">
                <div class="si-card-preview">
                    ${thumbnail}
                    <div class="si-card-actions">
                        <button class="btn-si-action" onclick="event.stopPropagation(); SlideImporter.selectPresentation('${pres.id}')">
                            <i class="material-icons">visibility</i> View Slides
                        </button>
                    </div>
                </div>
                <div class="si-card-info">
                    <div class="si-card-title" title="${pres.title}">${pres.title}</div>
                    <div class="si-card-meta">${slideCount} slides • ${date} ${time}</div>
                </div>
            </div>
        `;
    },

    /**
     * Select a presentation and switch to the slide picker view (step 2)
     * @param {string} id - Presentation ID
     */
    selectPresentation: async function (id) {
        try {
            const data = await PresentationsDB.getPresentation(id);
            if (!data) {
                toast.error('Failed to load presentation');
                return;
            }

            this.state.selectedPresentationData = data;
            this.state.selectedSlideIds.clear();
            this.state.step = 'slides';

            // Load thumbnails for slides
            const thumbIds = (data.slides || []).map(s => s.thumbnailId).filter(Boolean);
            this.state.thumbnailMap = await MediaDB.loadThumbnails(thumbIds);

            this.renderHeader();
            this.renderSlidePicker();
        } catch (error) {
            console.error('Failed to load presentation for import:', error);
            toast.error('Failed to load presentation');
        }
    },

    /**
     * Render the slide picker toolbar and grid (step 2)
     */
    renderSlidePicker: function () {
        // Show and populate toolbar
        const toolbar = document.getElementById('si-toolbar');
        toolbar.style.display = 'flex';
        this.updateToolbar();

        // Render slide cards
        const grid = document.getElementById('si-content-area');
        const slides = this.state.selectedPresentationData?.slides || [];

        if (slides.length === 0) {
            grid.innerHTML = `
                <div class="si-empty">
                    <i class="material-icons">filter_none</i>
                    <p>This presentation has no slides.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="si-slide-grid">';
        slides.forEach((slide, idx) => {
            html += this.renderSlideCard(slide, idx);
        });
        html += '</div>';
        grid.innerHTML = html;
    },

    /**
     * Update the toolbar with current selection state
     */
    updateToolbar: function () {
        const toolbar = document.getElementById('si-toolbar');
        const count = this.state.selectedSlideIds.size;

        toolbar.innerHTML = `
            <button class="btn-si-tool" onclick="SlideImporter.selectAll()">${__('select_all')}</button>
            <button class="btn-si-tool" onclick="SlideImporter.selectNone()">${__('select_none')}</button>
            <span class="si-selected-count">${count} selected</span>
            <span class="si-toolbar-spacer"></span>
            <button class="btn-si-import" id="btn-si-import" onclick="SlideImporter.importSelected()" ${count === 0 ? 'disabled' : ''}>
                <i class="material-icons">file_download</i> ${__('import_slides')}${count > 0 ? ` (${count})` : ''}
            </button>
        `;
    },

    /**
     * Render a single slide card with thumbnail and checkbox
     * @param {Object} slide - Slide JSON data
     * @param {number} index - Slide index
     * @returns {string} HTML string
     */
    renderSlideCard: function (slide, index) {
        const isSelected = this.state.selectedSlideIds.has(slide.id);
        const selectedClass = isSelected ? ' selected' : '';
        const title = slide.title || `Slide ${index + 1}`;

        let previewHTML;
        const thumbUrl = this.state.thumbnailMap.get(slide.thumbnailId);
        if (thumbUrl) {
            previewHTML = `<img src="${thumbUrl}" loading="lazy">`;
        } else {
            previewHTML = this._renderSlidePreviewHTML(slide);
        }

        return `
            <div class="si-slide-card${selectedClass}" onclick="SlideImporter.toggleSlide('${slide.id}')" data-slide-id="${slide.id}">
                <div class="si-slide-preview">
                    <div class="si-slide-checkbox"><i class="material-icons">check</i></div>
                    ${previewHTML}
                </div>
                <div class="si-slide-info">
                    <div class="si-slide-title" title="${title}">${index + 1}. ${title}</div>
                </div>
            </div>
        `;
    },

    /**
     * Render a miniature slide preview as HTML fallback (when no stored thumbnail)
     * @param {Object} slideData - Slide JSON data
     * @returns {string} HTML string for the preview
     */
    _renderSlidePreviewHTML: function (slideData) {
        const PREVIEW_WIDTH = 220;
        const SLIDE_WIDTH = 1280;
        const scale = PREVIEW_WIDTH / SLIDE_WIDTH;

        let elementsHTML = '';
        if (slideData.elements && slideData.elements.length > 0) {
            slideData.elements.forEach((el, idx) => {
                const pos = el.position || {};
                const props = el.properties || {};
                const left = (pos.x || 0) * scale;
                const top = (pos.y || 0) * scale;
                const width = (pos.width || 100) * scale;
                const height = (pos.height || 50) * scale;
                const rotation = pos.rotation || 0;

                let bg = 'rgba(200,200,200,0.3)';
                let textContent = '';
                let textColor = '#333';
                let fontSize = 3;

                if (el.type === 'shape') {
                    bg = props.fillColor || '#ccc';
                } else if (el.type === 'text') {
                    bg = props.backgroundColor && props.backgroundColor !== 'transparent'
                        ? props.backgroundColor : 'transparent';
                    textContent = (props.text || '').substring(0, 30);
                    textColor = props.font?.color || '#333';
                    fontSize = Math.max(2, (props.font?.size || 16) * scale);
                }

                elementsHTML += `<div class="si-slide-mini-preview-element" style="
                    left:${left}px; top:${top}px; width:${width}px; height:${height}px;
                    transform:rotate(${rotation}deg);
                    background:${bg}; color:${textColor}; font-size:${fontSize}px;
                    z-index:${idx}; overflow:hidden;
                ">${textContent}</div>`;
            });
        }

        return `<div class="si-slide-mini-preview" style="background:${slideData.background || '#fff'};">${elementsHTML}</div>`;
    },

    /**
     * Toggle selection of a slide by ID
     * @param {string} slideId - Slide ID to toggle
     */
    toggleSlide: function (slideId) {
        if (this.state.selectedSlideIds.has(slideId)) {
            this.state.selectedSlideIds.delete(slideId);
        } else {
            this.state.selectedSlideIds.add(slideId);
        }

        // Update the card's visual state
        const card = document.querySelector(`.si-slide-card[data-slide-id="${slideId}"]`);
        if (card) {
            card.classList.toggle('selected', this.state.selectedSlideIds.has(slideId));
        }

        this.updateToolbar();
    },

    /**
     * Select all slides
     */
    selectAll: function () {
        const slides = this.state.selectedPresentationData?.slides || [];
        slides.forEach(s => this.state.selectedSlideIds.add(s.id));

        document.querySelectorAll('.si-slide-card').forEach(card => {
            card.classList.add('selected');
        });

        this.updateToolbar();
    },

    /**
     * Deselect all slides
     */
    selectNone: function () {
        this.state.selectedSlideIds.clear();

        document.querySelectorAll('.si-slide-card').forEach(card => {
            card.classList.remove('selected');
        });

        this.updateToolbar();
    },

    /**
     * Import selected slides into the current presentation
     */
    importSelected: async function () {
        if (this.state.selectedSlideIds.size === 0) return;

        const slides = this.state.selectedPresentationData?.slides || [];
        // Maintain original order by filtering in slide array order
        const selectedSlides = slides.filter(s => this.state.selectedSlideIds.has(s.id));

        if (selectedSlides.length === 0) return;

        this.close();

        if (window.app && window.app.editor) {
            await window.app.editor.importSlidesFromPresentation(selectedSlides);
        }
    },

    /**
     * Go back from slide picker (step 2) to presentation list (step 1)
     */
    goBack: function () {
        this.state.step = 'presentations';
        this.state.selectedPresentationData = null;
        this.state.selectedSlideIds.clear();
        this.state.thumbnailMap.clear();

        this.renderHeader();
        document.getElementById('si-toolbar').style.display = 'none';
        this.refresh();
    }
};

window.SlideImporter = SlideImporter;
