const test = require('node:test');
const assert = require('node:assert/strict');
const { scrubSensitiveData, scrubSentryEvent } = require('../securityRedaction');

test('redacts nested OAuth, OTP and session credentials regardless of key spelling', () => {
  const data = { fullName: 'Synthetic user', idToken: 'dummy-id', identityToken: 'dummy-identity',
    accessToken: 'dummy-access', refresh_token: 'dummy-refresh', confirmPassword: 'dummy-pass',
    nested: [{ Authorization: 'Bearer dummy', code_hash: 'dummy-code', clientSecret: 'dummy-secret' }] };
  const clean = scrubSensitiveData(data);
  for (const key of ['idToken', 'identityToken', 'accessToken', 'refresh_token', 'confirmPassword']) {
    assert.equal(clean[key], '[Filtered]');
  }
  assert.deepEqual(clean.nested, [{ Authorization: '[Filtered]', code_hash: '[Filtered]', clientSecret: '[Filtered]' }]);
  assert.equal(clean.fullName, 'Synthetic user');
  assert.equal(data.idToken, 'dummy-id');
});

test('redacts request headers, serialized JSON bodies, extra and context data', () => {
  const clean = scrubSentryEvent({ request: { headers: { AUTHORIZATION: 'dummy', Cookie: 'dummy', 'X-Api-Key': 'dummy' },
    data: JSON.stringify({ identityToken: 'dummy', nested: { access_token: 'dummy' }, quantity: 2 }) },
    extra: { refreshToken: 'dummy' }, contexts: { auth: { code: 'dummy' } } });
  assert.equal(clean.request.headers.AUTHORIZATION, '[Filtered]');
  assert.equal(clean.request.headers.Cookie, '[Filtered]');
  assert.equal(clean.request.headers['X-Api-Key'], '[Filtered]');
  assert.deepEqual(JSON.parse(clean.request.data), { identityToken: '[Filtered]', nested: { access_token: '[Filtered]' }, quantity: 2 });
  assert.equal(clean.extra.refreshToken, '[Filtered]');
  assert.equal(clean.contexts.auth.code, '[Filtered]');
});

test('drops opaque bodies and handles events without request data', () => {
  assert.equal(scrubSentryEvent({ request: { data: 'password=dummy&token=dummy' } }).request.data, '[Filtered]');
  assert.deepEqual(scrubSentryEvent({ message: 'safe event' }), { message: 'safe event' });
});
