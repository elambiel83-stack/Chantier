// Intégration CinetPay (transfert d'argent marchand-à-marchand), pour verser leur part aux
// vendeurs dont le pays n'est pas couvert par un moyen de versement classique — voir
// docs/marketplace-schema-cible.md (phase 5) pour le contexte marketplace multi-vendeurs.
//
// Base d'API et authentification confirmées par l'exploitant du projet en session (nouveau
// back-office CinetPay, distinct de l'ancien documenté sur docs.cinetpay.com):
//   - Base: https://api.cinetpay.net
//   - Authentification: un jeton API unique (Authorization: Bearer), plus de paire
//     apikey + site_id / mot de passe séparée comme sur l'ancien back-office.
//
// TOUJOURS NON VÉRIFIÉ PAR EXÉCUTION RÉELLE au-delà de ces deux points: l'accès à
// cinetpay.net était bloqué depuis cet environnement de développement, donc ni le chemin
// exact de l'endpoint de transfert, ni les noms de champs de la requête/réponse n'ont pu
// être confirmés contre un compte réel. Deux hypothèses sur trois tirées de la
// documentation "ancien back-office" (domaine, authentification) se sont déjà révélées
// fausses pour le nouveau — traiter tout le reste ci-dessous comme une hypothèse de
// travail à vérifier en priorité (avec un compte de test réel) avant toute activation en
// production, jamais comme une intégration terminée.
//
// Reste inactive tant que CINETPAY_API_KEY n'est pas configuré: voir isConfigured() et son
// usage dans server.js (POST /api/admin/organizations/:id/payouts), qui répond 503 plutôt
// que de simuler un succès.

function isConfigured() {
  return Boolean(process.env.CINETPAY_API_KEY);
}

function apiBase() {
  return process.env.CINETPAY_API_BASE || 'https://api.cinetpay.net';
}

// amount est déjà dans la devise locale du vendeur (ex. CDF en RDC): l'API de transfert
// CinetPay paie en devise locale, pas en USD — la conversion est à la charge de l'appelant.
async function sendTransfer({ phone, countryPrefix, amount, reference }) {
  if (!isConfigured()) throw new Error('CinetPay n’est pas configuré');
  const response = await fetch(`${apiBase()}/v1/transfer/money/send/contact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CINETPAY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefix: countryPrefix,
      phone,
      amount: Math.round(amount),
      client_transaction_id: reference,
      ...(process.env.CINETPAY_NOTIFY_URL ? { notify_url: process.env.CINETPAY_NOTIFY_URL } : {})
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
