// Normalize field names once, so camelCase, underscores and header casing agree.
const normalize = key => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const sensitiveFields = new Set([
  'password', 'confirmPassword', 'passwordHash', 'idToken', 'identityToken',
  'accessToken', 'refreshToken', 'token', 'code', 'codeHash', 'otp',
  'authorization', 'cookie', 'set-cookie', 'cf-turnstile-response',
  'apiKey', 'x-api-key', 'clientSecret'
].map(normalize));
const FILTERED = '[Filtered]';

function scrubSensitiveData(value) {
  if (Array.isArray(value)) return value.map(scrubSensitiveData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, sensitiveFields.has(normalize(key)) ? FILTERED : scrubSensitiveData(item)
    ]));
  }
  return value;
}

function scrubSentryEvent(event) {
  const clean = scrubSensitiveData(event);
  // Sentry may supply an already serialized request body. Keep only parseable
  // JSON after redaction; discard other bodies rather than forward credentials.
  if (typeof clean.request?.data === 'string') {
    try {
      clean.request.data = JSON.stringify(scrubSensitiveData(JSON.parse(clean.request.data)));
    } catch {
      clean.request.data = FILTERED;
    }
  }
  return clean;
}

module.exports = { scrubSensitiveData, scrubSentryEvent };
