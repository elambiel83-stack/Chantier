const crypto = require('crypto');

// Secrets par tenant (identifiants de paiement — voir tenant_settings dans schema.sql):
// chiffrés au repos avec AES-256-GCM plutôt que stockés en clair, pour qu'un accès direct
// à la base ne suffise pas à les lire. La clé ne vit que dans l'environnement du process
// (jamais en base, jamais commitée) — voir TENANT_SECRETS_ENCRYPTION_KEY dans .env.example.
function getEncryptionKey() {
  const raw = process.env.TENANT_SECRETS_ENCRYPTION_KEY;
  if (!raw) throw Object.assign(new Error('TENANT_SECRETS_ENCRYPTION_KEY doit être défini pour chiffrer/déchiffrer un secret de tenant'), { code: 'ENCRYPTION_KEY_MISSING' });
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw Object.assign(new Error('TENANT_SECRETS_ENCRYPTION_KEY doit décoder (base64) vers exactement 32 octets'), { code: 'ENCRYPTION_KEY_INVALID' });
  return key;
}

// Un seul BYTEA par secret (iv 12 octets + tag d'authentification 16 octets + texte
// chiffré, concaténés) plutôt que trois colonnes séparées à tenir synchronisées.
function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decryptSecret(blob) {
  if (!blob) return null;
  const key = getEncryptionKey();
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret, getEncryptionKey };
