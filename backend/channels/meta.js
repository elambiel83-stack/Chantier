// Couche Meta (WhatsApp Cloud API + Messenger Platform): les deux canaux passent par la
// même Meta App, donc la même vérification de webhook (GET) et la même signature (POST) —
// seuls les formats de charge utile et les endpoints d'envoi diffèrent.
const crypto = require('crypto');

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Poignée de main initiale déclarée dans le tableau de bord Meta: Meta appelle cette route
// en GET avec le jeton choisi à la configuration, pour prouver qu'on contrôle bien ce
// serveur avant de lui envoyer de vrais événements.
function verifyHandshake({ mode, token, challenge }, expectedToken) {
  if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
    return challenge;
  }
  return null;
}

// Comparaison en temps constant: une différence de timing sur une comparaison naïve
// (===) pourrait laisser deviner la signature attendue octet par octet.
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret || !rawBody) return false;
  const [algo, signature] = signatureHeader.split('=');
  if (algo !== 'sha256' || !signature) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

// Réduit les deux formats de charge utile (WhatsApp / Messenger) à une liste de messages
// texte normalisés. Les événements qui ne sont pas des messages texte entrants (accusés de
// réception, réactions, pièces jointes...) sont ignorés: le bot ne sait répondre qu'au texte.
function extractIncomingMessages(body) {
  const messages = [];
  if (body?.object === 'whatsapp_business_account') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const message of change.value?.messages || []) {
          if (message.type === 'text' && message.text?.body) {
            messages.push({ channel: 'whatsapp', externalId: message.from, text: message.text.body });
          }
        }
      }
    }
  } else if (body?.object === 'page') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message?.text && !event.message?.is_echo) {
          messages.push({ channel: 'messenger', externalId: event.sender?.id, text: event.message.text });
        }
      }
    }
  }
  return messages.filter((message) => message.externalId);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`${name} non configuré`), { status: 503 });
  return value;
}

async function sendWhatsAppText(to, body) {
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = requireEnv('WHATSAPP_ACCESS_TOKEN');
  const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } })
  });
  if (!response.ok) throw new Error(`Envoi WhatsApp refusé (${response.status}): ${await response.text().catch(() => '')}`);
}

async function sendMessengerText(psid, text) {
  const pageAccessToken = requireEnv('MESSENGER_PAGE_ACCESS_TOKEN');
  const response = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text } })
  });
  if (!response.ok) throw new Error(`Envoi Messenger refusé (${response.status}): ${await response.text().catch(() => '')}`);
}

async function sendText(channel, externalId, text) {
  if (channel === 'whatsapp') return sendWhatsAppText(externalId, text);
  if (channel === 'messenger') return sendMessengerText(externalId, text);
  throw new Error(`Canal inconnu: ${channel}`);
}

module.exports = { verifyHandshake, verifySignature, extractIncomingMessages, sendText };
