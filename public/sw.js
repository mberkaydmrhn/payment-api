self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activated');
});

self.addEventListener('fetch', (e) => {
  // Şimdilik sadece network'ten çekiyoruz (Cache yok)
  e.respondWith(fetch(e.request));
});