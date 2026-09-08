const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Vérifie un jeton d'identité OIDC (Google/Apple) contre les clés publiques du
// fournisseur: seule la signature fait foi, jamais ce qu'un client prétend en plus.
function createOidcVerifier(jwksUri) {
  const client = jwksClient({ jwksUri, cache: true, rateLimit: true });
  return function verifyIdToken(token, { issuer, audiences }) {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          client.getSigningKey(header.kid, (error, key) => {
            if (error) return callback(error);
            callback(null, key.getPublicKey());
          });
        },
        { algorithms: ['RS256'], issuer },
        (error, payload) => {
          if (error) return reject(error);
          if (!audiences.includes(payload.aud)) return reject(new Error('Audience du jeton non reconnue'));
          resolve(payload);
        }
      );
    });
  };
}

function isOidcTokenError(error) {
  return error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError' || error.message === 'Audience du jeton non reconnue';
}

module.exports = { createOidcVerifier, isOidcTokenError };
