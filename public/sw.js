self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '🍽️ Order Ready!', {
      body:             data.body || 'Please come to the counter to collect your order.',
      icon:             '/public/logo.png',
      badge:            '/public/logo.png',
      vibrate:          [600, 150, 600, 150, 600],
      requireInteraction: true,
      tag:              'pager-ready',
      renotify:         true,
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(function(list) {
    for (var c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});
