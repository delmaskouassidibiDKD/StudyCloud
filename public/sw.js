// Service Worker StudyCloud - Gestion des Notifications Push
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Écoute de l'événement push en arrière-plan (même quand l'application ou l'écran est fermé)
self.addEventListener('push', (event) => {
  let data = {
    title: 'StudyCloud',
    body: 'Vous avez reçu une nouvelle notification.',
    icon: '/dna-logo.png',
    badge: '/dna-logo.png',
    tag: 'studycloud-notification',
    data: { url: '/?view=notifications' },
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/dna-logo.png',
    badge: data.badge || '/dna-logo.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'studycloud-notification',
    renotify: true,
    data: data.data || { url: '/?view=notifications' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur la notification : réveille l'appareil et ouvre l'application dans la boîte de réception
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/?view=notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si une fenêtre StudyCloud est déjà ouverte, l'activer et lui envoyer l'ordre d'ouvrir les notifications
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_NOTIFICATIONS' });
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre vers la boîte de réception
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
