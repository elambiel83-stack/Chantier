const CACHE_NAME = 'monchantier-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/cart.html',
  '/test-api.html',
  '/site.js',
  '/products.js',
  '/config.js',
  '/site.webmanifest',
  'https://cdn.tailwindcss.com',
  '/assets/monchantier_logo.svg'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Cache créé');
      return cache.addAll(URLS_TO_CACHE.filter(url => !url.includes('http')));
    })
  );
  self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation en cours...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression du cache ancien:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de mise en cache: Network First, Fall back to Cache
self.addEventListener('fetch', (event) => {
  // Ignorer les demandes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Pour les appels API, utiliser Network First avec timeout
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise(resolve => 
          setTimeout(() => resolve(null), 5000)
        )
      ]).then((response) => {
        if (response && response.status === 200) {
          // Mettre en cache les réponses API
          const cache = caches.open('api-cache-v1');
          cache.then(c => c.put(event.request, response.clone()));
          return response;
        }
        // Fallback sur le cache si réseau indisponible
        return caches.match(event.request) || new Response(
          JSON.stringify({ error: 'Offline - cached data may be unavailable' }),
          { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
        );
      }).catch(() => {
        return caches.match(event.request) || new Response(
          JSON.stringify({ error: 'Offline' }),
          { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Pour les autres ressources, utiliser Cache First
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Retourner une page offline si disponible
        return caches.match('/index.html');
      });
    })
  );
});

// Sync en arrière-plan (optionnel, nécessite HTTPS en production)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync en arrière-plan:', event.tag);
});
