// Synthetic, local PostgreSQL engine for end-to-end route authorization tests.
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
  const roles = ['customer', 'customer', 'staff', 'staff', 'admin', 'vendor', 'accountant', 'customer'];
  for (let i = 1; i <= roles.length; i++) {
    const suffix = String(i).padStart(12, '0');
    const customerId = `00000000-0000-4000-8000-${suffix}`;
    const userId = `10000000-0000-4000-8000-${suffix}`;
    await pg.query('INSERT INTO customer(id,full_name,phone) VALUES($1,$2,$3)', [customerId, `Synthetic ${i}`, `test-${i}`]);
    await pg.query('INSERT INTO user_account(id,customer_id,email,role,is_active) VALUES($1,$2,$3,$4,$5)',
      [userId, customerId, `security-${i}@example.invalid`, roles[i - 1], i !== 8]);
  }
  for (let i = 1; i <= 3; i++) {
    const suffix = String(i).padStart(12, '0');
    const customerId = `00000000-0000-4000-8000-${String(i === 1 ? 1 : 2).padStart(12, '0')}`;
    const staff = i === 3 ? null : `10000000-0000-4000-8000-${String(i === 1 ? 3 : 4).padStart(12, '0')}`;
    await pg.query('INSERT INTO orders(id,customer_id,status,assigned_to,delivery_latitude,delivery_longitude) VALUES($1,$2,$3,$4,-10,25)',
      [`20000000-0000-4000-8000-${suffix}`, customerId, 'confirmed', staff]);
    await pg.query('INSERT INTO import_request(id,customer_id,description,target_qty,assigned_to,staff_notes) VALUES($1,$2,$3,1,$4,$5)',
      [`30000000-0000-4000-8000-${suffix}`, customerId, `Synthetic import ${i}`, staff, 'Internal synthetic note']);
  }
  let queue = Promise.resolve();
  async function lock() {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  }
  const query = async (sql, params = []) => {
    const result = await pg.query(sql, params);
    return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  require('pg').Pool = class {
    async query(sql, params) { const release = await lock(); try { return await query(sql, params); } finally { release(); } }
    async connect() { const release = await lock(); return { query, release }; }
    async end() { await pg.close(); }
  };
  require('../../server');
})().catch(error => { console.error(error); process.exit(1); });
