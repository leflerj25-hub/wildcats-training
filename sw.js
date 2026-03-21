// Wildcats Training — Service Worker v1
// Strategy: Cache-first for app shell, network-first for Supabase API calls
const CACHE_NAME = 'wildcats-v1';
const APP_SHELL = [
  '/wildcats-training/',
  '/wildcats-training/index.html',
];

// ── INSTALL: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: smart caching strategy ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase API calls — always go to network for live data
  if (url.hostname.includes('supabase.co') || url.hostname.includes('onesignal.com')) {
    return; // let it fall through to network normally
  }

  // For the app shell (HTML + assets from github.io) — network first, cache fallback
  if (url.hostname.includes('github.io') || url.hostname.includes('localhost')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a fresh copy if we got one
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('/wildcats-training/index.html'));
        })
    );
    return;
  }

  // For CDN resources (YouTube, external scripts) — cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
  );
});
