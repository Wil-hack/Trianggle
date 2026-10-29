const CACHE_NAME = 'trihive-cache-v2';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

// Install dan simpan cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Ambil data dari cache saat offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Jika offline dan file tidak ada di cache, biarkan
      });
    })
  );
});
