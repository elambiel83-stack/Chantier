'use strict';

const MALIPO_BASE_URL = process.env.MALIPO_API_BASE || 'https://api.malipo.dev/v1';

function requireMalipoKey() {
  const apiKey = process.env.MALIPO_API_KEY;
  if (!apiKey) throw Object.assign(new Error('Malipo n’est pas configuré'), { status: 503 });
  return apiKey;
}

async function malipoRequest(path, options = {}) {
  const apiKey = requireMalipoKey();
  const response = await fetch(`${MALIPO_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error?.message || 'Requête Malipo refusée');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function createMalipoCharge({ orderId, amount, currency, phone, network, description }) {
  return malipoRequest('/charges', {
    method: 'POST',
    headers: { 'Idempotency-Key': `chantier-order-${orderId}` },
    body: JSON.stringify({
      amount,
      currency,
      phone,
      network,
      description,
      metadata: { order_id: orderId }
    })
  });
}

async function retrieveMalipoCharge(chargeId) {
  return malipoRequest(`/charges/${encodeURIComponent(chargeId)}`, { method: 'GET' });
}

module.exports = { createMalipoCharge, retrieveMalipoCharge };
