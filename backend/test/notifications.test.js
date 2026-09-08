// Teste notifications.js sans dépendre de vraies clés Resend/Africa's Talking: vérifie
// que chaque canal échoue explicitement (503) quand non configuré, et que la requête
// envoyée a la forme attendue quand il l'est (fetch mocké — ne prouve pas que l'API
// distante l'accepterait réellement, voir la mise en garde dans notifications.js).
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

function freshNotifications() {
  delete require.cache[require.resolve('../notifications')];
  return require('../notifications');
}

test('channelAvailability: tout à false sans configuration', () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.AFRICASTALKING_API_KEY;
  delete process.env.AFRICASTALKING_USERNAME;
  delete process.env.AFRICASTALKING_WHATSAPP_NUMBER;
  const { channelAvailability } = freshNotifications();
  assert.deepEqual(channelAvailability(), { email: false, sms: false, whatsapp: false });
});

test('channelAvailability: whatsapp exige aussi le numéro expéditeur', () => {
  process.env.AFRICASTALKING_API_KEY = 'k';
  process.env.AFRICASTALKING_USERNAME = 'u';
  delete process.env.AFRICASTALKING_WHATSAPP_NUMBER;
  const { channelAvailability } = freshNotifications();
  const result = channelAvailability();
  assert.equal(result.sms, true);
  assert.equal(result.whatsapp, false);
});

test('sendEmail: refuse sans RESEND_API_KEY (503)', async () => {
  delete process.env.RESEND_API_KEY;
  const { sendEmail } = freshNotifications();
  await assert.rejects(() => sendEmail('a@example.test', 'Sujet', 'Texte'), (error) => error.status === 503);
});

test('sendSms: refuse sans identifiants Africa\'s Talking (503)', async () => {
  delete process.env.AFRICASTALKING_API_KEY;
  delete process.env.AFRICASTALKING_USERNAME;
  const { sendSms } = freshNotifications();
  await assert.rejects(() => sendSms('+243999000000', 'Texte'), (error) => error.status === 503);
});

test('sendWhatsApp: refuse sans numéro expéditeur configuré (503)', async () => {
  process.env.AFRICASTALKING_API_KEY = 'k';
  process.env.AFRICASTALKING_USERNAME = 'u';
  delete process.env.AFRICASTALKING_WHATSAPP_NUMBER;
  const { sendWhatsApp } = freshNotifications();
  await assert.rejects(() => sendWhatsApp('+243999000000', 'Texte'), (error) => error.status === 503);
});

test('sendEmail: configuré, appelle l\'API Resend avec le bon jeton et corps', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true };
  };
  const { sendEmail } = freshNotifications();
  await sendEmail('client@example.test', 'Sujet', 'Contenu');
  assert.equal(capturedUrl, 'https://api.resend.com/emails');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(capturedOptions.body);
  assert.equal(body.to, 'client@example.test');
  assert.equal(body.subject, 'Sujet');
});

test('sendEmail: propage une erreur si Resend refuse', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 422 });
  const { sendEmail } = freshNotifications();
  await assert.rejects(() => sendEmail('client@example.test', 'Sujet', 'Contenu'), /422/);
});

test('sendSms: configuré, appelle l\'API Africa\'s Talking et vérifie le statut du destinataire', async () => {
  process.env.AFRICASTALKING_API_KEY = 'test-key';
  process.env.AFRICASTALKING_USERNAME = 'monchantier';
  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, json: async () => ({ SMSMessageData: { Recipients: [{ status: 'Success' }] } }) };
  };
  const { sendSms } = freshNotifications();
  await sendSms('+243999000000', 'Votre code: 123456');
  assert.equal(capturedUrl, 'https://api.africastalking.com/version1/messaging');
  assert.equal(capturedOptions.headers.apiKey, 'test-key');
});

test('sendSms: rejette si Africa\'s Talking signale un échec sur le destinataire', async () => {
  process.env.AFRICASTALKING_API_KEY = 'test-key';
  process.env.AFRICASTALKING_USERNAME = 'monchantier';
  global.fetch = async () => ({ ok: true, json: async () => ({ SMSMessageData: { Recipients: [{ status: 'InvalidPhoneNumber' }] } }) });
  const { sendSms } = freshNotifications();
  await assert.rejects(() => sendSms('bad-number', 'Texte'), /InvalidPhoneNumber/);
});

test('sendSms: environnement sandbox utilise l\'hôte sandbox', async () => {
  process.env.AFRICASTALKING_API_KEY = 'test-key';
  process.env.AFRICASTALKING_USERNAME = 'monchantier';
  process.env.AFRICASTALKING_ENV = 'sandbox';
  let capturedUrl;
  global.fetch = async (url) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({}) };
  };
  const { sendSms } = freshNotifications();
  await sendSms('+243999000000', 'Texte');
  assert.equal(capturedUrl, 'https://api.sandbox.africastalking.com/version1/messaging');
});
