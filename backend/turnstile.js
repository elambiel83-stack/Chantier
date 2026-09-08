// Vérifie un jeton Cloudflare Turnstile côté serveur: comme pour Google/Apple, seule la
// réponse de Cloudflare fait foi, jamais ce que le client affirme avoir résolu.
// Non configuré (pas de TURNSTILE_SECRET_KEY), la vérification est un no-op qui laisse
// passer — le CAPTCHA est une protection en plus, pas une dépendance dure comme les
// paiements ou l'authentification sociale.
async function verifyTurnstileToken(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(remoteip ? { remoteip } : {}) })
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => null);
  return Boolean(data?.success);
}

module.exports = { verifyTurnstileToken };
