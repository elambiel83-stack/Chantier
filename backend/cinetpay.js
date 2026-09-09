// Intégration CinetPay (transfert d'argent marchand-à-marchand), pour verser leur part aux
// vendeurs dont le pays n'est pas couvert par un moyen de versement classique — voir
// docs/marketplace-schema-cible.md (phase 5) pour le contexte marketplace multi-vendeurs.
//
// NON VÉRIFIÉE PAR EXÉCUTION RÉELLE. Écrite sans accès à un compte CinetPay confirmé:
// l'accès à cinetpay.com/docs.cinetpay.com était bloqué depuis cet environnement, et les
// identifiants transmis pendant son écriture ne correspondaient pas au schéma
// d'authentification documenté par CinetPay (apikey + site_id, format `sk_test_...` propre
// à Stripe). La forme des requêtes ci-dessous suit le schéma habituel de leur API de
// transfert (authentification séparée par apikey+mot de passe renvoyant un jeton, puis un
// envoi vers ce jeton) mais AUCUN champ exact (URL, noms de paramètres, forme de la
// réponse) n'a été confirmé. À valider avec de vrais identifiants sandbox
// (CINETPAY_API_KEY, CINETPAY_TRANSFER_PASSWORD) contre https://docs.cinetpay.com avant
// toute activation en production.
//
// Reste inactive tant que ces variables ne sont pas renseignées: voir isConfigured() et
// son usage dans server.js (POST /api/admin/organizations/:id/payouts), qui répond 503
// plutôt que de simuler un succès.

function isConfigured() {
  return Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_TRANSFER_PASSWORD);
}

function apiBase() {
  return process.env.CINETPAY_API_BASE || 'https://client.cinetpay.com';
}

// CinetPay authentifie l'API de transfert séparément de l'API de paiement (apikey + mot de
// passe marchand, pas de site_id ici) et renvoie un jeton à courte durée de vie.
async function getTransferToken() {
  const response = await fetch(`${apiBase()}/v1/auth/login?lang=fr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      apikey: process.env.CINETPAY_API_KEY,
      password: process.env.CINETPAY_TRANSFER_PASSWORD
    })
  });
  if (!response.ok) throw new Error('Authentification CinetPay refusée');
  const data = await response.json();
  const token = data?.data?.token;
  if (!token) throw new Error('Authentification CinetPay: jeton absent de la réponse');
  return token;
}

// amount est déjà dans la devise locale du vendeur (ex. CDF en RDC): l'API de transfert
// CinetPay paie en devise locale, pas en USD — la conversion est à la charge de l'appelant.
async function sendTransfer({ phone, countryPrefix, amount, reference }) {
  if (!isConfigured()) throw new Error('CinetPay n’est pas configuré');
  const token = await getTransferToken();
  const response = await fetch(`${apiBase()}/v1/transfer/money/send/contact?token=${encodeURIComponent(token)}&lang=fr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      prefix: countryPrefix,
      phone,
      amount: String(Math.round(amount)),
      notify_url: process.env.CINETPAY_NOTIFY_URL || '',
      client_transaction_id: reference
    })
  });
  if (!response.ok) throw new Error('Envoi du transfert CinetPay refusé');
  const data = await response.json();
  // Code de succès supposé ('0'), non confirmé — voir l'avertissement en tête de fichier.
  if (String(data?.code) !== '0') {
    throw new Error(data?.message || 'Le transfert CinetPay a échoué');
  }
  return { providerReference: reference, raw: data };
}

module.exports = { isConfigured, sendTransfer };
