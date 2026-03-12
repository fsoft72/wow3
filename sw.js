/**
 * WOW3 Service Worker (Workbox / vite-plugin-pwa)
 * Precaches all build assets via the injected manifest and
 * uses a cache-first strategy for runtime requests.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/** Cache images at runtime with cache-first (bounded) */
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

/** Cache fonts at runtime with stale-while-revalidate */
registerRoute(
  ({ request }) => request.destination === 'font',
  new StaleWhileRevalidate({ cacheName: 'fonts' })
);

/** Listen for skip-waiting message from the client */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
