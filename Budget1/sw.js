// Service worker for the Budget app.
// IMPORTANT: bump CACHE_NAME (app-cache-v2, v3, ...) every time you change any
// local file. Otherwise the phone keeps serving the old copy from the cache.
const CACHE_NAME = 'app-cache-v1';

// Every local file the app needs to run offline.
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './core/core.js',
  './core/i18n.js',
  './core/labels.js',
  './core/time.js',
  './pages/dashboard.js',
  './pages/history.js',
  './pages/accounts.js',
  './pages/plan.js',
  './pages/loans.js',
  './pages/savings.js',
  './pages/trash.js',
  './pages/export.js',
  './pages/settings.js',
  './components/date-picker.js',
  './components/panel.js',
  './components/success.js',
  './components/transaction-sheet.js',
  './components/fab-menu.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: store all local files. A missing file is skipped with a warning,
// so one wrong path does not stop the whole app from being cached.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(LOCAL_ASSETS.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('Not cached:', url, err);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate: delete every cache whose name is not the current version.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== CACHE_NAME) return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

// Local files: serve from the cache, and only go to the network if not cached.
async function cacheFirst(req) {
  var cache = await caches.open(CACHE_NAME);
  var hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    var res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Offline and not cached: open the app shell for page requests.
    if (req.mode === 'navigate') {
      var shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

// External CDN files (fonts, icon libraries): try the network first,
// keep a copy, and fall back to that copy when offline.
async function networkFirst(req) {
  var cache = await caches.open(CACHE_NAME);
  try {
    var res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch (err) {
    var hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
      }
