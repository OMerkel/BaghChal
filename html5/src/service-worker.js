// Service Worker for Bagh Chal PWA
// Copyright (c) 2026 Oliver Merkel. MIT License.

// Cache name with version suffix (must match CACHE_VERSION in config.js)
// Increment the version number to invalidate the cache
const CACHE_NAME = 'bagh chal-pwa-v3';

// Non-critical assets cached with stale-while-revalidate strategy
const NON_CRITICAL_ASSET_PATTERNS = [
  /\.css$/, // CSS stylesheets
  /\.png$/, // Image files
  /manifest\.json$/, // Manifest (rarely changes)
];

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/index.css',
  '/js/common.js',
  '/js/board.js',
  '/js/controller.js',
  '/js/hmi.js',
  '/js/renderer.js',
  '/js/store.js',
  '/js/uct/uct.js',
  '/js/uct/uctnode.js',
  '/img/icons/baghchal16.png',
  '/img/icons/baghchal32.png',
  '/img/icons/baghchal48.png',
  '/img/icons/baghchal60.png',
  '/img/icons/baghchal64.png',
  '/img/icons/baghchal90.png',
  '/img/icons/baghchal120.png',
  '/img/icons/baghchal128.png',
  '/img/icons/baghchal256.png',
  '/manifest.json',
];

/**
 * Determine if a request URL represents a non-critical asset.
 * Non-critical assets use stale-while-revalidate strategy for better offline UX.
 * @param {string} url - The request URL
 * @returns {boolean} True if the asset is non-critical
 */
const isNonCriticalAsset = url => {
  try {
    const urlPath = new URL(url).pathname;
    return NON_CRITICAL_ASSET_PATTERNS.some(pattern => pattern.test(urlPath));
  } catch {
    return false;
  }
};

/**
 * Serve from cache, then fetch fresh version in the background (stale-while-revalidate).
 * Updates the cache with the fresh response for next visit.
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} Cached response if available, otherwise network response
 */
const staleWhileRevalidate = request => {
  return caches.match(request).then(cachedResponse => {
    const fetchPromise = fetch(request).then(response => {
      // Only cache successful responses
      if (!response || response.status !== 200 || response.type === 'error') {
        return response;
      }
      // Clone and cache the fresh response
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseToCache);
      });
      return response;
    });

    // Return cached response immediately, or wait for network if not cached
    return cachedResponse || fetchPromise;
  });
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET') return;

  const { request } = event;

  // Use appropriate caching strategy based on asset type
  if (isNonCriticalAsset(request.url)) {
    // Stale-while-revalidate: serve cached version immediately, update in background
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Cache-first: critical assets (HTML, JS)
    event.respondWith(caches.match(request).then(response => response || fetch(request)));
  }
});

// Background Sync API support for future features
// Allows the main thread to register sync tasks that will be attempted
// when the device is back online
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    const { tag } = event.data;

    // Check if Background Sync is supported
    if (self.registration?.sync) {
      self.registration.sync
        .register(tag)
        .then(() => {
          console.log(`Background sync registered for tag: ${tag}`);
        })
        .catch(err => {
          console.warn(`Failed to register background sync for tag ${tag}:`, err);
        });
    } else {
      console.warn('Background Sync API not supported in this browser');
    }
  }
});

// Background Sync event handler for when device comes back online
self.addEventListener('sync', event => {
  if (event.tag === 'game-state-sync') {
    // Future feature: sync game state when coming back online
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('Background sync: game-state-sync');
        // Implementation will go here
      })
    );
  }
});
