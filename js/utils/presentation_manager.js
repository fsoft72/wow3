/**
 * PresentationManager: Handles UI and Logic for the Presentation Library.
 */

const PresentationManager = {
    state: {
        selectedPresentationId: null,
        searchQuery: '',
        presentations: []
    },

    init: async function() {
        this.renderOverlay();
        try {
            await this.refresh();
        } catch (e) {
            console.error("PresentationManager refresh failed during init:", e);
        }
        this.bindGlobalEvents();
    },

    renderOverlay: function() {
        if (document.getElementById('presentation-manager-overlay')) return;

        const html = `
            <div id="presentation-manager-overlay">
                <div id="presentation-manager-window">
                    <div class="pm-header">
                        <div class="pm-title-group">
                            <h2>${__('presentations')} <span class="pm-count" id="pm-total-count">0</span></h2>
                        </div>
                        <div class="pm-controls">
                            <div class="pm-search-bar">
                                <i class="material-icons">search</i>
                                <input type="text" id="pm-search-input" placeholder="${__('search_presentations')}">
                            </div>
                            <button class="btn-pm-primary" id="btn-pm-new">
                                <i class="material-icons">add</i> ${__('new_presentation')}
                            </button>
                            <button class="btn-pm-icon" id="btn-pm-close"><i class="material-icons">close</i></button>
                        </div>
                    </div>
                    <div class="pm-body">
                        <div class="pm-content" id="pm-content-area">
                            <!-- Grid injected here -->
                        </div>
                    </div>
                </div>
            </div>
            <div id="pm-context-menu"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    bindGlobalEvents: function() {
        document.getElementById('btn-pm-close').onclick = () => this.close();
        document.getElementById('btn-pm-new').onclick = () => this.createNew();

        document.getElementById('pm-search-input').oninput = (e) => {
            this.state.searchQuery = e.target.value;
            this.refresh();
        };

        // Context Menu handling
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#pm-context-menu')) {
                document.getElementById('pm-context-menu').style.display = 'none';
            }
        });
    },

    open: async function() {
        document.getElementById('presentation-manager-overlay').classList.add('active');
        await this.refresh();
    },

    close: function() {
        document.getElementById('presentation-manager-overlay').classList.remove('active');
    },

    refresh: async function() {
        if (this.state.searchQuery) {
            this.state.presentations = await PresentationsDB.searchPresentations(this.state.searchQuery);
        } else {
            this.state.presentations = await PresentationsDB.getAllPresentations();
        }

        this.renderGrid();
    },

    renderGrid: function() {
        const grid = document.getElementById('pm-content-area');
        const totalCount = document.getElementById('pm-total-count');
        totalCount.innerText = this.state.presentations.length;

        if (this.state.presentations.length === 0) {
            grid.innerHTML = `<div style="text-align:center; color:#555; margin-top:50px;">
                <i class="material-icons" style="font-size:48px; opacity:0.5">slideshow</i>
                <p>No presentations found.</p>
                <button class="btn-pm-primary" onclick="PresentationManager.createNew()" style="margin-top:20px;">
                    <i class="material-icons">add</i> Create Your First Presentation
                </button>
            </div>`;
            return;
        }

        // Group by Date (Simple: Today, Yesterday, Older)
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
                <div class="pm-date-group">
                    <div class="pm-date-header">${label} <span>(${items.length})</span></div>
                    <div class="pm-grid">
                        ${items.map(pres => this.renderCard(pres)).join('')}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    renderCard: function(pres) {
        const slideCount = pres.slides?.length || 0;
        const modified = new Date(pres.metadata?.modified || pres.metadata?.created || 0);
        const date = modified.toLocaleDateString();
        const time = modified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Use thumbnail if available, otherwise show placeholder
        const thumbnail = pres.thumbnail
            ? `<img src="${pres.thumbnail}" loading="lazy">`
            : `<div class="pm-card-placeholder"><i class="material-icons">slideshow</i></div>`;

        return `
            <div class="pm-card" onclick="PresentationManager.openPresentation('${pres.id}')">
                <div class="pm-card-preview">
                    ${thumbnail}
                    <button class="pm-card-delete" onclick="event.stopPropagation(); PresentationManager.deletePresentation('${pres.id}')" title="${__('delete')}">
                        <i class="material-icons">delete</i>
                    </button>
                    <div class="pm-card-actions">
                        <button class="btn-pm-action" onclick="event.stopPropagation(); PresentationManager.openPresentation('${pres.id}')">
                            <i class="material-icons">play_arrow</i> Open
                        </button>
                    </div>
                </div>
                <div class="pm-card-info" oncontextmenu="PresentationManager.showContextMenu(event, '${pres.id}')">
                    <div class="pm-card-title" title="${pres.title}">${pres.title}</div>
                    <div class="pm-card-meta">${slideCount} slides • ${date} ${time}</div>
                </div>
            </div>
        `;
    },

    createNew: async function() {
        this.close();
        // Trigger the editor's create new presentation
        if (window.app && window.app.editor) {
            await window.app.editor.createNewPresentation();
        }
    },

    openPresentation: async function(id) {
        try {
            const data = await PresentationsDB.getPresentation(id);
            if (data && window.app && window.app.editor) {
                this.close();
                await window.app.editor.loadPresentation(data);
            }
        } catch (error) {
            console.error('Failed to open presentation:', error);
            toast.error('Failed to open presentation');
        }
    },

    deletePresentation: async function(id) {
        if (await Dialog.confirm("Delete this presentation permanently?", "Delete Presentation")) {
            try {
                // Delete slide thumbnails before removing the presentation
                const data = await PresentationsDB.getPresentation(id);
                if (data && data.slides) {
                    const thumbIds = data.slides.map(s => s.thumbnailId).filter(Boolean);
                    if (data.shell?.thumbnailId) thumbIds.push(data.shell.thumbnailId);
                    await Promise.all(thumbIds.map(tid => MediaDB.deleteThumbnail(tid).catch(() => {})));
                }

                await PresentationsDB.deletePresentation(id);
                toast.success('Presentation deleted');
                await this.refresh();
            } catch (error) {
                console.error('Failed to delete presentation:', error);
                toast.error('Failed to delete presentation');
            }
        }
    },

    showContextMenu: function(e, id) {
        e.preventDefault();
        const menu = document.getElementById('pm-context-menu');
        menu.style.top = e.clientY + 'px';
        menu.style.left = e.clientX + 'px';
        menu.style.display = 'block';

        menu.innerHTML = `
            <div class="pm-context-item" onclick="PresentationManager.openPresentation('${id}')">
                <i class="material-icons">play_arrow</i> Open
            </div>
            <div class="pm-context-item" onclick="PresentationManager.renamePresentation('${id}')">
                <i class="material-icons">edit</i> Rename
            </div>
            <div class="pm-context-separator"></div>
            <div class="pm-context-item" onclick="PresentationManager.deletePresentation('${id}')">
                <i class="material-icons">delete</i> ${__('delete')}
            </div>
        `;
    },

    renamePresentation: async function(id) {
        try {
            const data = await PresentationsDB.getPresentation(id);
            if (!data) return;

            const newName = await Dialog.prompt("Rename Presentation:", data.title, "Rename");
            if (newName && newName.trim() !== '') {
                data.title = newName.trim();
                data.metadata.modified = new Date().toISOString();
                await PresentationsDB.savePresentation(data);
                toast.success('Presentation renamed');
                await this.refresh();
            }
        } catch (error) {
            console.error('Failed to rename presentation:', error);
            toast.error('Failed to rename presentation');
        }
    }
};

window.PresentationManager = PresentationManager;
