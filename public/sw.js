// 2piClock Progressive Web App Service Worker
const CACHE_NAME = '2piclock-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For external live APIs (like OpenMeteo or live radio streams), bypass service worker cache
  if (url.origin.includes('open-meteo.com') || url.origin.includes('stream') || url.pathname.includes('/api/')) {
    return;
  }

  // Network-first with cache fallback for navigation and app assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful local response
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // If navigating to a page while offline, return the cached root app shell
        if (event.request.mode === 'navigate') {
          const rootCache = await caches.match('/');
          if (rootCache) return rootCache;
        }
        return new Response('Offline: 2piClock is running in local ephemeris mode.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});
