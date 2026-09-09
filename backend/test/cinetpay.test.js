// Teste cinetpay.js sans dépendre d'un vrai compte CinetPay: la garantie la plus
// importante à ce stade est que l'intégration reste inerte tant qu'elle n'est pas
// configurée (voir l'avertissement en tête de cinetpay.js — la forme exacte des requêtes
// contre l'API réelle n'est elle-même pas vérifiée par ces tests).
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

function freshCinetpay() {
  delete require.cache[require.resolve('../cinetpay')];
  return require('../cinetpay');
}

test('non configuré: isConfigured() est faux et sendTransfer échoue sans appeler le réseau', async () => {
  delete process.env.CINETPAY_API_KEY;
  delete process.env.CINETPAY_TRANSFER_PASSWORD;
  let called = false;
  global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const { isConfigured, sendTransfer } = freshCinetpay();
  assert.equal(isConfigured(), false);
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }));
  assert.equal(called, false);
});

test('configuré, authentification et transfert réussis: renvoie la référence', async () => {
  process.env.CINETPAY_API_KEY = 'test-key';
  process.env.CINETPAY_TRANSFER_PASSWORD = 'test-password';
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url.toString());
    if (url.toString().includes('/v1/auth/login')) {
      return { ok: true, json: async () => ({ data: { token: 'jeton-test' } }) };
    }
    return { ok: true, json: async () => ({ code: '0' }) };
  };
  const { sendTransfer } = freshCinetpay();
  const result = await sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 15000, reference: 'ref-1' });
  assert.equal(result.providerReference, 'ref-1');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /token=jeton-test/);
});

test('configuré, authentification refusée: échoue avant tout appel de transfert', async () => {
  process.env.CINETPAY_API_KEY = 'test-key';
  process.env.CINETPAY_TRANSFER_PASSWORD = 'test-password';
  let transferCalled = false;
  global.fetch = async (url) => {
    if (url.toString().includes('/v1/auth/login')) return { ok: false, status: 401 };
    transferCalled = true;
    return { ok: true, json: async () => ({ code: '0' }) };
  };
  const { sendTransfer } = freshCinetpay();
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }));
  assert.equal(transferCalled, false);
});

test('configuré, transfert refusé par CinetPay (code différent de 0): échoue', async () => {
  process.env.CINETPAY_API_KEY = 'test-key';
  process.env.CINETPAY_TRANSFER_PASSWORD = 'test-password';
  global.fetch = async (url) => {
    if (url.toString().includes('/v1/auth/login')) return { ok: true, json: async () => ({ data: { token: 'jeton-test' } }) };
    return { ok: true, json: async () => ({ code: '600', message: 'Solde insuffisant' }) };
  };
  const { sendTransfer } = freshCinetpay();
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }), /Solde insuffisant/);
});
