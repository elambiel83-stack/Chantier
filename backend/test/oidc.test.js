// Teste la vérification de jeton d'identité OIDC (createOidcVerifier) sans dépendre de
// Google/Apple: sert un JWKS auto-signé en local et vérifie que seul un jeton valide,
// avec la bonne signature, le bon émetteur et la bonne audience, est accepté.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { createOidcVerifier } = require('../oidc');

const KID = 'test-key-1';
let server;
let baseUrl;
let privateKey;
let verify;

before(async () => {
  const { publicKey, privateKey: generatedPrivateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = generatedPrivateKey;
  const jwk = publicKey.export({ format: 'jwk' });

  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  verify = createOidcVerifier(`${baseUrl}/jwks.json`);
});

after(() => new Promise((resolve) => server.close(resolve)));

function sign(payload, options = {}) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid: KID,
    issuer: 'https://provider.example.test',
    audience: 'client-abc',
    expiresIn: '5m',
    ...options
  });
}

test('accepte un jeton valide (signature, émetteur, audience corrects)', async () => {
  const token = sign({ sub: 'user-1', email: 'user@example.test', email_verified: true });
  const payload = await verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc'] });
  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.email, 'user@example.test');
});

test('refuse un émetteur inattendu', async () => {
  const token = sign({ sub: 'user-1' }, { issuer: 'https://attacker.example.test' });
  await assert.rejects(() => verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc'] }));
});

test('refuse une audience non reconnue', async () => {
  const token = sign({ sub: 'user-1' }, { audience: 'client-inconnu' });
  await assert.rejects(
    () => verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc'] }),
    /Audience du jeton non reconnue/
  );
});

test('accepte l’audience quand elle fait partie des identifiants autorisés', async () => {
  const token = sign({ sub: 'user-1' }, { audience: 'client-mobile-ios' });
  const payload = await verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc', 'client-mobile-ios'] });
  assert.equal(payload.sub, 'user-1');
});

test('refuse un jeton expiré', async () => {
  const token = sign({ sub: 'user-1' }, { expiresIn: '-10s' });
  await assert.rejects(() => verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc'] }));
});

test('refuse un jeton dont la signature a été altérée', async () => {
  const token = sign({ sub: 'user-1' });
  const tampered = token.slice(0, -4) + (token.slice(-4) === 'aaaa' ? 'bbbb' : 'aaaa');
  await assert.rejects(() => verify(tampered, { issuer: 'https://provider.example.test', audiences: ['client-abc'] }));
});

test('refuse un jeton signé par une autre clé (kid inconnu)', async () => {
  const otherKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const token = jwt.sign({ sub: 'user-1' }, otherKeyPair.privateKey, {
    algorithm: 'RS256',
    keyid: 'autre-cle',
    issuer: 'https://provider.example.test',
    audience: 'client-abc',
    expiresIn: '5m'
  });
  await assert.rejects(() => verify(token, { issuer: 'https://provider.example.test', audiences: ['client-abc'] }));
});
