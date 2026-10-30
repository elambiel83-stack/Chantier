'use strict';
const crypto = require('node:crypto');
const express = require('express');

function createWhatsAppWebhook({ verifyToken, appSecret, onMessage = async () => {} }) {
  const router = express.Router();
  router.get('/', (req, res) => {
    if (!verifyToken) return res.sendStatus(503);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode !== 'subscribe' || typeof token !== 'string' || typeof challenge !== 'string') return res.sendStatus(403);
    const a = Buffer.from(token);
    const b = Buffer.from(verifyToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(403);
    return res.type('text/plain').send(challenge);
  });

  router.post('/', express.raw({ type: 'application/json', limit: '100kb' }), (req, res) => {
    if (!appSecret) return res.sendStatus(503);
    const signature = req.get('x-hub-signature-256');
    if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return res.sendStatus(401);
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) return res.sendStatus(400);
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))) return res.sendStatus(401);
    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.sendStatus(400); }
    if (payload?.object !== 'whatsapp_business_account') return res.sendStatus(400);
    // Phase 1: réception validée uniquement. Ne pas envoyer de réponse ni déclencher
    // d'action commerciale avant l'ajout d'une file durable et de la déduplication.
    Promise.resolve().then(() => onMessage(payload)).catch(() => {});
    return res.sendStatus(200);
  });
  return router;
}
module.exports = { createWhatsAppWebhook };
