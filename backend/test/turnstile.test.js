// Teste turnstile.js sans dépendre d'une vraie clé Cloudflare: le comportement "non
// configuré" doit laisser passer (CAPTCHA optionnel), et la décision doit suivre
// exactement ce que Cloudflare renvoie (fetch mocké).
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

let originalFetch;
let originalEnv;

beforeEach(() => {
  originalFetch = global.fetch;
  originalEnv = { ...process.env };
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

function freshTurnstile() {
  delete require.cache[require.resolve('../turnstile')];
  return require('../turnstile');
}

test('non configuré (pas de TURNSTILE_SECRET_KEY): laisse toujours passer', async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const { verifyTurnstileToken } = freshTurnstile();
  assert.equal(await verifyTurnstileToken(undefined, '1.2.3.4'), true);
  assert.equal(await verifyTurnstileToken('un-jeton', '1.2.3.4'), true);
});

test('configuré sans jeton fourni par le client: refuse sans appeler Cloudflare', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  let called = false;
  global.fetch = async () => { called = true; return { ok: true, json: async () => ({ success: true }) }; };
  const { verifyTurnstileToken } = freshTurnstile();
  assert.equal(await verifyTurnstileToken(undefined, '1.2.3.4'), false);
  assert.equal(called, false);
});

test('configuré, Cloudflare confirme: accepte', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  let capturedBody;
  global.fetch = async (url, options) => {
    capturedBody = options.body.toString();
    return { ok: true, json: async () => ({ success: true }) };
  };
  const { verifyTurnstileToken } = freshTurnstile();
  assert.equal(await verifyTurnstileToken('jeton-valide', '1.2.3.4'), true);
  assert.match(capturedBody, /secret=secret/);
  assert.match(capturedBody, /response=jeton-valide/);
  assert.match(capturedBody, /remoteip=1\.2\.3\.4/);
});

test('configuré, Cloudflare refuse: rejette', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  global.fetch = async () => ({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });
  const { verifyTurnstileToken } = freshTurnstile();
  assert.equal(await verifyTurnstileToken('jeton-invalide', '1.2.3.4'), false);
});

test('configuré, Cloudflare injoignable (HTTP non ok): rejette par prudence', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  global.fetch = async () => ({ ok: false, status: 500 });
  const { verifyTurnstileToken } = freshTurnstile();
  assert.equal(await verifyTurnstileToken('jeton', '1.2.3.4'), false);
});
