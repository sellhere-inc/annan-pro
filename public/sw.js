/* No caching of account data, API responses, or authenticated pages. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Annan Pro', {
    body: data.body || 'You have an update. Open Annan Pro to view it.',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: data.id || undefined, data: { url: '/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) { client.postMessage({ type: 'refresh' }); return client.focus(); }
    }
    return self.clients.openWindow('/');
  }));
});
