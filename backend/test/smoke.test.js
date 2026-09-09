// Test de fumée: démarre le serveur réel (sans base de données, sur le catalogue de
// repli) et vérifie que les routes critiques répondent correctement. Ne dépend
// d'aucune dépendance de test supplémentaire (node:test est fourni par Node.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 4100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-at-least-32-characters-long',
      DATABASE_URL: '',
      CORS_ORIGIN: BASE_URL
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Attend que le serveur réponde sur /healthz plutôt qu'un délai fixe.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) return;
    } catch (error) {
      // Le serveur n'écoute pas encore: on réessaie.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Le serveur ne répond pas sur /healthz dans le délai imparti');
});

after(() => {
  server?.kill();
});

test('GET /healthz répond ok sans base de données', async () => {
  const response = await fetch(`${BASE_URL}/healthz`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'disabled');
});

test('GET /api/products renvoie le catalogue', async () => {
  const response = await fetch(`${BASE_URL}/api/products`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.products) && body.products.length > 0);
});

test('GET /api/products/:id renvoie un produit connu', async () => {
  const response = await fetch(`${BASE_URL}/api/products/CIM-001`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.product.id, 'CIM-001');
});

test('GET /api/products/:id renvoie 404 pour un produit inconnu', async () => {
  const response = await fetch(`${BASE_URL}/api/products/INCONNU`);
  assert.equal(response.status, 404);
});

test('GET /api/currency-rates renvoie les taux de repli', async () => {
  const response = await fetch(`${BASE_URL}/api/currency-rates`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.rates.USD, 1);
});

test('POST /api/cart/session renvoie un identifiant de panier', async () => {
  const response = await fetch(`${BASE_URL}/api/cart/session`, { method: 'POST' });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.sessionId, /^[0-9a-f-]{36}$/);
});

// Sans DATABASE_URL, requireAuthentication refuse la requête avant même de
// regarder le jeton: le service de commande est explicitement indisponible
// plutôt que de planter. Le contrôle du jeton lui-même nécessite une base
// (voir les tests d'intégration avec PostgreSQL, hors périmètre de ce smoke test).
test('POST /api/orders sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(response.status, 503);
});

test('POST /api/import-requests sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/import-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(response.status, 503);
});

test('POST /api/auth/google sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'x'.repeat(30) })
  });
  assert.equal(response.status, 503);
});

test('POST /api/auth/apple sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: 'x'.repeat(30) })
  });
  assert.equal(response.status, 503);
});

test('GET /api/auth/verification/channels ne propose que des canaux configurés', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/verification/channels`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  // Aucune clé d'API email/SMS/WhatsApp dans cet environnement de test.
  assert.deepEqual(body.channels, { email: false, sms: false, whatsapp: false });
});

test('POST /api/auth/verification/send sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/verification/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'email' })
  });
  assert.equal(response.status, 503);
});

test('POST /api/auth/verification/confirm sans base de données répond 503', async () => {
  const response = await fetch(`${BASE_URL}/api/auth/verification/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '123456' })
  });
  assert.equal(response.status, 503);
});
