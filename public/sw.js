// ============================================================================
// SERVICE WORKER STUDYCLOUD (PWA 100 % HORS-LIGNE & NOTIFICATIONS PUSH)
// Conçu par DKD Technologies pour StudyCloud
// ============================================================================

const CACHE_NAME = 'studycloud-pwa-v63';

// Liste injectée automatiquement à chaque build Vite (contient index-*.js, vendor-react-*.js, index-*.css...)
const BUILD_APP_ASSETS = [];

// Ressources fondamentales du "Shell" de l'application pré-mises en cache dès l'installation
const CORE_SHELL_ASSETS = [
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

const PRECACHE_ASSETS = Array.from(new Set([...CORE_SHELL_ASSETS, ...BUILD_APP_ASSETS]));

// Helper : fetch réseau avec timeout strict pour ne jamais bloquer l'ouverture hors-ligne sur mobile
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), timeoutMs);
    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INSTALLATION DU SERVICE WORKER (Pré-cache complet du shell + bundles JS/CSS)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Activation immédiate si premier contrôleur ou mise à jour fluide
  if (!self.registration.active) {
    self.skipWaiting();
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pré-cacher chaque ressource en parallèle sans jamais bloquer l'installation sur un fichier optionnel
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (assetUrl) => {
          try {
            const req = new Request(assetUrl, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) {
              await cache.put(assetUrl, res.clone());
              if (assetUrl === '/index.html') {
                await cache.put('/', res.clone());
              }
            }
          } catch (err) {
            console.warn('[PWA Precache Warning] Impossible de pré-cacher:', assetUrl, err);
          }
        })
      );
    })
  );
});

// Écouter le signal envoyé par l'utilisateur lorsqu'il clique sur "Mettre à jour"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ACTIVATION (Nettoyage des anciens caches et prise de contrôle immédiate)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
            return Promise.resolve();
          })
        )
      )
    ])
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STRATÉGIE DE REQUÊTES (OUVERTURE HORS-LIGNE INSTANTANÉE & PROTECTION RAM)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer extensions navigateur (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ne JAMAIS intercepter les flux Range (streaming vidéo/audio HTML5)
  if (request.headers && request.headers.has('range')) {
    return;
  }

  // Ne JAMAIS mettre en cache les fichiers médias volumineux ou archives
  const pathnameLower = url.pathname.toLowerCase();
  const mediaExtensions = ['.mp4', '.webm', '.ogv', '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.zip', '.tar', '.gz', '.7z'];
  if (mediaExtensions.some((ext) => pathnameLower.endsWith(ext))) {
    return;
  }

  // Ne pas cacher /version.json (toujours frais)
  if (url.origin === self.location.origin && pathnameLower === '/version.json') {
    return;
  }

  // A. REQUÊTES DE NAVIGATION (Ouverture de l'application / rafraîchissement / démarrage PWA)
  // Stratégie : Réseau rapide (timeout 2.5s) avec bascule immédiate sur le cache local /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetchWithTimeout(request, 2500);
          if (networkResponse && networkResponse.status === 200) {
            const copyForIndex = networkResponse.clone();
            const copyForRoot = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', copyForIndex).catch(() => {});
              cache.put('/', copyForRoot).catch(() => {});
            });
            return networkResponse;
          }
          // Si le serveur renvoie une erreur (5xx), essayer le cache avant d'échouer
          const fallbackCached =
            (await caches.match('/index.html', { ignoreSearch: true })) ||
            (await caches.match('/', { ignoreSearch: true }));
          if (fallbackCached) return fallbackCached;
          return networkResponse;
        } catch {
          // Hors-ligne ou réseau injoignable -> ouvrir instantanément l'app depuis le cache !
          const cachedApp =
            (await caches.match('/index.html', { ignoreSearch: true })) ||
            (await caches.match('/', { ignoreSearch: true })) ||
            (await caches.match(request, { ignoreSearch: true }));
          if (cachedApp) return cachedApp;

          return new Response(
            `<!doctype html>
            <html lang="fr">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>StudyCloud - Hors connexion</title>
                <style>
                  body { margin:0; padding:0; background:#0f1117; color:#fff; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; }
                  .card { max-width:360px; padding:24px; background:#1a1d24; border-radius:20px; border:1px solid #2d3342; }
                  h1 { font-size:19px; margin-bottom:8px; color:#60a5fa; }
                  p { font-size:13px; color:#9ca3af; line-height:1.5; margin-bottom:16px; }
                  button { background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:12px; font-weight:bold; cursor:pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>StudyCloud - Hors connexion</h1>
                  <p>Ouvrez StudyCloud une première fois avec Internet pour activer le mode hors connexion complet.</p>
                  <button onclick="window.location.reload()">Réessayer</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }

  // B. REQUÊTES API / WORKERS (Network Only avec réponse JSON propre hors-ligne)
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('api-worker.dkd-technologies.com')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: 'Vous êtes actuellement hors connexion internet.',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // C. ASSETS IMMUTABLES HACHÉS DE L'APPLICATION (/assets/*.js, /assets/*.css, /assets/*.woff2, etc.)
  // Stratégie Cache-First stricte : ouverture hors-ligne instantanée (0 ms réseau) et plafond 15 Mo pour le bundle principal
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const contentLength = Number(networkResponse.headers.get('content-length') || 0);
            const isMedia = contentType.startsWith('video/') || contentType.startsWith('audio/');
            const isTooLarge = contentLength > 15 * 1024 * 1024;
            if (!isMedia && !isTooLarge) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
            }
          }
          return networkResponse;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline Asset Unavailable' });
        }
      })()
    );
    return;
  }

  // D. AUTRES RESSOURCES STATIQUES DU SITE (Icônes, fonds d'écran, manifeste, polices)
  const isStaticAsset =
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net');

  if (!isStaticAsset) {
    return;
  }

  // Stale-While-Revalidate sécurisé (ne retourne JAMAIS undefined en hors-ligne)
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      const networkPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const contentLength = Number(networkResponse.headers.get('content-length') || 0);
            const isMedia = contentType.startsWith('video/') || contentType.startsWith('audio/');
            const isTooLarge = contentLength > 10 * 1024 * 1024;
            if (!isMedia && !isTooLarge) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
            }
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkPromise);
        return cachedResponse;
      }

      const fresh = await networkPromise;
      return fresh || new Response('', { status: 504, statusText: 'Offline' });
    })()
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
