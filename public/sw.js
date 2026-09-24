// ============================================================================
// SERVICE WORKER STUDYCLOUD (PWA HORS-LIGNE & NOTIFICATIONS PUSH)
// Conçu par DKD Technologies pour StudyCloud
// ============================================================================

const CACHE_NAME = 'studycloud-pwa-v35';

// Ressources fondamentales du "Shell" de l'application pré-mises en cache à l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png'
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. INSTALLATION DU SERVICE WORKER (Mise en cache du cœur de l'application)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pré-mise en cache résiliente (n'échoue pas si un asset optionnel manque)
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[PWA Precache Warning] Impossible de pré-cacher:', url, err);
          })
        )
      );
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ACTIVATION (Nettoyage des anciens caches et prise de contrôle immédiate)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[PWA Cache] Suppression de l\'ancien cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STRATÉGIE DE REQUÊTES (FONCTIONNEMENT HORS-LIGNE GARANTI)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET (POST, PUT, DELETE, OPTIONS ne peuvent pas être cachées)
  if (request.method !== 'GET') {
    return;
  }

  // Ne pas cacher les extensions de navigateur (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // A. REQUÊTES DE NAVIGATION (Chargement d'une page HTML ou rafraîchissement)
  // Stratégie : Network First avec Fallback Cache (ouvre instantanément l'app hors-ligne)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Si hors-ligne, servir immédiatement le fichier index.html mis en cache
          const cachedApp = await caches.match('/index.html');
          if (cachedApp) return cachedApp;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          return new Response(
            `<!doctype html>
            <html lang="fr">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>StudyCloud - Mode Hors-Ligne</title>
                <style>
                  body { margin:0; padding:0; background:#0f1117; color:#fff; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; }
                  .card { max-width:380px; padding:24px; background:#1a1d24; border-radius:20px; border:1px solid #2d3342; }
                  h1 { font-size:20px; margin-bottom:8px; color:#60a5fa; }
                  p { font-size:13px; color:#9ca3af; line-height:1.5; margin-bottom:16px; }
                  button { background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>StudyCloud - Hors Ligne</h1>
                  <p>Vous êtes actuellement hors connexion internet. Vos documents et votre espace s'afficheront dès le retour du réseau.</p>
                  <button onclick="window.location.reload()">Réessayer la connexion</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // B. REQUÊTES D'API OU VERS DES WORKERS (Network First avec timeout)
  if (url.pathname.startsWith('/api') || url.hostname.includes('workers.dev') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: "Vous êtes actuellement hors connexion internet.",
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // C. ASSETS STATIQUES (Scripts JS, styles CSS, Polices KaTeX, Images du site)
  // Stratégie : Stale-While-Revalidate (Réponse instantanée depuis le cache + mise à jour en arrière-plan)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Erreur réseau : le cache prend le relais
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GESTION DES NOTIFICATIONS PUSH EN ARRIÈRE-PLAN
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'StudyCloud',
    body: 'Vous avez reçu une nouvelle notification.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
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
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'studycloud-notification',
    renotify: true,
    data: data.data || { url: '/?view=notifications' },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clic sur la notification : active la fenêtre ou ouvre StudyCloud
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/?view=notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_NOTIFICATIONS' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
