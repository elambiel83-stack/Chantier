// Envoi de notifications (e-mail, SMS, WhatsApp) pour les codes de vérification. Chaque
// canal échoue explicitement (.status = 503) s'il n'est pas configuré, plutôt que de
// simuler un envoi réussi — même principe que PayPal/Airtel Money/Orange Money.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`${name} non configuré`), { status: 503 });
  return value;
}

async function sendEmail(to, subject, text) {
  const apiKey = requireEnv('RESEND_API_KEY');
  const from = process.env.RESEND_FROM_EMAIL || 'MonChantier <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text })
  });
  if (!response.ok) throw new Error(`Envoi e-mail refusé (${response.status})`);
}

async function sendSms(to, message) {
  const apiKey = requireEnv('AFRICASTALKING_API_KEY');
  const username = requireEnv('AFRICASTALKING_USERNAME');
  const host = process.env.AFRICASTALKING_ENV === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
  const response = await fetch(`https://${host}/version1/messaging`, {
    method: 'POST',
    headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username, to, message })
  });
  if (!response.ok) throw new Error(`Envoi SMS refusé (${response.status})`);
  const data = await response.json().catch(() => null);
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (recipient && !['Success', 'Sent', 'Queued'].includes(recipient.status)) {
    throw new Error(`Envoi SMS refusé: ${recipient.status}`);
  }
}

// API WhatsApp Business d'Africa's Talking: nécessite un numéro WhatsApp Business approuvé
// et, hors fenêtre de conversation de 24h, un modèle de message pré-approuvé pour un
// premier contact. Cette API a changé de forme plusieurs fois par le passé — vérifiez
// l'URL et le format exacts sur votre tableau de bord Africa's Talking avant mise en
// production: ce module n'a pas pu être testé avec de vrais identifiants dans cet
// environnement (voir README).
async function sendWhatsApp(to, message) {
  const apiKey = requireEnv('AFRICASTALKING_API_KEY');
  const username = requireEnv('AFRICASTALKING_USERNAME');
  const senderNumber = requireEnv('AFRICASTALKING_WHATSAPP_NUMBER');
  const response = await fetch('https://chat.africastalking.com/whatsapp/message/send', {
    method: 'POST',
    headers: { apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      username,
      phoneNumber: senderNumber,
      Recipients: [{ number: to, message: { type: 'text', body: { text: message } } }]
    })
  });
  if (!response.ok) throw new Error(`Envoi WhatsApp refusé (${response.status})`);
}

// Ce que le frontend peut effectivement proposer: jamais un canal qui échouerait à l'envoi.
function channelAvailability() {
  const hasAfricasTalking = Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);
  return {
    email: Boolean(process.env.RESEND_API_KEY),
    sms: hasAfricasTalking,
    whatsapp: hasAfricasTalking && Boolean(process.env.AFRICASTALKING_WHATSAPP_NUMBER)
  };
}

module.exports = { sendEmail, sendSms, sendWhatsApp, channelAvailability };
