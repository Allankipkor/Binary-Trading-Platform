// Service worker supporting installation and cache invalidation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Force active service worker to invalidate caches immediately on update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Passthrough fetch handler required by Android WebAPK compilation
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Handle notification click event to open/focus the messages page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate('/messages');
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/messages');
      }
    })
  );
});
