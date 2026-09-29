// Teste secrets.js isolément: le chiffrement doit être réversible avec la bonne clé,
// refuser explicitement sans clé configurée (plutôt qu'échouer silencieusement), et
// jamais renvoyer un blob exploitable sans la clé.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
});

function freshSecrets() {
  delete require.cache[require.resolve('../secrets')];
  return require('../secrets');
}

test('chiffre puis déchiffre: retrouve exactement le texte original', () => {
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const { encryptSecret, decryptSecret } = freshSecrets();
  const blob = encryptSecret('sk_live_super-secret-paypal-key');
  assert.ok(Buffer.isBuffer(blob));
  assert.equal(decryptSecret(blob), 'sk_live_super-secret-paypal-key');
});

test('deux chiffrements du même texte produisent des blobs différents (iv aléatoire)', () => {
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const { encryptSecret } = freshSecrets();
  const a = encryptSecret('même-secret');
  const b = encryptSecret('même-secret');
  assert.notEqual(a.toString('hex'), b.toString('hex'));
});

test('valeur vide ou absente: encryptSecret renvoie null sans exiger de clé', () => {
  delete process.env.TENANT_SECRETS_ENCRYPTION_KEY;
  const { encryptSecret, decryptSecret } = freshSecrets();
  assert.equal(encryptSecret(''), null);
  assert.equal(encryptSecret(null), null);
  assert.equal(encryptSecret(undefined), null);
  assert.equal(decryptSecret(null), null);
});

test('TENANT_SECRETS_ENCRYPTION_KEY absent: chiffrer un secret réel échoue explicitement', () => {
  delete process.env.TENANT_SECRETS_ENCRYPTION_KEY;
  const { encryptSecret } = freshSecrets();
  assert.throws(() => encryptSecret('un-secret'), /TENANT_SECRETS_ENCRYPTION_KEY/);
});

test('clé mal formée (pas 32 octets une fois décodée): échoue explicitement', () => {
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = Buffer.from('trop-courte').toString('base64');
  const { encryptSecret } = freshSecrets();
  assert.throws(() => encryptSecret('un-secret'), /32 octets/);
});

test('déchiffrer avec la mauvaise clé échoue plutôt que de renvoyer un texte corrompu', () => {
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const { encryptSecret } = freshSecrets();
  const blob = encryptSecret('secret-original');
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const { decryptSecret } = freshSecrets();
  assert.throws(() => decryptSecret(blob));
});
