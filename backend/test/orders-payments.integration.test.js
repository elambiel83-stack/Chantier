const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'chantier_test'}`;
const HAS_DATABASE = Boolean(process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE);

if (!HAS_DATABASE) {
  test('integration tests require DATABASE_URL', { skip: true }, () => {});
} else {
  const PORT = 4101;
  const PROVIDER_PORT = 4102;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const PROVIDER_URL = `http://127.0.0.1:${PROVIDER_PORT}`;
  const JWT_ACCESS_SECRET = 'test-secret-at-least-32-characters-long';
  const schemaSql = require('node:fs').readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

  let server;
  let provider;
  let pool;
  let sequence = 0;
  let mockState;

  function resetMockState() {
    mockState = {
      paypalCreateCount: 0,
      paypalOrders: new Map(),
      paypalCaptureMode: 'success',
      cinetpayTransactions: new Map()
    };
  }

  function jsonResponse(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  }

  async function readFormBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  }

  async function startProviderServer() {
    provider = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/paypal/v1/oauth2/token') {
        return jsonResponse(res, 200, { access_token: 'mock-paypal-access-token' });
      }
      if (req.method === 'POST' && req.url === '/paypal/v2/checkout/orders') {
        const body = await readJsonBody(req);
        const orderId = `paypal-order-${++mockState.paypalCreateCount}`;
        mockState.paypalOrders.set(orderId, {
          amount: body.purchase_units?.[0]?.amount?.value,
          currency: body.purchase_units?.[0]?.amount?.currency_code
        });
        return jsonResponse(res, 200, {
          id: orderId,
          links: [{ rel: 'approve', href: `https://example.test/paypal/${orderId}` }]
        });
      }
      if (req.method === 'POST' && req.url.startsWith('/paypal/v2/checkout/orders/')) {
        const orderId = req.url.split('/')[5];
        const expected = mockState.paypalOrders.get(orderId);
        if (!expected) return jsonResponse(res, 404, { error: 'unknown_order' });
        const amount = mockState.paypalCaptureMode === 'mismatch'
          ? (Number(expected.amount) + 1).toFixed(2)
          : expected.amount;
        return jsonResponse(res, 200, {
          status: 'COMPLETED',
          purchase_units: [{ payments: { captures: [{ amount: { currency_code: expected.currency, value: amount } }] } }]
        });
      }
      if (req.method === 'POST' && req.url === '/cinetpay/v2/payment') {
        const body = await readJsonBody(req);
        mockState.cinetpayTransactions.set(body.transaction_id, {
          amount: String(body.amount),
          currency: body.currency,
          responses: [{ code: '00', data: { status: 'ACCEPTED', amount: String(body.amount), currency: body.currency } }]
        });
        return jsonResponse(res, 200, {
          code: '201',
          data: { payment_url: `https://example.test/cinetpay/${body.transaction_id}` }
        });
      }
      if (req.method === 'POST' && req.url === '/cinetpay/v2/payment/check') {
        const body = await readJsonBody(req);
        const transaction = mockState.cinetpayTransactions.get(body.transaction_id);
        if (!transaction) return jsonResponse(res, 404, { code: '404', data: { status: 'NOT_FOUND' } });
        const response = transaction.responses.length > 1 ? transaction.responses.shift() : transaction.responses[0];
        return jsonResponse(res, 200, response);
      }
      res.writeHead(404).end();
    });
    await new Promise((resolve) => provider.listen(PROVIDER_PORT, '127.0.0.1', resolve));
  }

  async function waitFor(fn, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await fn()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out');
  }

  async function startBackendServer() {
    server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET,
        DATABASE_URL,
        CORS_ORIGIN: BASE_URL,
        APP_URL: BASE_URL,
        PAYPAL_CLIENT_ID: 'paypal-client',
        PAYPAL_CLIENT_SECRET: 'paypal-secret',
        PAYPAL_API_BASE: `${PROVIDER_URL}/paypal`,
        CINETPAY_API_BASE: `${PROVIDER_URL}/cinetpay`,
        CINETPAY_API_KEY: 'cinetpay-key',
        CINETPAY_SITE_ID: 'cinetpay-site',
        ORDER_RESERVATION_SWEEP_MS: '50'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.on('data', () => {});
    await waitFor(async () => {
      try {
        const response = await fetch(`${BASE_URL}/healthz`);
        return response.ok;
      } catch {
        return false;
      }
    });
  }

  async function apiFetch(endpoint, { method = 'GET', token, body, headers } = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  async function registerUser(role = 'customer') {
    sequence += 1;
    const registration = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: `user${sequence}@example.test`,
        password: 'password-super-securise',
        fullName: `User ${sequence}`,
        phone: `+243000000${String(sequence).padStart(3, '0')}`
      }
    });
    assert.equal(registration.response.status, 201);
    if (role !== 'customer') {
      await pool.query('UPDATE user_account SET role = $1, updated_at = now() WHERE id = $2', [role, registration.payload.user.id]);
    }
    return registration.payload;
  }

  async function createOrder(accessToken, { qty = 1, paymentProvider = 'paypal', currency = 'USD', productId = 'CIM-001' } = {}) {
    const result = await apiFetch('/api/orders', {
      method: 'POST',
      token: accessToken,
      body: {
        customer: { fullName: 'Client Test', phone: '+243999999999', email: 'client@example.test' },
        currency,
        paymentProvider,
        items: [{ id: productId, qty }]
      }
    });
    return result;
  }

  async function fetchOrderAndPayment(orderId) {
    const result = await pool.query(
      `SELECT orders.status AS order_status, orders.reservation_expires_at, payment.status AS payment_status, payment.provider_reference
       FROM orders JOIN payment ON payment.order_id = orders.id
       WHERE orders.id = $1`,
      [orderId]
    );
    return result.rows[0];
  }

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
    await pool.query(schemaSql);
    resetMockState();
    await startProviderServer();
    await startBackendServer();
    await waitFor(async () => Number((await pool.query('SELECT COUNT(*) AS count FROM product')).rows[0].count) > 0);
  });

  beforeEach(async () => {
    resetMockState();
    await pool.query('TRUNCATE TABLE payment, order_item, orders, refresh_token, verification_code, user_account, customer RESTART IDENTITY CASCADE');
    await pool.query('UPDATE product SET stock_qty = 1000');
  });

  after(async () => {
    server?.kill();
    await new Promise((resolve) => provider?.close(resolve));
    await pool?.end();
  });

  test('deux commandes concurrentes ne vendent pas deux fois le dernier stock', async () => {
    await pool.query("UPDATE product SET stock_qty = 1 WHERE id = 'CIM-001'");
    const userA = await registerUser();
    const userB = await registerUser();

    const [first, second] = await Promise.all([
      createOrder(userA.accessToken),
      createOrder(userB.accessToken)
    ]);
    const statuses = [first.response.status, second.response.status].sort();

    assert.deepEqual(statuses, [201, 409]);
    assert.equal(Number((await pool.query("SELECT stock_qty FROM product WHERE id = 'CIM-001'")).rows[0].stock_qty), 0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'")).rows[0].count), 1);
  });

  test('une réservation expirée annule la commande et restitue exactement le stock', async () => {
    await pool.query("UPDATE product SET stock_qty = 3 WHERE id = 'CIM-001'");
    const user = await registerUser();
    const orderResult = await createOrder(user.accessToken, { qty: 2 });
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    assert.equal(Number((await pool.query("SELECT stock_qty FROM product WHERE id = 'CIM-001'")).rows[0].stock_qty), 1);
    await pool.query("UPDATE orders SET reservation_expires_at = now() - interval '1 second' WHERE id = $1", [orderId]);

    await waitFor(async () => {
      const current = await fetchOrderAndPayment(orderId);
      return current?.order_status === 'cancelled' && current?.payment_status === 'cancelled';
    });

    assert.equal(Number((await pool.query("SELECT stock_qty FROM product WHERE id = 'CIM-001'")).rows[0].stock_qty), 3);
  });

  test('une annulation explicite restitue exactement le stock réservé', async () => {
    await pool.query("UPDATE product SET stock_qty = 5 WHERE id = 'CIM-001'");
    const customer = await registerUser();
    const admin = await registerUser('admin');
    const orderResult = await createOrder(customer.accessToken, { qty: 2 });
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    const cancelResult = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { status: 'cancelled' }
    });

    assert.equal(cancelResult.response.status, 200);
    const current = await fetchOrderAndPayment(orderId);
    assert.equal(current.order_status, 'cancelled');
    assert.equal(current.payment_status, 'cancelled');
    assert.equal(Number((await pool.query("SELECT stock_qty FROM product WHERE id = 'CIM-001'")).rows[0].stock_qty), 5);
  });

  test('la capture PayPal répétée reste idempotente', async () => {
    const user = await registerUser();
    const orderResult = await createOrder(user.accessToken);
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    const initResult = await apiFetch(`/api/orders/${orderId}/paypal`, { method: 'POST', token: user.accessToken });
    assert.equal(initResult.response.status, 200);

    const firstCapture = await apiFetch(`/api/orders/${orderId}/paypal/capture`, {
      method: 'POST',
      body: { confirmationToken: initResult.payload.confirmationToken }
    });
    const secondCapture = await apiFetch(`/api/orders/${orderId}/paypal/capture`, {
      method: 'POST',
      body: { confirmationToken: initResult.payload.confirmationToken }
    });

    assert.equal(firstCapture.response.status, 200);
    assert.equal(secondCapture.response.status, 200);
    assert.equal(firstCapture.payload.status, 'confirmed');
    assert.equal(secondCapture.payload.status, 'confirmed');

    const current = await fetchOrderAndPayment(orderId);
    assert.equal(current.order_status, 'confirmed');
    assert.equal(current.payment_status, 'paid');
    assert.equal(current.reservation_expires_at, null);
  });

  test('un montant PayPal incohérent ne confirme pas la commande', async () => {
    mockState.paypalCaptureMode = 'mismatch';
    const user = await registerUser();
    const orderResult = await createOrder(user.accessToken);
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    const initResult = await apiFetch(`/api/orders/${orderId}/paypal`, { method: 'POST', token: user.accessToken });
    assert.equal(initResult.response.status, 200);

    const captureResult = await apiFetch(`/api/orders/${orderId}/paypal/capture`, {
      method: 'POST',
      body: { confirmationToken: initResult.payload.confirmationToken }
    });

    assert.equal(captureResult.response.status, 400);
    const current = await fetchOrderAndPayment(orderId);
    assert.equal(current.order_status, 'pending');
    assert.equal(current.payment_status, 'pending');
  });

  test('les callbacks CinetPay répétés produisent le même état final', async () => {
    const user = await registerUser();
    const orderResult = await createOrder(user.accessToken, { paymentProvider: 'cinetpay' });
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    const initResult = await apiFetch(`/api/orders/${orderId}/cinetpay`, { method: 'POST', token: user.accessToken });
    assert.equal(initResult.response.status, 200);

    const transactionId = (await fetchOrderAndPayment(orderId)).provider_reference;
    const notify = async () => fetch(`${BASE_URL}/api/cinetpay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ cpm_trans_id: transactionId }).toString()
    });

    const first = await notify();
    const second = await notify();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const current = await fetchOrderAndPayment(orderId);
    assert.equal(current.order_status, 'confirmed');
    assert.equal(current.payment_status, 'paid');
  });

  test('CinetPay peut rester pending puis passer à paid sans doublon', async () => {
    const user = await registerUser();
    const orderResult = await createOrder(user.accessToken, { paymentProvider: 'cinetpay' });
    assert.equal(orderResult.response.status, 201);

    const orderId = orderResult.payload.order.id;
    const initResult = await apiFetch(`/api/orders/${orderId}/cinetpay`, { method: 'POST', token: user.accessToken });
    assert.equal(initResult.response.status, 200);

    const transactionId = (await fetchOrderAndPayment(orderId)).provider_reference;
    const transaction = mockState.cinetpayTransactions.get(transactionId);
    transaction.responses = [
      { code: '609', data: { status: 'WAITING_FOR_CUSTOMER' } },
      { code: '00', data: { status: 'ACCEPTED', amount: transaction.amount, currency: transaction.currency } }
    ];

    const pendingCheck = await apiFetch(`/api/orders/${orderId}/cinetpay/check`, {
      method: 'POST',
      body: { confirmationToken: initResult.payload.confirmationToken }
    });
    assert.equal(pendingCheck.response.status, 200);
    assert.equal(pendingCheck.payload.status, 'pending');

    const paidCheck = await apiFetch(`/api/orders/${orderId}/cinetpay/check`, {
      method: 'POST',
      body: { confirmationToken: initResult.payload.confirmationToken }
    });
    assert.equal(paidCheck.response.status, 200);
    assert.equal(paidCheck.payload.status, 'confirmed');

    const current = await fetchOrderAndPayment(orderId);
    assert.equal(current.order_status, 'confirmed');
    assert.equal(current.payment_status, 'paid');
  });

  test('un refresh token ne peut pas être utilisé deux fois', async () => {
    const user = await registerUser();

    const firstRefresh = await apiFetch('/api/auth/refresh', {
      method: 'POST',
      body: { token: user.refreshToken }
    });
    const secondRefresh = await apiFetch('/api/auth/refresh', {
      method: 'POST',
      body: { token: user.refreshToken }
    });

    assert.equal(firstRefresh.response.status, 200);
    assert.equal(secondRefresh.response.status, 401);
  });

  test('une transition illégale de statut est refusée', async () => {
    const customer = await registerUser();
    const admin = await registerUser('admin');
    const orderResult = await createOrder(customer.accessToken);
    assert.equal(orderResult.response.status, 201);

    const illegalTransition = await apiFetch(`/api/orders/${orderResult.payload.order.id}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { status: 'completed' }
    });

    assert.equal(illegalTransition.response.status, 409);
  });
}
