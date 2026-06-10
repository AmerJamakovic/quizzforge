// service-worker.js, optional offline support (build order step 7).
// Cache-first for the app's own static files; network-first (with cache
// fallback) for the Dexie CDN module. Bump CACHE_VERSION to invalidate.

const CACHE_VERSION = 'quizforge-v9';

// Relative URLs so the worker works under a GitHub Pages project sub-path.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/db.js',
  './js/schema.js',
  './js/score.js',
  './js/io.js',
  './js/util.js',
  './js/state.js',
  './js/sample.js',
  './js/classmarker.js',
  './js/modal.js',
  './js/views/library.js',
  './js/views/take.js',
  './js/views/results.js',
  './js/views/editor.js',
  './js/views/import.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isCdn = req.url.includes('jsdelivr.net');

  if (isCdn) {
    // Network-first for the CDN module; fall back to cache when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for same-origin app files.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
