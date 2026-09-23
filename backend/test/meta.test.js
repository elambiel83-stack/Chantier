// Teste channels/meta.js sans dépendre de vrais identifiants Meta: la poignée de main de
// webhook et la vérification de signature doivent suivre exactement les règles Meta
// (voir channels/meta.js), et le parsing doit extraire les mêmes champs quel que soit le
// canal (WhatsApp vs Messenger) sans planter sur un événement inattendu (accusé de
// réception, pièce jointe...).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyHandshake, verifySignature, extractIncomingMessages } = require('../channels/meta');

test('verifyHandshake: accepte quand le mode et le jeton correspondent', () => {
  const challenge = verifyHandshake({ mode: 'subscribe', token: 'secret', challenge: 'abc123' }, 'secret');
  assert.equal(challenge, 'abc123');
});

test('verifyHandshake: refuse un mauvais jeton', () => {
  assert.equal(verifyHandshake({ mode: 'subscribe', token: 'mauvais', challenge: 'abc123' }, 'secret'), null);
});

test('verifyHandshake: refuse un mode différent de subscribe', () => {
  assert.equal(verifyHandshake({ mode: 'unsubscribe', token: 'secret', challenge: 'abc123' }, 'secret'), null);
});

test('verifyHandshake: refuse si aucun jeton attendu n’est configuré', () => {
  assert.equal(verifyHandshake({ mode: 'subscribe', token: 'secret', challenge: 'abc123' }, undefined), null);
});

function signBody(body, secret) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

test('verifySignature: accepte une signature calculée avec le bon secret', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(verifySignature(body, signBody(body, 'app-secret'), 'app-secret'), true);
});

test('verifySignature: refuse une signature calculée avec un autre secret', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(verifySignature(body, signBody(body, 'autre-secret'), 'app-secret'), false);
});

test('verifySignature: refuse un corps modifié après signature', () => {
  const original = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = signBody(original, 'app-secret');
  const tampered = Buffer.from(JSON.stringify({ hello: 'monde' }));
  assert.equal(verifySignature(tampered, signature, 'app-secret'), false);
});

test('verifySignature: refuse sans en-tête, sans secret configuré, ou sans corps', () => {
  const body = Buffer.from('{}');
  assert.equal(verifySignature(body, undefined, 'app-secret'), false);
  assert.equal(verifySignature(body, signBody(body, 'app-secret'), undefined), false);
  assert.equal(verifySignature(undefined, signBody(body, 'app-secret'), 'app-secret'), false);
});

test('extractIncomingMessages: message texte WhatsApp', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ from: '243999000001', type: 'text', text: { body: '1' } }] } }] }]
  };
  assert.deepEqual(extractIncomingMessages(payload), [{ channel: 'whatsapp', externalId: '243999000001', text: '1' }]);
});

test('extractIncomingMessages: message texte Messenger', () => {
  const payload = {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: 'psid-123' }, message: { text: 'menu' } }] }]
  };
  assert.deepEqual(extractIncomingMessages(payload), [{ channel: 'messenger', externalId: 'psid-123', text: 'menu' }]);
});

test('extractIncomingMessages: ignore les statuts WhatsApp (accusés de réception) et les échos Messenger', () => {
  const whatsappStatus = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] }]
  };
  const messengerEcho = {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: 'psid-123' }, message: { text: 'bien reçu', is_echo: true } }] }]
  };
  assert.deepEqual(extractIncomingMessages(whatsappStatus), []);
  assert.deepEqual(extractIncomingMessages(messengerEcho), []);
});

test('extractIncomingMessages: objet inconnu renvoie une liste vide sans planter', () => {
  assert.deepEqual(extractIncomingMessages({ object: 'instagram' }), []);
  assert.deepEqual(extractIncomingMessages({}), []);
});
