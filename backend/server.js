const Sentry = require('@sentry/node');
const express = require('express');
const path = require('path');
const argon2 = require('argon2');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { Pool } = require('pg');
const { createOidcVerifier, isOidcTokenError } = require('./oidc');
const { sendEmail, sendSms, sendWhatsApp, channelAvailability } = require('./notifications');
const { verifyTurnstileToken } = require('./turnstile');
require('dotenv').config();

// Champs qui ne doivent jamais atteindre Sentry, quelle que soit la route: mots de passe,
// jetons, codes de vérification. Sentry capture le corps/les en-têtes de la requête en
// cas d'erreur (Sentry.setupExpressErrorHandler) — sans ce filtre, une erreur survenant
// pendant un login enverrait le mot de passe en clair à un tiers.
const SENSITIVE_FIELDS = ['password', 'idToken', 'identityToken', 'accessToken', 'refreshToken', 'token', 'code', 'authorization', 'cookie', 'cf-turnstile-response'];
function scrubSensitiveData(value) {
  if (Array.isArray(value)) return value.map(scrubSensitiveData);
  if (value && typeof value === 'object') {
    const scrubbed = {};
    for (const [key, val] of Object.entries(value)) {
      scrubbed[key] = SENSITIVE_FIELDS.includes(key.toLowerCase()) ? '[Filtered]' : scrubSensitiveData(val);
    }
    return scrubbed;
  }
  return value;
}
// Sans SENTRY_DSN, Sentry.init n'est pas appelé: captureException reste un no-op sûr
// (voir captureError plus bas), donc rien d'autre à garder conditionnel.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Défense en profondeur: en plus du filtre ci-dessus sur nos propres appels,
    // corrige aussi ce que l'intégration Express capture automatiquement (corps et
    // en-têtes de requête) avant tout envoi à Sentry.
    beforeSend(event) {
      if (event.request?.data) event.request.data = scrubSensitiveData(event.request.data);
      if (event.request?.headers?.authorization) event.request.headers.authorization = '[Filtered]';
      if (event.request?.headers?.cookie) event.request.headers.cookie = '[Filtered]';
      return event;
    }
  });
}

function captureError(error) {
  console.error(error instanceof Error ? error.stack : error);
  if (process.env.SENTRY_DSN) Sentry.captureException(error);
}

// Événements de sécurité qui ne sont pas des erreurs applicatives (donc jamais levés en
// exception) mais qu'on veut pouvoir repérer dans Sentry: CAPTCHA refusé, brute-force sur
// un code de vérification, quota d'API dépassé...
function captureSecurityEvent(message, extra) {
  console.warn(`[sécurité] ${message}`, extra || '');
  if (process.env.SENTRY_DSN) Sentry.captureMessage(message, { level: 'warning', extra: scrubSensitiveData(extra || {}) });
}

const app = express();
// Nombre de proxys de confiance devant l'app (reverse proxy, load balancer...).
// Sans ça, express-rate-limit et req.ip se basent sur la connexion TCP brute
// (l'IP du proxy, partagée par tous les clients) plutôt que sur X-Forwarded-For.
// Valeurs possibles: un nombre de sauts (ex. 1), true/false, ou un mot-clé
// Express ('loopback', 'uniquelocal', une liste d'IP/CIDR...).
function parseTrustProxy(value) {
  if (value === undefined) return 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3002,http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// En Codespaces, les ports sont exposés sur https://<codespace>-<port>.app.github.dev:
// on autorise les origines de ce codespace sans avoir à les lister à la main.
const codespaceOriginPattern = process.env.CODESPACE_NAME
  ? new RegExp(`^https://${process.env.CODESPACE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.${(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev').replace(/\./g, '\\.')}$`)
  : null;
const WEB_DIR = path.join(__dirname, '..', 'web');
const database = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false })
  : null;
const JWT_ISSUER = process.env.JWT_ISSUER || 'monchantier-api';
const FALLBACK_CURRENCY_RATES = { USD: 1, CDF: 2800, EUR: 0.92 };
// Airtel Money et Orange Money n'ont pas d'API de collecte automatisée branchée ici: le
// client envoie le paiement à ce numéro marchand avec la référence de commande, et le
// staff confirme manuellement (PATCH /api/orders/:orderId/status) après vérification.
const MOBILE_MONEY_PROVIDERS = {
  airtel_money: { label: 'Airtel Money', payoutNumber: process.env.AIRTEL_MONEY_PAYOUT_NUMBER },
  orange_money: { label: 'Orange Money', payoutNumber: process.env.ORANGE_MONEY_PAYOUT_NUMBER }
};
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_DAYS = 30;

// Connexion Google/Apple: le client (web ou mobile) obtient un jeton d'identité
// directement du fournisseur puis nous l'envoie; on ne fait confiance qu'à ce que sa
// signature (vérifiée contre les clés publiques du fournisseur) atteste, jamais à ce que
// le client prétend en plus dans le corps de la requête. Voir oidc.js (testé isolément).
const verifyGoogleIdToken = createOidcVerifier('https://www.googleapis.com/oauth2/v3/certs');
const verifyAppleIdToken = createOidcVerifier('https://appleid.apple.com/auth/keys');
// Un identifiant par plateforme (web/iOS/Android) émet des jetons avec des audiences
// différentes pour un même fournisseur: toutes doivent être acceptées.
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
const APPLE_CLIENT_IDS = (process.env.APPLE_CLIENT_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (codespaceOriginPattern && codespaceOriginPattern.test(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Origine non autorisée par CORS'));
  }
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      // Le catalogue charge Tailwind par CDN et utilise des gestionnaires d'événements
      // inline; le CAPTCHA Cloudflare Turnstile s'affiche dans une iframe.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://challenges.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
      // connectSrc: le script Turnstile fait ses propres appels réseau vers Cloudflare
      // (pas seulement dans l'iframe déclarée par frameSrc).
      connectSrc: ["'self'", ...allowedOrigins, 'https://challenges.cloudflare.com'],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null })
    }
  }
}));
app.use(express.json({ limit: '100kb' }));

// Sonde de santé pour l'orchestrateur/monitoring: hors quota et hors authentification.
app.get('/healthz', async (req, res) => {
  if (!database) return res.json({ status: 'ok', database: 'disabled' });
  try {
    await database.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

// Le quota ne vise que l'API: une page web charge plusieurs fichiers et l'épuiserait.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(req, res) {
    captureSecurityEvent('Quota API dépassé', { path: req.path, ip: req.ip });
    res.status(429).json({ success: false, message: 'Trop de requêtes, réessayez plus tard' });
  }
}));
// Chaque envoi coûte de l'argent (SMS/WhatsApp) et peut harceler un numéro/e-mail: quota
// dédié, plus strict que le quota général de l'API.
const verificationSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Par compte plutôt que par IP: la route exige déjà requireAuthentication avant ce
  // middleware, req.auth est donc toujours renseigné ici.
  keyGenerator: (req) => req.auth.userId,
  handler(req, res) {
    captureSecurityEvent('Quota d’envoi de code de vérification dépassé', { userId: req.auth?.userId, ip: req.ip });
    res.status(429).json({ success: false, message: 'Trop de demandes de code, réessayez plus tard' });
  }
});

// La PWA est servie par le backend: même origine que l'API, donc ni CORS ni contenu mixte.
app.use(express.static(WEB_DIR, { extensions: ['html'] }));

// Base de données simulée pour les produits
const PRODUCTS = [
  { 
    id: "BRQ-001", 
    name_fr: "Brique en bloc ciment", 
    name_en: "Cement block brick", 
    unit: "pcs", 
    price: 0.45, 
    img: "https://images.unsplash.com/photo-1496247749665-49cf5b1022e9?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 10000
  },
  { 
    id: "SAB-001", 
    name_fr: "Sable concassé (m³)", 
    name_en: "Crushed sand (m³)", 
    unit: "m3", 
    price: 18.00, 
    img: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 500
  },
  { 
    id: "MOL-001", 
    name_fr: "Moellon", 
    name_en: "Rubble stone", 
    unit: "ton", 
    price: 22.00, 
    img: "https://images.unsplash.com/photo-1606761568499-6d2451b23c85?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 300
  },
  { 
    id: "PAV-001", 
    name_fr: "Pavé", 
    name_en: "Paver", 
    unit: "sqm", 
    price: 14.00, 
    img: "https://images.unsplash.com/photo-1599842055622-5b164b4a9490?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 2000
  },
  { 
    id: "CIM-001", 
    name_fr: "Ciment (sac 50kg)", 
    name_en: "Cement (50kg)", 
    unit: "bag", 
    price: 11.50, 
    img: "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 5000
  },
  { 
    id: "CAR-001", 
    name_fr: "Carreaux (m²)", 
    name_en: "Tiles (sqm)", 
    unit: "sqm", 
    price: 19.00, 
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 1500
  },
  // Services
  { 
    id: "SVC-001", 
    name_fr: "Livraison chantier", 
    name_en: "Site delivery", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1540580124-955e7160e54f?q=80&w=1200&auto=format&fit=crop", 
    category: "services",
    stock: 9999
  },
  { 
    id: "SVC-002", 
    name_fr: "Pose de pavés (m²)", 
    name_en: "Paver installation (sqm)", 
    unit: "sqm", 
    price: 5.00, 
    img: "https://images.unsplash.com/photo-1529429617124-0e7ac6d0c6f9?q=80&w=1200&auto=format&fit=crop", 
    category: "services",
    stock: 9999
  },
  // Facilitation
  { 
    id: "FAC-001", 
    name_fr: "Assistance achat", 
    name_en: "Purchase assistance", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=1200&auto=format&fit=crop", 
    category: "facilitation",
    stock: 9999
  },
  { 
    id: "FAC-002", 
    name_fr: "Conseil technique", 
    name_en: "Technical advice", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop", 
    category: "facilitation",
    stock: 9999
  },
  // Partenaires
  {
    id: "PAR-001",
    name_fr: "Transport partenaire chantier",
    name_en: "Partner site transport",
    unit: "service",
    price: 0.00,
    img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop",
    category: "partenaires",
    stock: 9999
  },
  {
    id: "PAR-002",
    name_fr: "Location d’équipement partenaire",
    name_en: "Partner equipment rental",
    unit: "service",
    price: 0.00,
    img: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=1200&auto=format&fit=crop",
    category: "partenaires",
    stock: 9999
  }
];

// Panier synchronisé entre appareils: stocké dans cart_item (table), rattaché au compte
// (voir GET/PUT/DELETE /api/cart plus bas). Un visiteur non connecté reste en local
// uniquement (localStorage/AsyncStorage côté client), rien à valider ici pour lui.
const cartItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(32),
    qty: z.number().int().min(1).max(10000)
  })).max(100)
});

const orderSchema = z.object({
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(254).optional()
  }),
  currency: z.enum(['USD', 'CDF', 'EUR']),
  paymentProvider: z.enum(['paypal', 'airtel_money', 'orange_money']),
  items: z.array(z.object({
    id: z.string().min(1).max(32),
    qty: z.number().int().min(1).max(10000)
  })).min(1).max(100),
  // Position de livraison optionnelle (bouton "Partager ma position" au moment de la commande).
  // Les deux doivent être fournies ensemble ou omises: une seule coordonnée est inexploitable.
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional()
}).refine(
  (data) => (data.deliveryLatitude === undefined) === (data.deliveryLongitude === undefined),
  { message: 'La latitude et la longitude de livraison doivent être fournies ensemble', path: ['deliveryLatitude'] }
);

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
  // Nom de champ imposé par le widget Turnstile lui-même (input caché qu'il injecte dans
  // le formulaire): le reprendre tel quel évite tout JS de mappage côté web. Absent si
  // TURNSTILE_SECRET_KEY n'est pas configuré côté serveur (voir verifyTurnstileToken).
  'cf-turnstile-response': z.string().max(2048).optional()
});
const registrationSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30)
});
const refreshTokenSchema = z.object({ token: z.string().min(32).max(512) });
const sendVerificationSchema = z.object({ channel: z.enum(['email', 'sms', 'whatsapp']) });
const confirmVerificationSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres attendu') });
const googleAuthSchema = z.object({ idToken: z.string().min(20).max(4096) });
// Le jeton d'identité Apple ne contient jamais le nom (Apple ne le fournit qu'une fois,
// hors jeton, lors de la toute première connexion): le client le transmet séparément.
const appleAuthSchema = z.object({
  identityToken: z.string().min(20).max(4096),
  fullName: z.string().trim().min(1).max(120).optional()
});
const paypalCaptureSchema = z.object({ confirmationToken: z.string().min(20).max(256) });
const orderStatusSchema = z.object({ status: z.enum(['confirmed', 'delivering', 'completed', 'cancelled']) });
const userRoleSchema = z.object({ role: z.enum(['customer', 'staff', 'admin']) });

function requireJwtSecret() {
  if (!JWT_ACCESS_SECRET || JWT_ACCESS_SECRET.length < 32) throw new Error('JWT_ACCESS_SECRET doit contenir au moins 32 caracteres');
}

function createAccessToken(account) {
  requireJwtSecret();
  return jwt.sign({ sub: account.id, role: account.role }, JWT_ACCESS_SECRET, {
    algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL, issuer: JWT_ISSUER, audience: 'monchantier-web'
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const hashRefreshToken = hashToken;

function tokensMatch(candidate, storedHash) {
  if (!storedHash) return false;
  const candidateHash = Buffer.from(hashToken(candidate));
  const expected = Buffer.from(storedHash);
  return candidateHash.length === expected.length && crypto.timingSafeEqual(candidateHash, expected);
}

async function createRefreshToken(client, userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await client.query('INSERT INTO refresh_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, hashRefreshToken(token), expiresAt]);
  return token;
}

// column: 'google_sub' ou 'apple_sub'. Retrouve le compte par cet identifiant stable;
// à défaut, le relie à un compte existant avec le même e-mail (fournisseur garantit cet
// e-mail vérifié); sinon crée le compte. Appelée à l'intérieur d'une transaction déjà
// ouverte par l'appelant.
async function findOrCreateSocialAccount(client, { column, sub, email, fullName }) {
  const bySub = await client.query(`SELECT id, role, is_active FROM user_account WHERE ${column} = $1`, [sub]);
  if (bySub.rowCount) return bySub.rows[0];
  if (email) {
    const byEmail = await client.query('SELECT id, role, is_active FROM user_account WHERE email = $1', [email]);
    if (byEmail.rowCount) {
      await client.query(`UPDATE user_account SET ${column} = $1, updated_at = now() WHERE id = $2`, [sub, byEmail.rows[0].id]);
      return byEmail.rows[0];
    }
  }
  if (!email) throw Object.assign(new Error('E-mail requis pour créer un compte'), { status: 400 });
  const customerResult = await client.query('INSERT INTO customer (full_name, email) VALUES ($1, $2) RETURNING id', [fullName || null, email]);
  const accountResult = await client.query(
    `INSERT INTO user_account (customer_id, email, ${column}) VALUES ($1, $2, $3) RETURNING id, role, is_active`,
    [customerResult.rows[0].id, email, sub]
  );
  return accountResult.rows[0];
}

async function requireAuthentication(req, res, next) {
  if (!requireDatabase(res)) return;
  const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ success: false, message: 'Authentification requise' });
  try {
    requireJwtSecret();
    const payload = jwt.verify(match[1], JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: 'monchantier-web' });
    const accountResult = await database.query('SELECT id, customer_id, role, is_active FROM user_account WHERE id = $1', [payload.sub]);
    const account = accountResult.rows[0];
    if (!account || !account.is_active) return res.status(401).json({ success: false, message: 'Session invalide ou compte desactive' });
    req.auth = { userId: account.id, customerId: account.customer_id, role: account.role };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Jeton d’authentification invalide ou expire' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) return res.status(403).json({ success: false, message: 'Droits insuffisants' });
    next();
  };
}

function requireDatabase(res) {
  if (database) return true;
  res.status(503).json({
    success: false,
    message: 'Le service de commande est temporairement indisponible'
  });
  return false;
}

// true si la requête peut continuer; répond déjà 403 sinon. Un no-op qui laisse toujours
// passer si TURNSTILE_SECRET_KEY n'est pas configuré (voir turnstile.js).
async function checkTurnstile(req, res, token) {
  const ok = await verifyTurnstileToken(token, req.ip);
  if (!ok) {
    captureSecurityEvent('CAPTCHA Turnstile refusé', { path: req.path, ip: req.ip });
    res.status(403).json({ success: false, message: 'Vérification anti-robot échouée, réessayez' });
  }
  return ok;
}

async function getPaypalAccessToken() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw Object.assign(new Error('PayPal n’est pas configuré'), { status: 503 });
  }

  const authorization = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!response.ok) throw new Error('Authentification PayPal refusée');
  return (await response.json()).access_token;
}

async function ensureCatalog(client) {
  for (const product of PRODUCTS) {
    // stock_qty n'est renseigné qu'à la création: le stock vit ensuite en base.
    await client.query(
      `INSERT INTO product (id, name_fr, name_en, unit, price_usd, image_url, category, stock_qty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name_fr = EXCLUDED.name_fr,
         name_en = EXCLUDED.name_en,
         unit = EXCLUDED.unit,
         price_usd = EXCLUDED.price_usd,
         image_url = EXCLUDED.image_url,
         category = EXCLUDED.category,
         stock_qty = COALESCE(product.stock_qty, EXCLUDED.stock_qty)`,
      [product.id, product.name_fr, product.name_en, product.unit, product.price, product.img, product.category, product.stock]
    );
  }
}

// Le catalogue n'est synchronisé qu'une fois, pas à chaque commande.
let catalogSync = null;
function syncCatalog() {
  if (!database) return Promise.resolve();
  if (!catalogSync) {
    catalogSync = (async () => {
      const client = await database.connect();
      try {
        await ensureCatalog(client);
      } finally {
        client.release();
      }
    })().catch((error) => {
      catalogSync = null;
      throw error;
    });
  }
  return catalogSync;
}

function mapProductRow(row) {
  return {
    id: row.id,
    name_fr: row.name_fr,
    name_en: row.name_en,
    unit: row.unit,
    price: Number(row.price_usd),
    img: row.image_url,
    category: row.category,
    stock: row.stock_qty === null ? 0 : Number(row.stock_qty)
  };
}

async function listCatalog({ category, search } = {}) {
  if (!database) {
    const searchLower = (search || '').toLowerCase();
    return PRODUCTS.filter((product) =>
      (!category || product.category === category) &&
      (!search ||
        product.name_fr.toLowerCase().includes(searchLower) ||
        product.name_en.toLowerCase().includes(searchLower) ||
        product.id.toLowerCase().includes(searchLower))
    );
  }
  await syncCatalog();
  const values = [];
  const filters = [];
  if (category) {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.toLowerCase().replace(/([\\%_])/g, '\\$1')}%`);
    const placeholder = `$${values.length}`;
    filters.push(`(lower(name_fr) LIKE ${placeholder} ESCAPE '\\' OR lower(name_en) LIKE ${placeholder} ESCAPE '\\' OR lower(id) LIKE ${placeholder} ESCAPE '\\')`);
  }
  const result = await database.query(
    `SELECT id, name_fr, name_en, unit, price_usd, image_url, category, stock_qty FROM product
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY id`,
    values
  );
  return result.rows.map(mapProductRow);
}

async function findProduct(id) {
  if (!database) return PRODUCTS.find((product) => product.id === id) || null;
  await syncCatalog();
  const result = await database.query(
    'SELECT id, name_fr, name_en, unit, price_usd, image_url, category, stock_qty FROM product WHERE id = $1',
    [id]
  );
  return result.rowCount ? mapProductRow(result.rows[0]) : null;
}

// Regroupe les quantités demandées par produit (un même id peut apparaître plusieurs fois).
function aggregateQuantities(items) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.qty);
  }
  return quantities;
}

// products: Map id -> ligne product (voir POST /api/orders, déjà chargée pour le décompte
// de stock — pas de requête supplémentaire ici). payment: instructions mobile money, ou
// undefined pour PayPal (le client règle ensuite via /orders/:id/paypal).
function sendOrderConfirmationEmail(to, order, quantities, products, payment) {
  const lines = [...quantities].map(([productId, qty]) => {
    const product = products.get(productId);
    return `- ${product.name_fr} (${product.id}) x${qty} ${product.unit}`;
  });
  const paymentInstructions = payment
    ? `Paiement : envoyez ${order.total_amount} ${order.currency} via ${payment.label} au ${payment.payoutNumber} en indiquant la référence ${payment.reference}. Votre commande sera confirmée après vérification du paiement.`
    : 'Paiement : finalisez le paiement PayPal pour confirmer la commande.';
  const text = `Merci pour votre commande MonChantier !

Référence : ${order.id}

Articles commandés :
${lines.join('\n')}

Total : ${order.total_amount} ${order.currency}

${paymentInstructions}

Vous pouvez suivre l'état de votre commande à tout moment depuis « Mes commandes » sur le site.`;
  return sendEmail(to, `Confirmation de votre commande MonChantier (${order.id.slice(0, 8)})`, text);
}

// Routes API

// Route de test
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API MonChantier',
    version: '1.0.0',
    endpoints: [
      'GET /api/products',
      'GET /api/products/:id',
      'GET /api/products/category/:category',
      'GET /api/currency-rates',
      'POST /api/cart',
      'GET /api/cart/:sessionId',
      'DELETE /api/cart/:sessionId'
    ]
  });
});

// Récupérer tous les produits
app.get('/api/products', async (req, res, next) => {
  const parsedQuery = z.object({
    category: z.string().trim().max(40).optional(),
    search: z.string().trim().max(80).optional()
  }).safeParse(req.query);
  if (!parsedQuery.success) return res.status(400).json({ success: false, message: 'Filtres de recherche invalides' });
  try {
    const products = await listCatalog(parsedQuery.data);
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    next(error);
  }
});

// Taux de change officiels: une seule source de vérité pour l'affichage et la facturation.
app.get('/api/currency-rates', async (req, res, next) => {
  if (!database) return res.json({ success: true, rates: FALLBACK_CURRENCY_RATES });
  try {
    const result = await database.query('SELECT currency, units_per_usd FROM currency_rate');
    const rates = Object.fromEntries(result.rows.map((row) => [row.currency.trim(), Number(row.units_per_usd)]));
    res.json({ success: true, rates });
  } catch (error) {
    next(error);
  }
});

// Récupérer un produit par ID
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const product = await findProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// Récupérer les produits par catégorie
app.get('/api/products/category/:category', async (req, res, next) => {
  try {
    const products = await listCatalog({ category: req.params.category });
    res.json({ success: true, category: req.params.category, count: products.length, products });
  } catch (error) {
    next(error);
  }
});

// Panier synchronisé entre appareils pour un compte connecté. Un visiteur non connecté
// n'appelle jamais ces routes: son panier reste local (localStorage/AsyncStorage) tant
// qu'il ne s'est pas identifié — voir web/site.js et mobile/context/CartContext.js.
app.get('/api/cart', requireAuthentication, async (req, res, next) => {
  try {
    const result = await database.query(
      'SELECT product_id AS id, qty FROM cart_item WHERE user_id = $1 ORDER BY product_id',
      [req.auth.userId]
    );
    res.json({ success: true, cart: { items: result.rows } });
  } catch (error) {
    next(error);
  }
});

// Remplace entièrement le panier serveur par celui envoyé (items vide = panier vidé).
app.put('/api/cart', requireAuthentication, async (req, res, next) => {
  const parsedCart = cartItemsSchema.safeParse(req.body);
  if (!parsedCart.success) {
    return res.status(400).json({
      success: false,
      message: 'Panier invalide',
      errors: parsedCart.error.flatten().fieldErrors
    });
  }

  const quantities = aggregateQuantities(parsedCart.data.items);

  try {
    // Le stock affiché reste indicatif: seul le passage de commande le réserve.
    if (quantities.size) {
      const catalog = new Map((await listCatalog()).map((product) => [product.id, product]));
      for (const [id, qty] of quantities) {
        const product = catalog.get(id);
        if (!product || qty > product.stock) {
          return res.status(400).json({
            success: false,
            message: 'Un produit est introuvable ou la quantité dépasse le stock disponible'
          });
        }
      }
    }
  } catch (error) {
    return next(error);
  }

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cart_item WHERE user_id = $1', [req.auth.userId]);
    for (const [id, qty] of quantities) {
      await client.query('INSERT INTO cart_item (user_id, product_id, qty) VALUES ($1, $2, $3)', [req.auth.userId, id, qty]);
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Panier mis à jour', cart: { items: [...quantities].map(([id, qty]) => ({ id, qty })) } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.delete('/api/cart', requireAuthentication, async (req, res, next) => {
  try {
    await database.query('DELETE FROM cart_item WHERE user_id = $1', [req.auth.userId]);
    res.json({ success: true, message: 'Panier vidé' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Informations d’inscription invalides', errors: parsed.error.flatten().fieldErrors });
  if (!(await checkTurnstile(req, res, parsed.data['cf-turnstile-response']))) return;
  const { email, password, fullName, phone } = parsed.data;
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const customerResult = await client.query('INSERT INTO customer (full_name, phone, email) VALUES ($1, $2, $3) RETURNING id', [fullName, phone, email]);
    const accountResult = await client.query("INSERT INTO user_account (customer_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, role", [customerResult.rows[0].id, email, passwordHash]);
    const account = { id: accountResult.rows[0].id, role: accountResult.rows[0].role };
    const refreshToken = await createRefreshToken(client, account.id);
    await client.query('COMMIT');
    res.status(201).json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Cette adresse e-mail est déjà utilisée' });
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Identifiants invalides' });
  if (!(await checkTurnstile(req, res, parsed.data['cf-turnstile-response']))) return;
  try {
    const accountResult = await database.query('SELECT id, email, password_hash, role, is_active FROM user_account WHERE email = $1', [parsed.data.email]);
    const account = accountResult.rows[0];
    // password_hash est NULL pour un compte créé via Google/Apple (aucun mot de passe).
    const validPassword = account && account.is_active && account.password_hash && await argon2.verify(account.password_hash, parsed.data.password);
    if (!validPassword) return res.status(401).json({ success: false, message: 'Adresse e-mail ou mot de passe incorrect' });
    const refreshToken = await createRefreshToken(database, account.id);
    res.json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email: account.email } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/google', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  if (!GOOGLE_CLIENT_IDS.length) return res.status(503).json({ success: false, message: 'Connexion Google non configurée' });
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton Google manquant' });
  let payload;
  try {
    // Vérifié avant d'ouvrir une connexion à la base: pas besoin d'en tenir une inutilisée
    // pendant l'appel réseau vers les clés publiques de Google.
    payload = await verifyGoogleIdToken(parsed.data.idToken, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audiences: GOOGLE_CLIENT_IDS
    });
  } catch (error) {
    if (isOidcTokenError(error)) return res.status(401).json({ success: false, message: 'Jeton Google invalide ou expiré' });
    return next(error);
  }
  if (!payload.email || !payload.email_verified) {
    return res.status(403).json({ success: false, message: 'E-mail Google non vérifié' });
  }
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const account = await findOrCreateSocialAccount(client, {
      column: 'google_sub', sub: payload.sub, email: String(payload.email).toLowerCase(), fullName: payload.name
    });
    if (!account.is_active) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, message: 'Compte désactivé' });
    }
    const refreshToken = await createRefreshToken(client, account.id);
    await client.query('COMMIT');
    res.json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email: payload.email } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/apple', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  if (!APPLE_CLIENT_IDS.length) return res.status(503).json({ success: false, message: 'Connexion Apple non configurée' });
  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton Apple manquant' });
  let payload;
  try {
    payload = await verifyAppleIdToken(parsed.data.identityToken, {
      issuer: 'https://appleid.apple.com',
      audiences: APPLE_CLIENT_IDS
    });
  } catch (error) {
    if (isOidcTokenError(error)) return res.status(401).json({ success: false, message: 'Jeton Apple invalide ou expiré' });
    return next(error);
  }
  if (!payload.email) return res.status(403).json({ success: false, message: 'E-mail Apple indisponible' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const account = await findOrCreateSocialAccount(client, {
      column: 'apple_sub', sub: payload.sub, email: String(payload.email).toLowerCase(), fullName: parsed.data.fullName
    });
    if (!account.is_active) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, message: 'Compte désactivé' });
    }
    const refreshToken = await createRefreshToken(client, account.id);
    await client.query('COMMIT');
    res.json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email: payload.email } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/refresh', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton de renouvellement invalide' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(`SELECT refresh_token.id, user_account.id AS user_id, user_account.role, user_account.is_active FROM refresh_token JOIN user_account ON user_account.id = refresh_token.user_id WHERE refresh_token.token_hash = $1 AND refresh_token.revoked_at IS NULL AND refresh_token.expires_at > now() FOR UPDATE`, [hashRefreshToken(parsed.data.token)]);
    const token = tokenResult.rows[0];
    if (!token || !token.is_active) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, message: 'Session expirée ou invalide' });
    }
    await client.query('UPDATE refresh_token SET revoked_at = now() WHERE id = $1', [token.id]);
    const refreshToken = await createRefreshToken(client, token.user_id);
    await client.query('COMMIT');
    res.json({ success: true, accessToken: createAccessToken({ id: token.user_id, role: token.role }), refreshToken });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.get('/api/auth/me', requireAuthentication, async (req, res, next) => {
  if (!requireDatabase(res)) return;
  try {
    const result = await database.query('SELECT email, verified_at FROM user_account WHERE id = $1', [req.auth.userId]);
    const account = result.rows[0];
    res.json({
      success: true,
      user: { id: req.auth.userId, role: req.auth.role, email: account?.email, verified: Boolean(account?.verified_at) }
    });
  } catch (error) {
    next(error);
  }
});

// Canaux effectivement utilisables (pas seulement supportés en théorie): le frontend ne
// doit jamais proposer un choix qui échouerait à l'envoi.
app.get('/api/auth/verification/channels', (req, res) => {
  res.json({ success: true, channels: channelAvailability() });
});

app.post('/api/auth/verification/send', requireAuthentication, verificationSendLimiter, async (req, res, next) => {
  const parsed = sendVerificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Canal invalide' });
  const { channel } = parsed.data;
  if (!channelAvailability()[channel]) {
    return res.status(503).json({ success: false, message: `Vérification par ${channel} non configurée` });
  }
  try {
    const result = await database.query(
      'SELECT user_account.email, customer.phone FROM user_account LEFT JOIN customer ON customer.id = user_account.customer_id WHERE user_account.id = $1',
      [req.auth.userId]
    );
    const destination = channel === 'email' ? result.rows[0].email : result.rows[0].phone;
    if (!destination) {
      return res.status(400).json({
        success: false,
        message: channel === 'email' ? 'E-mail manquant sur votre compte' : 'Numéro de téléphone manquant sur votre profil'
      });
    }
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    // Un seul code actif à la fois par compte: les précédents non consommés sont annulés.
    await database.query('DELETE FROM verification_code WHERE user_id = $1 AND consumed_at IS NULL', [req.auth.userId]);
    await database.query(
      'INSERT INTO verification_code (user_id, channel, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [req.auth.userId, channel, hashToken(code), expiresAt]
    );
    const message = `Votre code de vérification MonChantier : ${code} (valable 10 minutes).`;
    if (channel === 'email') await sendEmail(destination, 'Votre code de vérification MonChantier', message);
    else if (channel === 'sms') await sendSms(destination, message);
    else await sendWhatsApp(destination, message);
    res.status(202).json({ success: true, message: 'Code envoyé' });
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ success: false, message: `Vérification par ${channel} non configurée` });
    next(error);
  }
});

app.post('/api/auth/verification/confirm', requireAuthentication, async (req, res, next) => {
  const parsed = confirmVerificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Code invalide' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, code_hash, attempts FROM verification_code
       WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [req.auth.userId]
    );
    const record = result.rows[0];
    if (!record) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Aucun code en attente, ou code expiré' });
    }
    if (record.attempts >= 5) {
      await client.query('ROLLBACK');
      captureSecurityEvent('Trop de tentatives sur un code de vérification', { userId: req.auth.userId });
      return res.status(429).json({ success: false, message: 'Trop de tentatives, demandez un nouveau code' });
    }
    if (!tokensMatch(parsed.data.code, record.code_hash)) {
      await client.query('UPDATE verification_code SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      await client.query('COMMIT');
      return res.status(401).json({ success: false, message: 'Code incorrect' });
    }
    await client.query('UPDATE verification_code SET consumed_at = now() WHERE id = $1', [record.id]);
    await client.query('UPDATE user_account SET verified_at = now(), updated_at = now() WHERE id = $1', [req.auth.userId]);
    await client.query('COMMIT');
    res.json({ success: true, verified: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', requireAuthentication, async (req, res, next) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton de renouvellement invalide' });
  try {
    await database.query('UPDATE refresh_token SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL', [req.auth.userId, hashRefreshToken(parsed.data.token)]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/users/:userId/role', requireAuthentication, requireRole('admin'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.userId).success) return res.status(400).json({ success: false, message: 'Identifiant utilisateur invalide' });
  const parsed = userRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Rôle utilisateur invalide' });
  try {
    const result = await database.query('UPDATE user_account SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, email, role, is_active', [parsed.data.role, req.params.userId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', requireAuthentication, requireRole('customer'), async (req, res, next) => {
  if (!requireDatabase(res)) return;
  const parsedOrder = orderSchema.safeParse(req.body);
  if (!parsedOrder.success) {
    return res.status(400).json({ success: false, message: 'Commande invalide', errors: parsedOrder.error.flatten().fieldErrors });
  }

  const { customer, currency, paymentProvider, items, deliveryLatitude, deliveryLongitude } = parsedOrder.data;
  if (paymentProvider === 'paypal' && currency === 'CDF') {
    return res.status(400).json({
      success: false,
      message: 'PayPal ne prend pas en charge le CDF. Sélectionnez USD ou EUR.'
    });
  }
  const mobileMoneyProvider = MOBILE_MONEY_PROVIDERS[paymentProvider];
  if (mobileMoneyProvider && !mobileMoneyProvider.payoutNumber) {
    return res.status(503).json({
      success: false,
      message: `Le paiement ${mobileMoneyProvider.label} n’est pas encore configuré. Contactez-nous.`
    });
  }
  const quantities = aggregateQuantities(items);
  const productIds = [...quantities.keys()];

  try {
    await syncCatalog();
  } catch (error) {
    return next(error);
  }

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    // Verrouillage des lignes catalogue par ordre d'identifiant: prix et stock ne peuvent plus bouger
    // entre la vérification et le décrément, et l'ordre stable évite les interblocages.
    const productResult = await client.query(
      'SELECT id, name_fr, unit, price_usd, stock_qty FROM product WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE',
      [productIds]
    );
    if (productResult.rowCount !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Un produit du panier est introuvable' });
    }
    const products = new Map(productResult.rows.map((row) => [row.id, row]));

    for (const [productId, qty] of quantities) {
      const decrement = await client.query(
        'UPDATE product SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1',
        [qty, productId]
      );
      if (!decrement.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Stock insuffisant pour ${productId}: ${Number(products.get(productId).stock_qty)} disponible(s)`
        });
      }
    }

    const customerResult = await client.query(
      'UPDATE customer SET full_name = $1, phone = $2, email = COALESCE($3, email) WHERE id = $4 RETURNING email',
      [customer.fullName, customer.phone, customer.email || null, req.auth.customerId]
    );
    const customerEmail = customerResult.rows[0].email;
    const rateResult = await client.query('SELECT units_per_usd FROM currency_rate WHERE currency = $1', [currency]);
    if (rateResult.rowCount !== 1) throw new Error('Devise indisponible');
    const rate = Number(rateResult.rows[0].units_per_usd);
    let subtotalUsd = 0;
    for (const [productId, qty] of quantities) {
      subtotalUsd += Number(products.get(productId).price_usd) * qty;
    }
    const subtotal = Number((subtotalUsd * rate).toFixed(2));
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, currency, subtotal_amount, total_amount, delivery_latitude, delivery_longitude)
       VALUES ($1, $2, $3, $3, $4, $5) RETURNING id, status, total_amount, currency`,
      [req.auth.customerId, currency, subtotal, deliveryLatitude ?? null, deliveryLongitude ?? null]
    );
    const order = orderResult.rows[0];
    for (const [productId, qty] of quantities) {
      await client.query(
        'INSERT INTO order_item (order_id, product_id, qty, unit_price_usd) VALUES ($1, $2, $3, $4)',
        [order.id, productId, qty, Number(products.get(productId).price_usd)]
      );
    }
    await client.query(
      'INSERT INTO payment (order_id, provider, amount, currency) VALUES ($1, $2, $3, $4)',
      [order.id, paymentProvider, order.total_amount, order.currency]
    );
    await client.query('COMMIT');
    // Airtel/Orange Money: pas de redirection ni d'appel externe, on renvoie directement
    // les instructions de paiement (le client PayPal, lui, appelle /orders/:id/paypal ensuite).
    const payment = mobileMoneyProvider
      ? { provider: paymentProvider, label: mobileMoneyProvider.label, payoutNumber: mobileMoneyProvider.payoutNumber, reference: order.id }
      : undefined;
    // Purement informatif: la commande est déjà créée à ce stade, un échec d'envoi ne doit
    // jamais faire échouer la réponse au client. channelAvailability évite une tentative
    // inutile (et un avertissement dans les logs) quand Resend n'est pas configuré.
    if (customerEmail && channelAvailability().email) {
      sendOrderConfirmationEmail(customerEmail, order, quantities, products, payment).catch((error) => {
        console.warn('E-mail de confirmation de commande non envoyé:', error.message);
      });
    }
    res.status(201).json({
      success: true,
      order: { id: order.id, status: order.status, totalAmount: order.total_amount, currency: order.currency, paymentProvider },
      ...(payment ? { payment } : {})
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/orders/:orderId/paypal', requireAuthentication, requireRole('customer'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  try {
    const paymentResult = await database.query(
      `SELECT payment.id, payment.amount, payment.currency FROM payment
       JOIN orders ON orders.id = payment.order_id
       WHERE payment.order_id = $1 AND orders.customer_id = $2 AND payment.provider = 'paypal' AND payment.status = 'pending'`,
      [req.params.orderId, req.auth.customerId]
    );
    if (paymentResult.rowCount !== 1) return res.status(404).json({ success: false, message: 'Paiement PayPal introuvable ou déjà traité' });
    const payment = paymentResult.rows[0];
    if (payment.currency === 'CDF') return res.status(400).json({ success: false, message: 'PayPal ne prend pas en charge le CDF. Sélectionnez USD ou EUR.' });
    const accessToken = await getPaypalAccessToken();
    const applicationUrl = process.env.APP_URL || 'http://localhost:3002';
    // Jeton à usage unique: la page de retour peut confirmer le paiement sans session ouverte
    // (retour depuis le navigateur système sur mobile) mais personne d'autre ne le peut.
    const confirmationToken = crypto.randomBytes(32).toString('base64url');
    const paypalResponse = await fetch(`${process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': req.params.orderId },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: req.params.orderId, amount: { currency_code: payment.currency, value: Number(payment.amount).toFixed(2) } }],
        application_context: {
          return_url: `${applicationUrl}/payment-success.html?orderId=${req.params.orderId}&ct=${confirmationToken}`,
          cancel_url: `${applicationUrl}/cart.html?payment=cancelled`
        }
      })
    });
    if (!paypalResponse.ok) throw new Error('Création du paiement PayPal refusée');
    const paypalOrder = await paypalResponse.json();
    await database.query(
      'UPDATE payment SET provider_reference = $1, confirmation_token_hash = $2, updated_at = now() WHERE id = $3',
      [paypalOrder.id, hashToken(confirmationToken), payment.id]
    );
    const approval = paypalOrder.links.find((link) => link.rel === 'approve');
    res.json({ success: true, approvalUrl: approval && approval.href, confirmationToken });
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ success: false, message: 'PayPal n’est pas configuré. Contactez-nous.' });
    next(error);
  }
});

app.post('/api/orders/:orderId/paypal/capture', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  const parsedCapture = paypalCaptureSchema.safeParse(req.body);
  if (!parsedCapture.success) return res.status(400).json({ success: false, message: 'Jeton de confirmation manquant' });
  try {
    const paymentResult = await database.query(
      `SELECT payment.id, payment.provider_reference, payment.amount, payment.currency, payment.confirmation_token_hash FROM payment
       WHERE payment.order_id = $1 AND payment.provider = 'paypal' AND payment.status = 'pending'`,
      [req.params.orderId]
    );
    const pendingPayment = paymentResult.rows[0];
    if (paymentResult.rowCount !== 1 || !pendingPayment.provider_reference) return res.status(404).json({ success: false, message: 'Paiement PayPal introuvable ou déjà traité' });
    if (!tokensMatch(parsedCapture.data.confirmationToken, pendingPayment.confirmation_token_hash)) {
      return res.status(403).json({ success: false, message: 'Jeton de confirmation invalide' });
    }
    const accessToken = await getPaypalAccessToken();
    const paypalResponse = await fetch(`${process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'}/v2/checkout/orders/${pendingPayment.provider_reference}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });
    if (!paypalResponse.ok) return res.status(400).json({ success: false, message: 'Le paiement PayPal n’a pas été approuvé' });
    const paypalOrder = await paypalResponse.json();
    if (paypalOrder.status !== 'COMPLETED') return res.status(400).json({ success: false, message: 'Le paiement PayPal n’est pas finalisé' });
    // Le montant réellement encaissé doit correspondre à la commande.
    const captured = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
    if (!captured || captured.currency_code !== pendingPayment.currency.trim() || Number(captured.value) !== Number(pendingPayment.amount)) {
      console.error('Montant PayPal incohérent', { orderId: req.params.orderId, captured, expected: pendingPayment.amount });
      return res.status(400).json({ success: false, message: 'Le montant encaissé ne correspond pas à la commande. Contactez le support.' });
    }
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE payment SET status = 'paid', confirmation_token_hash = NULL, updated_at = now() WHERE id = $1", [pendingPayment.id]);
      await client.query("UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1", [req.params.orderId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.json({ success: true, orderId: req.params.orderId, status: 'confirmed' });
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ success: false, message: 'PayPal n’est pas configuré. Contactez-nous.' });
    next(error);
  }
});

app.get('/api/orders', requireAuthentication, async (req, res, next) => {
  const status = z.enum(['pending', 'confirmed', 'delivering', 'completed', 'cancelled']).safeParse(req.query.status);
  if (req.query.status && !status.success) return res.status(400).json({ success: false, message: 'Statut de commande invalide' });
  const filters = [];
  const values = [];
  if (req.auth.role === 'customer') {
    values.push(req.auth.customerId);
    filters.push(`orders.customer_id = $${values.length}`);
  } else if (req.auth.role === 'staff') {
    values.push(req.auth.userId);
    filters.push(`(orders.assigned_to = $${values.length} OR (orders.assigned_to IS NULL AND orders.status IN ('confirmed', 'delivering')))`);
  }
  if (status.success) {
    values.push(status.data);
    filters.push(`orders.status = $${values.length}`);
  }
  try {
    // Un payment par commande (voir POST /api/orders): la jointure ne duplique pas les lignes.
    const result = await database.query(
      `SELECT orders.id, orders.status, orders.currency, orders.total_amount, orders.created_at, orders.assigned_to,
              orders.delivery_latitude, orders.delivery_longitude,
              customer.full_name, customer.phone, payment.provider AS payment_provider, payment.status AS payment_status
       FROM orders
       JOIN customer ON customer.id = orders.customer_id
       LEFT JOIN payment ON payment.order_id = orders.id
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY orders.created_at DESC`,
      values
    );
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    next(error);
  }
});

// Détail d'une commande (articles inclus) — même périmètre d'accès que la liste ci-dessus:
// un customer ne voit que la sienne, un staff que celles qui lui sont affectées ou
// disponibles, un admin toutes.
app.get('/api/orders/:orderId', requireAuthentication, async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  const filters = ['orders.id = $1'];
  const values = [req.params.orderId];
  if (req.auth.role === 'customer') {
    values.push(req.auth.customerId);
    filters.push(`orders.customer_id = $${values.length}`);
  } else if (req.auth.role === 'staff') {
    values.push(req.auth.userId);
    filters.push(`(orders.assigned_to = $${values.length} OR (orders.assigned_to IS NULL AND orders.status IN ('confirmed', 'delivering')))`);
  }
  try {
    const orderResult = await database.query(
      `SELECT orders.id, orders.status, orders.currency, orders.total_amount, orders.created_at, orders.assigned_to,
              orders.delivery_latitude, orders.delivery_longitude,
              customer.full_name, customer.phone, payment.provider AS payment_provider, payment.status AS payment_status
       FROM orders
       JOIN customer ON customer.id = orders.customer_id
       LEFT JOIN payment ON payment.order_id = orders.id
       WHERE ${filters.join(' AND ')}`,
      values
    );
    if (!orderResult.rowCount) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    const itemsResult = await database.query(
      `SELECT order_item.product_id AS id, order_item.qty, order_item.unit_price_usd,
              product.name_fr, product.name_en, product.unit
       FROM order_item JOIN product ON product.id = order_item.product_id
       WHERE order_item.order_id = $1 ORDER BY product.name_fr`,
      [req.params.orderId]
    );
    res.json({ success: true, order: { ...orderResult.rows[0], items: itemsResult.rows } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:orderId/claim', requireAuthentication, requireRole('staff'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  try {
    const result = await database.query("UPDATE orders SET assigned_to = $1, updated_at = now() WHERE id = $2 AND assigned_to IS NULL AND status = 'confirmed' RETURNING id, status, assigned_to", [req.auth.userId, req.params.orderId]);
    if (!result.rowCount) return res.status(409).json({ success: false, message: 'Cette commande n’est plus disponible pour affectation' });
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/orders/:orderId/status', requireAuthentication, requireRole('staff', 'admin'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Statut de commande invalide' });
  const allowedPreviousStatuses = { confirmed: ['pending'], delivering: ['confirmed'], completed: ['delivering'], cancelled: ['pending', 'confirmed'] };
  const values = [req.params.orderId, parsed.data.status, allowedPreviousStatuses[parsed.data.status]];
  let ownership = '';
  if (req.auth.role === 'staff') {
    values.push(req.auth.userId);
    ownership = ` AND assigned_to = $${values.length}`;
  }
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 AND status = ANY($3::text[])${ownership} RETURNING id, status, assigned_to`, values);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Transition de statut non autorisée' });
    }
    if (parsed.data.status === 'cancelled') {
      // Les quantités réservées à la création de la commande retournent au stock.
      await client.query(
        `UPDATE product SET stock_qty = product.stock_qty + order_item.qty
         FROM order_item WHERE order_item.order_id = $1 AND product.id = order_item.product_id`,
        [req.params.orderId]
      );
    }
    if (parsed.data.status === 'confirmed') {
      // Airtel/Orange Money n'ont pas de capture automatique: confirmer la commande vaut
      // déclaration par le staff que le paiement a été vérifié (SMS, relevé marchand...).
      await client.query(
        "UPDATE payment SET status = 'paid', updated_at = now() WHERE order_id = $1 AND provider IN ('airtel_money', 'orange_money') AND status = 'pending'",
        [req.params.orderId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});


if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  const isCorsError = err.message === 'Origine non autorisée par CORS';
  // Une origine rejetée est un refus attendu, pas un bug: on la journalise sans
  // encombrer le suivi d'erreurs.
  if (isCorsError) console.error(err.stack);
  else captureError(err);
  res.status(isCorsError ? 403 : 500).json({
    success: false,
    message: isCorsError ? 'Origine non autorisée' : 'Erreur interne du serveur'
  });
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📦 ${PRODUCTS.length} produits chargés`);
  console.log(`🌍 CORS activé pour: ${allowedOrigins.join(', ')}${codespaceOriginPattern ? ' (+ ports de ce Codespace)' : ''}`);
  console.log(`🖥️  Site web servi sur http://localhost:${PORT}/`);
  syncCatalog()
    .then(() => database && console.log('🗄️  Catalogue synchronisé en base'))
    .catch((error) => console.error('⚠️  Synchronisation du catalogue impossible:', error.message));
});

// Arrêt propre: cesse d'accepter de nouvelles requêtes, laisse les requêtes en cours se
// terminer, ferme le pool PostgreSQL, puis quitte. Un déploiement (Render, Docker, k8s...)
// envoie SIGTERM et attend l'arrêt du process avant de le tuer: sans ce gestionnaire, les
// requêtes en cours et les connexions PostgreSQL sont coupées net à chaque redéploiement.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} reçu, arrêt en cours...`);
  const forceExit = setTimeout(() => {
    console.error('Arrêt forcé: la fermeture propre a dépassé le délai imparti');
    process.exit(1);
  }, 10000);
  forceExit.unref();
  try {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (database) await database.end();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Erreur pendant l’arrêt:', error);
    clearTimeout(forceExit);
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Après une exception non interceptée, l'état du process n'est plus fiable: on la
// journalise puis on s'arrête proprement plutôt que de continuer à servir des requêtes.
process.on('uncaughtException', (error) => {
  captureError(error);
  shutdown('uncaughtException');
});
// Un rejet de promesse non intercepté n'affecte pas forcément la requête en cours (toutes
// les routes retournent déjà leurs erreurs via next()): on le journalise sans arrêter le
// serveur.
process.on('unhandledRejection', (reason) => {
  captureError(reason instanceof Error ? reason : new Error(String(reason)));
});
