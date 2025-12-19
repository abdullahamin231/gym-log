const CACHE_NAME = 'gym-log-shell-v4';
// App shell caching only (user data lives in localStorage/IndexedDB).
// Keep paths relative so it works from subpaths (e.g. GitHub Pages).
const APP_SHELL = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/dumbbell.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.map(key => (key === CACHE_NAME ? null : caches.delete(key)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isShellAsset =
    isNavigation ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.includes('/icons/');

  const cacheAndReturn = async response => {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
  };

  // Network-first for navigations and core shell assets so updates land without bumping CACHE_NAME.
  // Falls back to cache for offline support.
  if (isShellAsset) {
    event.respondWith(
      fetch(request)
        .then(cacheAndReturn)
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Navigation fallback: serve cached index.html if available.
          if (isNavigation) return caches.match('index.html');
          throw new Error('Network error and no cached response');
        })
    );
    return;
  }

  // Stale-while-revalidate for everything else: fast responses + background updates.
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(cacheAndReturn)
        .catch(() => null);
      return cached || fetchPromise;
    })
  );
});
