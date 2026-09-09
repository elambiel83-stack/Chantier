// Teste cinetpay.js sans dépendre d'un vrai compte CinetPay: la garantie la plus
// importante à ce stade est que l'intégration reste inerte tant qu'elle n'est pas
// configurée (voir l'avertissement en tête de cinetpay.js — la forme exacte de la requête
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
  let called = false;
  global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const { isConfigured, sendTransfer } = freshCinetpay();
  assert.equal(isConfigured(), false);
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }));
  assert.equal(called, false);
});

test('configuré, transfert réussi: envoie le jeton en Bearer et renvoie la référence', async () => {
  process.env.CINETPAY_API_KEY = 'test-token';
  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url.toString();
    capturedOptions = options;
    return { ok: true, json: async () => ({ code: '0' }) };
  };
  const { sendTransfer } = freshCinetpay();
  const result = await sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 15000, reference: 'ref-1' });
  assert.equal(result.providerReference, 'ref-1');
  assert.equal(capturedUrl, 'https://api.cinetpay.net/v1/transfer/money/send/contact');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-token');
  const body = JSON.parse(capturedOptions.body);
  assert.equal(body.phone, '900000000');
  assert.equal(body.prefix, '243');
  assert.equal(body.amount, 15000);
  assert.equal(body.client_transaction_id, 'ref-1');
});

test('configuré, requête HTTP refusée: échoue', async () => {
  process.env.CINETPAY_API_KEY = 'test-token';
  global.fetch = async () => ({ ok: false, status: 401 });
  const { sendTransfer } = freshCinetpay();
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }));
});

test('configuré, transfert refusé par CinetPay (code différent de 0): échoue avec le message', async () => {
  process.env.CINETPAY_API_KEY = 'test-token';
  global.fetch = async () => ({ ok: true, json: async () => ({ code: '600', message: 'Solde insuffisant' }) });
  const { sendTransfer } = freshCinetpay();
  await assert.rejects(() => sendTransfer({ phone: '900000000', countryPrefix: '243', amount: 1000, reference: 'x' }), /Solde insuffisant/);
});
