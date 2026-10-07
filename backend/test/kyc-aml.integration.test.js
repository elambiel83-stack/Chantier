const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'chantier_test'}`;
const PORT = 4103;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_ACCESS_SECRET = 'test-secret-at-least-32-characters-long';
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

let server;
let pool;
let sequence = 0;

async function waitFor(fn, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out');
}

async function apiFetch(endpoint, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function registerUser(role = 'customer') {
  sequence += 1;
  const result = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: {
      email: `kyc${sequence}@example.test`,
      password: 'password-super-securise',
      fullName: `Kyc User ${sequence}`,
      phone: `+24311111${String(sequence).padStart(4, '0')}`
    }
  });
  assert.equal(result.response.status, 201);
  if (role !== 'customer') {
    await pool.query('UPDATE user_account SET role = $1, updated_at = now() WHERE id = $2', [role, result.payload.user.id]);
  }
  return result.payload;
}

async function createOrder(accessToken, { paymentProvider = 'airtel_money', currency = 'USD', qty = 1 } = {}) {
  return apiFetch('/api/orders', {
    method: 'POST',
    token: accessToken,
    body: {
      customer: { fullName: 'Client Conforme', phone: '+243999999999', email: 'client@example.test' },
      currency,
      paymentProvider,
      items: [{ id: 'CIM-001', qty }]
    }
  });
}

async function createKycProfile(token, overrides = {}) {
  return apiFetch('/api/kyc/profile', {
    method: 'PUT',
    token,
    body: {
      customerType: 'individual',
      legalFullName: 'Client Conforme',
      dateOfBirth: '1990-05-02',
      nationality: 'CD',
      residentialAddress: '1 avenue du Test, Kinshasa',
      documentType: 'passport',
      documentNumber: 'AB1234567',
      documentIssuingCountry: 'CD',
      documentExpiresAt: '2030-05-02',
      providerMode: 'internal',
      authorizedRepresentatives: [],
      beneficialOwners: [],
      ...overrides
    }
  });
}

before(async () => {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
  await pool.query(schemaSql);
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET,
      DATABASE_URL,
      CORS_ORIGIN: BASE_URL,
      APP_URL: BASE_URL,
      AIRTEL_MONEY_PAYOUT_NUMBER: '+243999000001',
      ORANGE_MONEY_PAYOUT_NUMBER: '+243999000002'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitFor(async () => {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  });
});

beforeEach(async () => {
  await pool.query(schemaSql);
  await pool.query('TRUNCATE TABLE aml_alert, aml_case, kyc_document, kyc_audit_log, kyc_profile, payment, order_item, orders, refresh_token, verification_code, import_request, user_account, customer RESTART IDENTITY CASCADE');
  await pool.query('UPDATE product SET stock_qty = 1000');
  await pool.query(`UPDATE compliance_program
    SET order_kyc_threshold_usd = 10,
        manual_payment_review_threshold_usd = 5,
        aml_alert_threshold_usd = 6,
        kyc_mode = 'hybrid',
        provider_name = 'internal-team',
        updated_at = now()
    WHERE id = true`);
});

after(async () => {
  server?.kill();
  await pool?.end();
});

test('customer non vérifié est bloqué au-dessus du seuil KYC', async () => {
  const user = await registerUser();
  const order = await createOrder(user.accessToken);

  assert.equal(order.response.status, 403);
  assert.equal(order.payload.code, 'kyc_required');

  const audit = await pool.query("SELECT action FROM kyc_audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [user.user.id]);
  assert.equal(audit.rows[0].action, 'order_gated');
});

test('staff ne peut pas prendre de décision KYC', async () => {
  const customer = await registerUser();
  const staff = await registerUser('staff');
  await createKycProfile(customer.accessToken);
  await apiFetch('/api/kyc/documents', {
    method: 'POST',
    token: customer.accessToken,
    body: { documentKind: 'identity_front', fileName: 'passport.pdf', storageKey: 'vault://passport', mimeType: 'application/pdf' }
  });
  await apiFetch('/api/kyc/submit', { method: 'POST', token: customer.accessToken });

  const review = await apiFetch(`/api/admin/kyc/${customer.user.id}/review`, {
    method: 'PATCH',
    token: staff.accessToken,
    body: { status: 'kyc_approuve', justification: 'Validation interdite pour le staff non conformité' }
  });

  assert.equal(review.response.status, 403);
});

test('compliance approuve le dossier et les commandes à risque créent une alerte AML', async () => {
  const customer = await registerUser();
  const reviewer = await registerUser('compliance');

  assert.equal((await createKycProfile(customer.accessToken)).response.status, 200);
  assert.equal((await apiFetch('/api/kyc/documents', {
    method: 'POST',
    token: customer.accessToken,
    body: { documentKind: 'identity_front', fileName: 'passport.pdf', storageKey: 'vault://passport', mimeType: 'application/pdf' }
  })).response.status, 201);
  assert.equal((await apiFetch('/api/kyc/submit', { method: 'POST', token: customer.accessToken })).response.status, 200);

  const review = await apiFetch(`/api/admin/kyc/${customer.user.id}/review`, {
    method: 'PATCH',
    token: reviewer.accessToken,
    body: {
      status: 'kyc_approuve',
      justification: 'Dossier complet et conforme',
      customerRiskScore: 25,
      transactionRiskScore: 40,
      sanctionsScreeningStatus: 'clear',
      pepScreeningStatus: 'clear',
      adverseMediaStatus: 'not_required',
      nextReviewAt: '2030-01-01'
    }
  });
  assert.equal(review.response.status, 200);

  const order = await createOrder(customer.accessToken);
  assert.equal(order.response.status, 201);

  const alert = await pool.query("SELECT alert_type, status FROM aml_alert WHERE order_id = $1", [order.payload.order.id]);
  assert.equal(alert.rows.length >= 1, true);
  assert.equal(alert.rows[0].status, 'ouvert');
});

test('un dossier KYC expiré rebloque les transactions à seuil', async () => {
  const customer = await registerUser();
  const reviewer = await registerUser('compliance');
  await createKycProfile(customer.accessToken);
  await apiFetch('/api/kyc/documents', {
    method: 'POST',
    token: customer.accessToken,
    body: { documentKind: 'identity_front', fileName: 'passport.pdf', storageKey: 'vault://passport', mimeType: 'application/pdf' }
  });
  await apiFetch('/api/kyc/submit', { method: 'POST', token: customer.accessToken });
  await apiFetch(`/api/admin/kyc/${customer.user.id}/review`, {
    method: 'PATCH',
    token: reviewer.accessToken,
    body: { status: 'kyc_approuve', justification: 'Validation initiale conforme', nextReviewAt: '2030-01-01' }
  });
  await pool.query("UPDATE kyc_profile SET next_review_at = now() - interval '1 day' WHERE user_id = $1", [customer.user.id]);

  const order = await createOrder(customer.accessToken);
  assert.equal(order.response.status, 403);
  assert.equal(order.payload.code, 'kyc_required');

  const profile = await pool.query('SELECT verification_status FROM kyc_profile WHERE user_id = $1', [customer.user.id]);
  assert.equal(profile.rows[0].verification_status, 'kyc_expire');
});

test('une demande d’importation exige un KYC approuvé', async () => {
  const customer = await registerUser();
  const blocked = await apiFetch('/api/import-requests', {
    method: 'POST',
    token: customer.accessToken,
    body: { sourceUrl: 'https://example.test/produit', description: 'Produit de test très détaillé', targetQty: 2 }
  });
  assert.equal(blocked.response.status, 403);

  const reviewer = await registerUser('compliance');
  await createKycProfile(customer.accessToken);
  await apiFetch('/api/kyc/documents', {
    method: 'POST',
    token: customer.accessToken,
    body: { documentKind: 'identity_front', fileName: 'passport.pdf', storageKey: 'vault://passport', mimeType: 'application/pdf' }
  });
  await apiFetch('/api/kyc/submit', { method: 'POST', token: customer.accessToken });
  await apiFetch(`/api/admin/kyc/${customer.user.id}/review`, {
    method: 'PATCH',
    token: reviewer.accessToken,
    body: { status: 'kyc_approuve', justification: 'Import autorisé après revue conformité' }
  });

  const accepted = await apiFetch('/api/import-requests', {
    method: 'POST',
    token: customer.accessToken,
    body: { sourceUrl: 'https://example.test/produit', description: 'Produit de test très détaillé', targetQty: 2 }
  });
  assert.equal(accepted.response.status, 201);
});
