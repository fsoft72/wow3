/**
 * MediaManager: Handles UI and Logic for the Media Library.
 */

const MediaManager = {
    state: {
        currentFolderId: 'all', // 'all', null (root), or folder ID
        selectedItems: new Set(),
        searchQuery: '',
        folders: [],
        items: []
    },

    init: async function() {
        this.renderOverlay();
        try {
            await this.refresh();
        } catch (e) {
            console.error("MediaManager refresh failed during init:", e);
        }
        this.bindGlobalEvents();
    },

    renderOverlay: function() {
        if (document.getElementById('media-manager-overlay')) return;

                const html = `
                    <div id="media-manager-overlay">
                        <div id="media-manager-window">
                            <div class="mm-header">
                                <div class="mm-title-group">
                                    <h2>${__('media_library')} <span class="mm-count" id="mm-total-count">0</span></h2>
                                </div>
                                <div class="mm-controls">
                                    <div class="mm-search-bar">
                                        <i class="material-icons">search</i>
                                        <input type="text" id="mm-search-input" placeholder="${__('search_widgets_placeholder')}">
                                    </div>
                                    <button class="btn-mm-primary" id="btn-mm-upload">
                                        <i class="material-icons">cloud_upload</i> ${__('add')}
                                    </button>
                                    <input type="file" id="mm-upload-input" multiple style="display:none">
                                    <button class="btn-mm-icon" id="btn-mm-close"><i class="material-icons">close</i></button>
                                </div>
                            </div>
                            <div class="mm-body">
                                <div class="mm-sidebar">
                                    <div class="section-title">${__('media_library')}</div>
                                    <div class="mm-nav-item active" data-id="all" onclick="MediaManager.selectFolder('all')" ondrop="MediaManager.handleMoveToFolder(event, 'all')" ondragover="MediaManager.handleDragOver(event)" ondragleave="MediaManager.handleDragLeave(event)">
                                        <i class="material-icons">photo_library</i> ${__('home_page_name')}
                                    </div>
                                    <div class="section-title" style="margin-top:20px; display:flex; justify-content:space-between; align-items:center;">
                                        ALBUMS
                                        <i class="material-icons" style="cursor:pointer; font-size:16px" onclick="MediaManager.promptCreateFolder()">add</i>
                                    </div>
                                    <div id="mm-folder-list">
                                        <!-- Folders injected here -->
                                    </div>
                                </div>
                                <div class="mm-content" id="mm-content-area" ondrop="MediaManager.handleDrop(event)" ondragover="event.preventDefault()">
                                    <!-- Grid injected here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="mm-context-menu"></div>
                    <div id="mm-preview-overlay" onclick="this.classList.remove('active')">
                        <img id="mm-preview-img" src="">
                        <div id="mm-audio-preview-container" onclick="event.stopPropagation()"></div>
                    </div>
                `;        document.body.insertAdjacentHTML('beforeend', html);
    },

    bindGlobalEvents: function() {
        document.getElementById('btn-mm-close').onclick = () => this.close();
        document.getElementById('btn-mm-upload').onclick = () => document.getElementById('mm-upload-input').click();
        
        document.getElementById('mm-upload-input').onchange = (e) => this.handleUpload(e.target.files);
        
        document.getElementById('mm-search-input').oninput = (e) => {
            this.state.searchQuery = e.target.value;
            this.refresh();
        };

        // Context Menu handling
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mm-context-menu')) {
                document.getElementById('mm-context-menu').style.display = 'none';
            }
        });
    },

    open: async function(onSelectCallback) {
        this.onSelectCallback = onSelectCallback;
        document.getElementById('media-manager-overlay').classList.add('active');
        await this.refresh();
    },

    close: function() {
        document.getElementById('media-manager-overlay').classList.remove('active');
        this.onSelectCallback = null;
    },

    refresh: async function() {
        this.state.folders = await MediaDB.getFolders();
        
        if (this.state.searchQuery) {
            this.state.items = await MediaDB.searchMedia(this.state.searchQuery);
        } else {
            this.state.items = await MediaDB.getMedia(this.state.currentFolderId);
        }

        this.renderSidebar();
        this.renderGrid();
    },

    renderSidebar: function() {
        const list = document.getElementById('mm-folder-list');
        list.innerHTML = this.state.folders.map(f => `
            <div class="mm-nav-item ${this.state.currentFolderId === f.id ? 'active' : ''}"
                 onclick="MediaManager.selectFolder('${f.id}')"
                 oncontextmenu="MediaManager.showFolderContextMenu(event, '${f.id}')"
                 ondrop="MediaManager.handleMoveToFolder(event, '${f.id}')"
                 ondragover="MediaManager.handleDragOver(event)"
                 ondragleave="MediaManager.handleDragLeave(event)">
                <i class="material-icons">folder</i>
                <span class="mm-folder-name">${f.name}</span>
                <button class="mm-folder-delete" onclick="event.stopPropagation(); MediaManager.deleteFolder('${f.id}')" title="Delete album">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        `).join('');
        
        // Update All Photos active state
        const allBtn = document.querySelector('.mm-nav-item[data-id="all"]');
        if (this.state.currentFolderId === 'all') allBtn.classList.add('active');
        else allBtn.classList.remove('active');
    },

    renderGrid: function() {
        const grid = document.getElementById('mm-content-area');
        const totalCount = document.getElementById('mm-total-count');
        totalCount.innerText = this.state.items.length;

        if (this.state.items.length === 0) {
            grid.innerHTML = `<div style="text-align:center; color:#555; margin-top:50px;">
                <i class="material-icons" style="font-size:48px; opacity:0.5">image_not_supported</i>
                <p>No media found.</p>
            </div>`;
            return;
        }

        // Group by Date (Simple: Today, Yesterday, Older)
        const groups = { 'Today': [], 'Yesterday': [], 'Older': [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        this.state.items.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
            if (item.createdAt >= today) groups['Today'].push(item);
            else if (item.createdAt >= yesterday) groups['Yesterday'].push(item);
            else groups['Older'].push(item);
        });

        let html = '';
        for (const [label, items] of Object.entries(groups)) {
            if (items.length === 0) continue;
            html += `
                <div class="mm-date-group">
                    <div class="mm-date-header">${label} <span>(${items.length})</span></div>
                    <div class="mm-grid">
                        ${items.map(item => this.renderCard(item)).join('')}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

        renderCard: function(item) {
            let preview = '';
            let isImage = item.type.startsWith('image/');
            let isVideo = item.type.startsWith('video/');
            let isAudio = item.type.startsWith('audio/');
    
            if (isImage) {
                const url = URL.createObjectURL(item.blob);
                preview = `<img src="${url}" loading="lazy">`;
            } else if (isVideo) {
                const url = URL.createObjectURL(item.blob);
                preview = `<video src="${url}" preload="metadata"></video><i class="material-icons" style="position:absolute;color:white;text-shadow:0 2px 4px rgba(0,0,0,0.5)">play_circle_outline</i>`;
            } else if (isAudio) {
                preview = `<i class="material-icons">volume_up</i>`;
            } else {
                preview = `<i class="material-icons">insert_drive_file</i>`;
            }
    
            const date = new Date(item.createdAt).toLocaleDateString();
            const size = (item.size / 1024 / 1024).toFixed(2) + ' MB';
    
            const showInsert = !!this.onSelectCallback;
    
            return `
                <div class="mm-card" draggable="true" ondragstart="MediaManager.handleDragStart(event, '${item.id}')">
                    <div class="mm-card-preview">
                        ${preview}
                        <button class="mm-card-delete" onclick="event.stopPropagation(); MediaManager.deleteItem('${item.id}')" title="${__('delete')}">
                            <i class="material-icons">delete</i>
                        </button>
                        <div class="mm-card-actions">
                            ${showInsert ? `<button class="btn-mm-action" onclick="MediaManager.handleItemClick('${item.id}')"><i class="material-icons">add_circle</i> ${__('add')}</button>` : ''}
                            ${isImage ? `<button class="btn-mm-action preview" onclick="MediaManager.openPreview('${item.id}')"><i class="material-icons">visibility</i> Preview</button>` : ''}
                            ${isAudio ? `<button class="btn-mm-action preview" onclick="MediaManager.openAudioPreview('${item.id}')"><i class="material-icons">play_arrow</i> Preview</button>` : ''}
                        </div>
                    </div>
                    <div class="mm-card-info" onclick="MediaManager.handleItemClick('${item.id}')" oncontextmenu="MediaManager.showItemContextMenu(event, '${item.id}')">
                        <div class="mm-card-title" title="${item.name}">${item.name}</div>
                        <div class="mm-card-meta">${date} • ${size}</div>
                    </div>
                </div>
            `;
        },
    
        selectFolder: function(id) {
            this.state.currentFolderId = id;
            this.refresh();
        },
    
        handleUpload: async function(files) {
            const folderId = this.state.currentFolderId === 'all' ? null : this.state.currentFolderId;

            for (const file of files) {
                const metadata = { lastModified: file.lastModified };
                if (file.type.startsWith('image/')) {
                    try {
                        const dimensions = await this.getImageDimensions(file);
                        Object.assign(metadata, dimensions);
                    } catch(e) {}
                } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                    try {
                        const duration = await this.getMediaDuration(file);
                        metadata.duration = duration;
                    } catch(e) {}
                }
                await MediaDB.addMedia(file, folderId, metadata);
            }
            await this.refresh();
        },
    
        handleDrop: function(e) {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleUpload(e.dataTransfer.files);
            }
        },
    
        handleDragStart: function(e, id) {
            e.dataTransfer.setData('mediaId', id);
            e.dataTransfer.effectAllowed = 'move';
        },
    
        handleDragOver: function(e) {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        },
    
        handleDragLeave: function(e) {
            e.currentTarget.classList.remove('drag-over');
        },
    
        handleMoveToFolder: async function(e, folderId) {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            const mediaId = e.dataTransfer.getData('mediaId');
            if (!mediaId) return;
    
            const actualFolderId = folderId === 'all' ? null : folderId;
    
            // Update DB directly
            const item = await MediaDB.getMediaItem(mediaId);
            if (item) {
                item.folderId = actualFolderId;
                await MediaDB.updateMedia(item);
                await this.refresh();
            }
        },
    
        handleItemClick: function(id) {
            if (this.onSelectCallback) {
                const item = this.state.items.find(i => i.id === id);
                this.onSelectCallback({
                    url: URL.createObjectURL(item.blob),
                    localUrl: `local://${item.id}`,
                    originalItem: item,
                    alt: item.name
                });
                this.close();
            }
        },
    
        openPreview: function(id) {
            const item = this.state.items.find(i => i.id === id);
            if (!item || !item.type.startsWith('image/')) return;
    
            const overlay = document.getElementById('mm-preview-overlay');
            const img = document.getElementById('mm-preview-img');
            const audioContainer = document.getElementById('mm-audio-preview-container');
            
            img.style.display = 'block';
            audioContainer.style.display = 'none';
            img.src = URL.createObjectURL(item.blob);
            overlay.classList.add('active');
        },

        openAudioPreview: function(id) {
            const item = this.state.items.find(i => i.id === id);
            if (!item || !item.type.startsWith('audio/')) return;
    
            const overlay = document.getElementById('mm-preview-overlay');
            const img = document.getElementById('mm-preview-img');
            const audioContainer = document.getElementById('mm-audio-preview-container');
            
            img.style.display = 'none';
            audioContainer.style.display = 'flex';
            audioContainer.innerHTML = `
                <div class="mm-audio-player">
                    <h3>${item.name}</h3>
                    <audio controls autoplay src="${URL.createObjectURL(item.blob)}"></audio>
                </div>
            `;
            
            overlay.classList.add('active');
        },
    
        getImageDimensions: function(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        },

        getMediaDuration: function(file) {
            return new Promise((resolve) => {
                const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
                media.preload = 'metadata';
                media.onloadedmetadata = () => resolve(media.duration);
                media.onerror = () => resolve(0);
                media.src = URL.createObjectURL(file);
            });
        },
    
        // --- CONTEXT MENUS & ACTIONS ---
    
        showItemContextMenu: function(e, id) {
            e.preventDefault();
            const menu = document.getElementById('mm-context-menu');
            menu.style.top = e.clientY + 'px';
            menu.style.left = e.clientX + 'px';
            menu.style.display = 'block';
    
            menu.innerHTML = `
                <div class="mm-context-item" onclick="MediaManager.deleteItem('${id}')"><i class="material-icons">delete</i> ${__('delete')}</div>
                <div class="mm-context-separator"></div>
                <div class="mm-context-item"><i class="material-icons">info</i> Properties</div>
            `;
        },
    
        showFolderContextMenu: function(e, id) {
            e.preventDefault();
            if(id === 'all') return;
            const menu = document.getElementById('mm-context-menu');
            menu.style.top = e.clientY + 'px';
            menu.style.left = e.clientX + 'px';
            menu.style.display = 'block';
    
            menu.innerHTML = `
                <div class="mm-context-item" onclick="MediaManager.promptRenameFolder('${id}')"><i class="material-icons">edit</i> Rename</div>
                <div class="mm-context-item" onclick="MediaManager.deleteFolder('${id}')"><i class="material-icons">delete</i> ${__('delete')}</div>
            `;
        },
    promptCreateFolder: async function() {
        const name = await Dialog.prompt("New Album Name:");
        if (name) {
            await MediaDB.createFolder(name);
            this.refresh();
        }
    },

    promptRenameFolder: async function(id) {
        const name = await Dialog.prompt("Rename Album:");
        if (name) {
            await MediaDB.renameFolder(id, name);
            this.refresh();
        }
    },

    deleteFolder: async function(id) {
        if(await Dialog.confirm("Delete this album? Items inside will be moved to 'All Photos'.")) {
            await MediaDB.deleteFolder(id);
            if(this.state.currentFolderId === id) this.state.currentFolderId = 'all';
            this.refresh();
        }
    },

    deleteItem: async function(id) {
        if(await Dialog.confirm("Delete this file permanently?")) {
            await MediaDB.deleteMedia(id);
            this.refresh();
        }
    }
};

window.MediaManager = MediaManager;