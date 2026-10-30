const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { createWhatsAppWebhook } = require('../whatsappWebhook');

async function withServer(fn) {
  const app = express();
  app.use('/webhooks/whatsapp', createWhatsAppWebhook({ verifyToken: 'verify-test', appSecret: 'secret-test' }));
  app.use(express.json());
  const server = app.listen(0);
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('Meta GET challenge validates token', async () => withServer(async base => {
  const good = await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=1234');
  assert.equal(good.status, 200);
  assert.equal(await good.text(), '1234');
  const bad = await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1234');
  assert.equal(bad.status, 403);
}));
test('Meta POST rejects unsigned payload and accepts signed payload', async () => withServer(async base => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const url = base + '/webhooks/whatsapp';
  assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })).status, 401);
  const signature = 'sha256=' + crypto.createHmac('sha256', 'secret-test').update(body).digest('hex');
  assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature }, body })).status, 200);
}));
