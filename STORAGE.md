# WOW3 Storage System Architecture

## Table of Contents
1. [Overview](#overview)
2. [Storage Architecture](#storage-architecture)
3. [IndexedDB Databases](#indexeddb-databases)
4. [localStorage Snapshots](#localstorage-snapshots)
5. [Media Management](#media-management)
6. [Import/Export System](#importexport-system)
7. [Loading Priority](#loading-priority)
8. [Code Examples](#code-examples)

---

## Overview

WOW3 uses a **dual storage system** combining IndexedDB and localStorage to provide robust data persistence and crash recovery:

- **IndexedDB** (Permanent Storage): User's permanent presentations and media files
- **localStorage** (Snapshot Storage): Auto-saved snapshots for crash recovery

This architecture ensures:
- ✅ No 5-10MB localStorage limits for large presentations
- ✅ Binary media storage (images, videos, audio) without data URL bloat
- ✅ Crash recovery with auto-save snapshots
- ✅ Portable JSON export with embedded media
- ✅ Fast auto-save without blocking UI

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Actions                         │
└────────────┬────────────────────────────────────────────┘
             │
             v
┌────────────┴────────────────────────────────────────────┐
│              EditorController                           │
│  • Manages presentation state                           │
│  • Coordinates saving/loading                           │
│  • Handles undo/redo history                            │
└────────────┬────────────────────────────────────────────┘
             │
       ┌─────┴──────┐
       │            │
       v            v
┌──────────┐  ┌──────────────┐
│  Save    │  │  Auto-Save   │
│ (Ctrl+S) │  │  (30s timer) │
└─────┬────┘  └──────┬───────┘
      │              │
      v              v
┌─────────────┐  ┌──────────────┐
│  IndexedDB  │  │ localStorage │
│  Permanent  │  │  Snapshots   │
│             │  │              │
│  • wow3_    │  │  • wow3_     │
│    presenta │  │    snapshot_ │
│    tions    │  │    {id}      │
│             │  │  • Keeps last│
│  • wow3_    │  │    3 only    │
│    media    │  │              │
└─────────────┘  └──────────────┘
```

---

## IndexedDB Databases

### 1. Presentations Database (`wow3_presentations`)

**Purpose**: Store user's permanent presentation files

**Database Schema**:
```javascript
Database: wow3_presentations
Version: 1

Object Store: presentations
  • Key Path: id
  • Indexes:
    - title (non-unique)
    - modified (non-unique) ← Used for sorting by date
    - created (non-unique)
```

**Stored Data Structure**:
```javascript
{
  id: "presentation_1234567890_abc123",
  title: "My Presentation",
  slides: [
    {
      id: "slide_1234567890_def456",
      title: "Slide 1",
      background: "#ffffff",
      elements: [...]
    }
  ],
  metadata: {
    created: "2026-02-12T10:00:00.000Z",
    modified: "2026-02-12T12:30:00.000Z",
    author: "User Name"
  }
}
```

**Key Operations**:
- `PresentationsDB.savePresentation(presentation)` - Save/update presentation
- `PresentationsDB.loadPresentation(id)` - Load specific presentation
- `PresentationsDB.getAllPresentations()` - List all presentations (sorted by modified date)
- `PresentationsDB.deletePresentation(id)` - Delete presentation

### 2. Media Database (`wow3_media`)

**Purpose**: Store binary media files (images, videos, audio)

**Database Schema**:
```javascript
Database: wow3_media
Version: 1

Object Store: media_items
  • Key Path: id
  • Indexes:
    - type (non-unique) ← Filter by media type
    - createdAt (non-unique) ← Sort by upload date
    - name (non-unique) ← Search by filename
```

**Stored Data Structure**:
```javascript
{
  id: "media_1234567890_xyz789",
  name: "photo.jpg",
  type: "image/jpeg",
  size: 245760, // bytes
  blob: Blob {...}, // Actual binary data
  createdAt: 1644665400000,
  metadata: {
    // Optional custom metadata
  }
}
```

**Key Operations**:
- `MediaDB.addMedia(file, metadata)` - Upload file to IndexedDB
- `MediaDB.getMedia(id)` - Retrieve media item
- `MediaDB.getMediaDataURL(id)` - Get media as data URL for display
- `MediaDB.deleteMedia(id)` - Delete media file
- `MediaDB.exportMedia(id)` - Export as data URL for JSON export
- `MediaDB.importMedia(exportData)` - Import from data URL

---

## localStorage Snapshots

### Purpose

Provide **crash recovery** without user action. Even if the browser crashes or page refreshes unexpectedly, work is preserved.

### Storage Keys

```javascript
// Current working presentation snapshot
wow3_current_presentation

// Historical snapshots (keep last 3)
wow3_snapshot_1644665400000
wow3_snapshot_1644665430000
wow3_snapshot_1644665460000
```

### Snapshot Lifecycle

1. **Auto-Save Trigger**: Every 30 seconds (if unsaved changes exist)
2. **Snapshot Created**: Full presentation state serialized to JSON
3. **Cleanup**: Only keep last 3 snapshots to avoid localStorage bloat
4. **Recovery**: On app load, snapshot takes priority over IndexedDB

### Size Considerations

- **Snapshots exclude binary media** (only store media IDs)
- **Typical snapshot size**: 10-100 KB for 10-slide presentation
- **localStorage limit**: ~5-10 MB (plenty of space for snapshots)
- **Heavy media files**: Stored in IndexedDB, not localStorage

---

## Media Management

### Media Element Workflow

#### 1. Uploading Media

```javascript
// User clicks "Upload File" button in properties panel
const file = input.files[0]; // File from <input type="file">

// Upload to MediaDB
const item = await MediaDB.addMedia(file);
// Returns: { id: "media_1234567890_abc", name: "photo.jpg", ... }

// Store media ID in element
element.properties.url = "media_1234567890_abc";
```

#### 2. Rendering Media

```javascript
// In ImageElement.render()
if (element.properties.url.startsWith('media_')) {
  // Load from IndexedDB
  const dataURL = await MediaDB.getMediaDataURL(element.properties.url);
  img.src = dataURL;
} else {
  // External URL
  img.src = element.properties.url;
}
```

#### 3. Exporting Media (for JSON portability)

```javascript
// When exporting presentation to JSON
const mediaData = await MediaDB.exportMedia('media_1234567890_abc');
// Returns: {
//   id: "media_1234567890_abc",
//   name: "photo.jpg",
//   type: "image/jpeg",
//   dataURL: "data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Full data URL
// }

element.properties.mediaExport = mediaData; // Include in JSON export
```

#### 4. Importing Media (from JSON)

```javascript
// When importing presentation from JSON
if (element.properties.mediaExport) {
  // Import data URL back to IndexedDB
  const mediaId = await MediaDB.importMedia(element.properties.mediaExport);
  element.properties.url = mediaId; // Store new media ID
  delete element.properties.mediaExport; // Clean up
}
```

### Media ID vs URL Pattern

**Media ID Format**: `media_{timestamp}_{random}`
- Example: `media_1644665400000_abc123def`
- Stored in IndexedDB
- Compact storage in JSON snapshots

**External URL**: Any HTTP(S) URL
- Example: `https://example.com/image.jpg`
- Not stored in IndexedDB
- Referenced directly

**Detection**:
```javascript
if (url.startsWith('media_')) {
  // Load from IndexedDB
} else {
  // External URL
}
```

---

## Import/Export System

### Export Presentation

**User Action**: Click "Export JSON" button

**Process**:
1. Serialize presentation to JSON
2. For each media element:
   - Export media from IndexedDB as data URL
   - Embed data URL in JSON
3. Download as `.wow3.json` file

**Result**: Fully portable JSON file with embedded media

```javascript
{
  "id": "presentation_123",
  "title": "My Presentation",
  "slides": [
    {
      "elements": [
        {
          "type": "image",
          "properties": {
            "url": "media_123_abc",
            "mediaExport": {
              "id": "media_123_abc",
              "name": "photo.jpg",
              "type": "image/jpeg",
              "dataURL": "data:image/jpeg;base64,..." // Full image data
            }
          }
        }
      ]
    }
  ]
}
```

### Import Presentation

**User Action**: Click "Import JSON" button

**Process**:
1. Parse JSON file
2. For each element with `mediaExport`:
   - Extract data URL
   - Import to IndexedDB via `MediaDB.importMedia()`
   - Replace `mediaExport` with media ID
3. Load presentation into editor

**Result**: All media restored to IndexedDB, presentation ready to edit

---

## Loading Priority

### App Initialization Sequence

When WOW3 starts, it attempts to load presentations in this priority order:

```
1. localStorage Snapshot (Crash Recovery)
   ↓ If not found...
2. IndexedDB Last Saved (Most recent presentation)
   ↓ If not found...
3. New Presentation (Empty)
```

### Code Flow

```javascript
async loadPresentation() {
  // 1. Try snapshot first (most recent work)
  const snapshot = loadSnapshot();
  if (snapshot) {
    await this.editor.loadPresentation(snapshot);
    console.log('📸 Loaded from snapshot');
    return;
  }

  // 2. Try IndexedDB (last saved presentation)
  const presentations = await getAllPresentations();
  if (presentations?.length > 0) {
    const data = await loadPresentation(presentations[0].id);
    if (data) {
      await this.editor.loadPresentation(data);
      console.log('💾 Loaded from IndexedDB');
      return;
    }
  }

  // 3. Create new presentation
  await this.editor.createNewPresentation();
  console.log('✨ Created new presentation');
}
```

### Why Snapshot Takes Priority?

- **Most recent work**: Snapshot may contain edits made after last save
- **Crash recovery**: If browser crashed, snapshot preserves unsaved changes
- **User intent**: Auto-save captures user's latest intent

---

## Code Examples

### Save Presentation (Permanent)

```javascript
// User clicks "Save" button or presses Ctrl+S
async savePresentation() {
  // Save to IndexedDB (permanent storage)
  await PresentationsDB.savePresentation(this.presentation);

  // Also update snapshot (for crash recovery)
  saveSnapshot(this.presentation);

  this.unsavedChanges = false;
  M.toast({ html: '💾 Saved to IndexedDB', classes: 'green' });
}
```

### Auto-Save (Snapshot)

```javascript
// Runs every 30 seconds automatically
autoSave() {
  if (this.unsavedChanges && this.presentation) {
    // Save to localStorage snapshot (crash recovery)
    saveSnapshot(this.presentation);
    console.log('📸 Snapshot saved to localStorage');

    // Note: Does NOT save to IndexedDB
    // User must explicitly click "Save" for permanent storage
  }
}
```

### Upload Image

```javascript
// User uploads image file via properties panel
async handleImageUpload(element, file) {
  // 1. Upload to IndexedDB
  const mediaItem = await MediaDB.addMedia(file);

  // 2. Store media ID in element
  element.properties.url = mediaItem.id;

  // 3. Re-render slide
  await this.editor.slideController.renderCurrentSlide();

  // 4. Mark as changed
  this.editor.recordHistory();
}
```

### Export with Media

```javascript
async exportPresentation() {
  // Clone presentation
  const data = this.presentation.toJSON();

  // Export all media elements
  for (const slide of data.slides) {
    for (const element of slide.elements) {
      if (element.type === 'image' && element.properties.url.startsWith('media_')) {
        // Export media as data URL
        element.properties.mediaExport = await MediaDB.exportMedia(
          element.properties.url
        );
      }
    }
  }

  // Download JSON
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${this.presentation.title}.wow3.json`);
}
```

### Import with Media

```javascript
async importPresentation(jsonData) {
  // Import all media to IndexedDB
  for (const slide of jsonData.slides) {
    for (const element of slide.elements) {
      if (element.properties?.mediaExport) {
        // Import data URL to IndexedDB
        const mediaId = await MediaDB.importMedia(element.properties.mediaExport);

        // Replace media export with media ID
        element.properties.url = mediaId;
        delete element.properties.mediaExport;
      }
    }
  }

  // Load presentation
  await this.editor.loadPresentation(jsonData);
}
```

---

## Storage API Reference

### PresentationsDB

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `init()` | - | `Promise<IDBDatabase>` | Initialize database connection |
| `savePresentation(presentation)` | `Presentation` | `Promise<void>` | Save/update presentation |
| `loadPresentation(id)` | `string` | `Promise<Object\|null>` | Load specific presentation |
| `getAllPresentations()` | - | `Promise<Array>` | List all presentations (sorted by modified) |
| `deletePresentation(id)` | `string` | `Promise<void>` | Delete presentation |

### MediaDB

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `init()` | - | `Promise<IDBDatabase>` | Initialize database connection |
| `addMedia(file, metadata)` | `File, Object` | `Promise<Object>` | Upload media file |
| `getMedia(id)` | `string` | `Promise<Object\|null>` | Get media item |
| `getMediaDataURL(id)` | `string` | `Promise<string\|null>` | Get media as data URL |
| `deleteMedia(id)` | `string` | `Promise<void>` | Delete media file |
| `exportMedia(id)` | `string` | `Promise<Object\|null>` | Export as data URL |
| `importMedia(exportData)` | `Object` | `Promise<string>` | Import from data URL |
| `getAllMedia()` | - | `Promise<Array>` | List all media items |
| `clearAllMedia()` | - | `Promise<void>` | Delete all media (⚠️ destructive) |

### storage.js (Utilities)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `savePresentation(presentation)` | `Presentation` | `Promise<boolean>` | Save to IndexedDB + snapshot |
| `loadPresentation(id)` | `string` | `Promise<Object\|null>` | Load from IndexedDB |
| `saveSnapshot(presentation)` | `Presentation` | `void` | Save to localStorage snapshot |
| `loadSnapshot()` | - | `Object\|null` | Load latest snapshot |
| `getAllPresentations()` | - | `Promise<Array>` | List all presentations |
| `deletePresentation(id)` | `string` | `Promise<boolean>` | Delete presentation |
| `exportPresentation(presentation)` | `Presentation` | `void` | Download JSON file |
| `importPresentation()` | - | `Promise<Object>` | Upload and parse JSON file |

---

## Performance Considerations

### IndexedDB Benefits
- ✅ **No size limits** (unlike localStorage's 5-10 MB)
- ✅ **Binary storage** (images stored as Blob, not base64)
- ✅ **Indexed queries** (fast sorting by date, filtering by type)
- ✅ **Asynchronous** (non-blocking UI)

### localStorage Benefits
- ✅ **Synchronous access** (instant reads, good for snapshots)
- ✅ **Simple API** (no database setup needed)
- ✅ **Reliable** (universally supported)

### Combined Approach
- **Best of both worlds**: Permanent storage + crash recovery
- **Optimized workflow**: Heavy data in IndexedDB, lightweight snapshots in localStorage
- **User experience**: Fast auto-save without disruption

---

## Browser Compatibility

### IndexedDB
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+

### localStorage
- ✅ Chrome 4+
- ✅ Firefox 3.5+
- ✅ Safari 4+
- ✅ Edge 12+

**Result**: WOW3 works on all modern browsers (last 10 years)

---

## Troubleshooting

### "Failed to save presentation"

**Cause**: IndexedDB quota exceeded or permission denied

**Solution**:
1. Check browser storage settings
2. Delete old presentations via browser DevTools
3. Clear browser cache and reload

### "Media not found in IndexedDB"

**Cause**: Media ID exists in presentation but file deleted from IndexedDB

**Solution**:
1. Re-upload media file
2. Or enter external URL in properties panel

### "Snapshot not loading"

**Cause**: localStorage cleared or corrupted

**Solution**:
1. Load last saved presentation from IndexedDB
2. Enable browser storage persistence in settings

---

## Security Considerations

### Data Privacy
- ✅ All data stored **locally in browser**
- ✅ No cloud sync or external servers
- ✅ User has full control

### Storage Quota
- ⚠️ IndexedDB quota varies by browser (typically 50% of available disk space)
- ⚠️ localStorage limited to ~5-10 MB
- ✅ WOW3 handles quota errors gracefully

### Data Persistence
- ⚠️ Incognito/Private browsing: Data cleared on session end
- ⚠️ User can clear browser data manually
- ✅ Export presentations as JSON for backup

---

## Future Enhancements

Potential improvements to the storage system:

1. **Cloud Sync**: Optionally sync presentations to cloud storage (Google Drive, Dropbox)
2. **Compression**: Compress large media files before storing in IndexedDB
3. **Lazy Loading**: Load media only when needed (not all at app start)
4. **Version History**: Keep multiple versions of presentations (like Git)
5. **Collaboration**: Real-time multi-user editing with conflict resolution

---

## Summary

WOW3's dual storage architecture provides:

- **IndexedDB**: Unlimited permanent storage for presentations and binary media
- **localStorage**: Lightweight snapshots for crash recovery
- **Smart Loading**: Prioritizes most recent work (snapshot → saved → new)
- **Portable Export**: JSON files with embedded media for sharing
- **Robust Recovery**: Auto-save every 30 seconds, keeps last 3 snapshots
- **Performance**: Binary storage avoids base64 bloat, async operations don't block UI

This architecture ensures users never lose work while maintaining excellent performance even with large media files.

---

**Last Updated**: 2026-02-12
**Version**: 1.0
**Author**: WOW3 Development Team
