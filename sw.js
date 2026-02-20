/**
 * WOW3 Service Worker
 * Provides full offline support via cache-first strategy.
 * Bump CACHE_VERSION when deploying updates to force re-caching.
 */

const CACHE_VERSION = 'wow3-v0.9.2';

/** Local app files to pre-cache */
const LOCAL_FILES = [
  './',
  'index.html',
  'manifest.json',
  // CSS
  'css/animation-editor.css',
  'css/main.css',
  'css/editor.css',
  'css/sidebar.css',
  'css/components.css',
  'css/media-manager.css',
  'css/presentation-manager.css',
  'css/template-manager.css',
  'css/dialog.css',
  'css/panels.css',
  'css/gradient-manager.css',
  'css/countdown-timer.css',
  'css/settings.css',
  // JS - Utils
  'js/utils/presentations_db.js',
  'js/utils/media_db.js',
  'js/utils/dialog.js',
  'js/utils/i18n.js',
  'js/utils/panel_utils.js',
  'js/utils/media_manager.js',
  'js/utils/presentation_manager.js',
  'js/utils/templates_db.js',
  'js/utils/template_manager.js',
  'js/utils/gradient_manager.js',
  'js/utils/positioning.js',
  'js/utils/settings.js',
  'js/utils/storage.js',
  'js/utils/events.js',
  'js/utils/dom.js',
  'js/utils/toasts.js',
  'js/utils/constants.js',
  // JS - Components
  'js/components/context_menu.js',
  'js/components/range_input.js',
  'js/components/image_selector.js',
  'js/components/gradient_selector.js',
  // JS - Models
  'js/models/index.js',
  'js/models/Element.js',
  'js/models/TextElement.js',
  'js/models/ImageElement.js',
  'js/models/VideoElement.js',
  'js/models/AudioElement.js',
  'js/models/ShapeElement.js',
  'js/models/ListElement.js',
  'js/models/LinkElement.js',
  'js/models/EmptyElement.js',
  'js/models/CountdownTimerElement.js',
  'js/models/Presentation.js',
  'js/models/Slide.js',
  // JS - Controllers
  'js/controllers/index.js',
  'js/controllers/EditorController.js',
  'js/controllers/SlideController.js',
  'js/controllers/ElementController.js',
  'js/controllers/AnimationEditorController.js',
  'js/controllers/PlaybackController.js',
  'js/controllers/SettingsController.js',
  // JS - Views
  'js/views/index.js',
  'js/views/UIManager.js',
  'js/views/RightSidebar.js',
  'js/views/StatusBar.js',
  // JS - Animations
  'js/animations/AnimationManager.js',
  'js/animations/definitions.js',
  'js/animations/migration.js',
  // JS - Interactions
  'js/interactions/index.js',
  'js/interactions/DragHandler.js',
  'js/interactions/ResizeHandler.js',
  'js/interactions/RotateHandler.js',
  'js/interactions/MarqueeHandler.js',
  'js/interactions/CropHandler.js',
  'js/interactions/AlignmentGuides.js',
  'js/interactions/CanvasDropHandler.js',
  // JS - Managers
  'js/managers/AudioManager.js',
  // JS - Panels
  'js/panels/index.js',
  'js/panels/TextPanel.js',
  'js/panels/ImagePanel.js',
  'js/panels/VideoPanel.js',
  'js/panels/AudioPanel.js',
  'js/panels/CountdownTimerPanel.js',
  // JS - Entry
  'js/app.js',
];

/** External CDN resources to pre-cache */
const CDN_FILES = [
  // MaterializeCSS
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  // JSZip
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  // html2canvas
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  // Material Icons
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Montserrat:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap',
];

/**
 * Install event: pre-cache all app resources.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Cache local files first (these should always succeed)
      await cache.addAll(LOCAL_FILES);

      // Cache CDN files individually (don't fail install if one CDN is down)
      for (const url of CDN_FILES) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`[SW] Failed to cache CDN resource: ${url}`, err);
        }
      }
    })
  );

  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

/**
 * Activate event: clean up old cache versions and notify clients of updates.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldKeys = keys.filter((key) => key !== CACHE_VERSION);
      const hadOldCache = oldKeys.length > 0;

      await Promise.all(oldKeys.map((key) => caches.delete(key)));

      // Take control of all clients immediately
      await self.clients.claim();

      // Notify clients that an update was applied
      if (hadOldCache) {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        }
      }
    })
  );
});

/**
 * Fetch event: cache-first strategy.
 * Serves from cache when available, falls back to network.
 * Caches successful network responses for future offline use
 * (handles font files and other resources loaded dynamically by CSS).
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Don't cache non-ok responses or opaque responses from no-cors
        if (!response || response.status !== 200) return response;

        // Clone the response to store in cache
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      }).catch(() => {
        // Network failed and not in cache -- return offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
