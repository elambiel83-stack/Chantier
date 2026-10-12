const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const jwt = require('jsonwebtoken');
const SECRET = 'local-security-test-secret-with-at-least-32-characters';
const roles = ['customer', 'customer', 'staff', 'staff', 'admin', 'vendor', 'accountant', 'customer', 'site_manager', 'supplier', 'carrier', 'driver', 'support'];
const id = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let server, base, logs = '';

before(async () => {
  const port = await new Promise(resolve => {
    const socket = net.createServer().listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(__dirname, 'helpers/security-server.cjs')], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DATABASE_URL: 'local-test-adapter',
      JWT_ACCESS_SECRET: SECRET, CORS_ORIGIN: base, TRUST_PROXY: 'false', SENTRY_DSN: '',
      RESEND_API_KEY: '', TURNSTILE_SECRET_KEY: '', AFRICASTALKING_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Security fixture exited: ${logs}`);
    try { if ((await fetch(base + '/healthz')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Security fixture startup timeout: ${logs}`);
});
after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await exited;
  }
});

async function request(actor, route, claimedRole) {
  const headers = {};
  if (actor) headers.authorization = 'Bearer ' + jwt.sign({ sub: id('1', actor), role: claimedRole || roles[actor - 1] },
    SECRET, { expiresIn: '5m', issuer: 'monchantier-api', audience: 'monchantier-web' });
  const response = await fetch(base + route, { headers });
  return { status: response.status, body: await response.json() };
}

test('vendor and accountant cannot read general orders, order details or import requests', async () => {
  for (const actor of [6, 7]) {
    for (const route of ['/api/orders', `/api/orders/${id('2', 1)}`, '/api/import-requests']) {
      assert.equal((await request(actor, route)).status, 403, `actor ${actor}: ${route}`);
    }
  }
});

test('customers only read their own orders and imports; internal notes stay private', async () => {
  const orders = await request(1, '/api/orders');
  assert.equal(orders.status, 200);
  assert.deepEqual(orders.body.orders.map(order => order.id), [id('2', 1)]);
  assert.equal((await request(1, `/api/orders/${id('2', 1)}`)).status, 200);
  assert.equal((await request(1, `/api/orders/${id('2', 2)}`)).status, 404);
  const imports = await request(1, '/api/import-requests');
  assert.equal(imports.status, 200);
  assert.deepEqual(imports.body.requests.map(item => item.id), [id('3', 1)]);
  assert.equal(Object.hasOwn(imports.body.requests[0], 'staff_notes'), false);
});

test('staff scope remains assigned or available; administrators can inspect all records', async () => {
  for (const [route, field, prefix] of [['/api/orders', 'orders', '2'], ['/api/import-requests', 'requests', '3']]) {
    const staff = await request(3, route);
    assert.equal(staff.status, 200);
    assert.deepEqual(staff.body[field].map(item => item.id).sort(), [id(prefix, 1), id(prefix, 3)]);
    const admin = await request(5, route);
    assert.equal(admin.status, 200);
    assert.equal(admin.body[field].length, 3);
  }
  assert.equal((await request(3, `/api/orders/${id('2', 2)}`)).status, 404);
  const imports = await request(5, '/api/import-requests');
  assert.ok(imports.body.requests.every(item => item.staff_notes === 'Internal synthetic note'));
});

test('claimed JWT role cannot override database role; inactive and anonymous accounts are rejected', async () => {
  assert.equal((await request(6, '/api/import-requests', 'admin')).status, 403);
  const forged = await request(1, '/api/orders', 'admin');
  assert.equal(forged.status, 200);
  assert.equal(forged.body.orders.length, 1);
  assert.equal((await request(8, '/api/orders')).status, 401);
  assert.equal((await request(null, '/api/import-requests')).status, 401);
});

test('accountant keeps accounting access; compliance module starts and enforces admin-only access', async () => {
  assert.equal((await request(7, '/api/accounting/summary')).status, 200);
  assert.equal((await request(1, '/api/accounting/summary')).status, 403);
  for (const route of ['/api/compliance', '/api/compliance/documents', '/api/compliance/events']) {
    assert.equal((await request(5, route)).status, 200);
    assert.equal((await request(7, route)).status, 403);
  }
});

test('specialized roles cannot cross privilege boundaries', async () => {
  // site_manager, supplier, carrier, driver and support must never inherit admin/accounting/compliance/catalog powers.
  for (const actor of [9, 10, 11, 12, 13]) {
    assert.equal((await request(actor, '/api/accounting/summary')).status, 403);
    assert.equal((await request(actor, '/api/compliance')).status, 403);
    assert.equal((await request(actor, '/api/admin/catalog')).status, 403);
  }
  // Supplier/carrier do not gain access to the global order or import back office.
  for (const actor of [10, 11]) {
    assert.equal((await request(actor, '/api/orders')).status, 403);
    assert.equal((await request(actor, '/api/import-requests')).status, 403);
  }
});

test('specialized operational roles receive only their natural read scopes', async () => {
  // Site managers and drivers may inspect operational orders, but the fixture assigns none to them.
  for (const actor of [9, 12]) {
    const orders = await request(actor, '/api/orders');
    assert.equal(orders.status, 200);
    assert.deepEqual(orders.body.orders, []);
  }
  // Only site management, not drivers/support, participates in import operations.
  assert.equal((await request(9, '/api/import-requests')).status, 200);
  assert.equal((await request(12, '/api/import-requests')).status, 403);
  assert.equal((await request(13, '/api/import-requests')).status, 403);
  // Support owns the ticket workspace; operational roles do not.
  assert.equal((await request(13, '/api/tickets')).status, 200);
  assert.equal((await request(9, '/api/tickets')).status, 403);
  assert.equal((await request(12, '/api/tickets')).status, 403);
  // Support never inherits order operations.
  assert.equal((await request(13, '/api/orders')).status, 403);
});
