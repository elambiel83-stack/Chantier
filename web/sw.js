// Service Worker MonChantier
// Règle de base: le code de l'application passe par le réseau en premier (sinon une
// correction ne parvient jamais au navigateur), les fichiers immuables par le cache.
const VERSION = 'v2';
const SHELL_CACHE = `monchantier-shell-${VERSION}`;
const ASSET_CACHE = `monchantier-assets-${VERSION}`;
const API_CACHE = `monchantier-api-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

const SHELL_URLS = [
  '/',
  '/index.html',
  '/cart.html',
  '/auth.html',
  '/privacy.html',
  '/terms.html',
  '/config.js',
  '/products.js',
  '/site.js',
  '/auth.js',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((error) => console.warn('Service Worker: pré-cache incomplet', error))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => !CURRENT_CACHES.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function offlineJson(message) {
  return new Response(JSON.stringify({ success: false, message }), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json' }
  });
}

// Réponse du réseau, cache en secours. caches.match renvoie une promesse qui peut
// résoudre sur undefined: il faut l'attendre avant de décider du repli.
async function networkFirst(request, cacheName, { cacheable = true } = {}) {
  try {
    const response = await fetch(request);
    if (cacheable && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Les ressources tierces (CDN, images distantes) restent gérées par le navigateur.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Une réponse authentifiée est personnelle: elle ne doit jamais atterrir dans un
    // cache partagé par tous les utilisateurs du navigateur.
    const isPersonal = request.headers.has('Authorization') || url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/orders') || url.pathname.startsWith('/api/import-requests');
    event.respondWith(
      networkFirst(request, API_CACHE, { cacheable: !isPersonal })
        .catch(() => offlineJson('Hors ligne: données indisponibles.'))
    );
    return;
  }

  // Pages et scripts: toujours la version du serveur quand il répond.
  if (request.mode === 'navigate' || /\.(?:html|js|css|webmanifest)$/.test(url.pathname) || url.pathname === '/') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE)
        .catch(() => caches.match('/index.html').then((page) => page || Response.error()))
    );
    return;
  }

  // Images, icônes, polices: contenu stable, le cache d'abord.
  event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => Response.error()));
});
