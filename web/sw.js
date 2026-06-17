// Minimaler Service Worker: macht "Zum Home-Bildschirm" moeglich und
// cached die App-Huelle. Live-Daten (API) gehen immer frisch uebers Netz.
const CACHE = 'pr-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API, WebSocket und Kartenkacheln nie cachen
  const isApi = ['/auth', '/locations', '/places', '/groups', '/owntracks', '/health', '/ws'].some((p) => url.pathname.startsWith(p));
  if (isApi || url.origin !== location.origin) return; // direkt ans Netz
  // Huelle: erst Netz, sonst Cache (damit Updates ankommen)
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
