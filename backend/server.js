const express = require('express');
const path = require('path');
const argon2 = require('argon2');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');
const { z } = require('zod');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
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
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 5000
    })
  : null;
// Sans cet écouteur, la perte d'une connexion inactive (redémarrage de PostgreSQL, coupure
// réseau) remonte en exception non capturée et tue le serveur.
if (database) {
  database.on('error', (error) => console.error('Connexion PostgreSQL perdue:', error.message));
}
const JWT_ISSUER = process.env.JWT_ISSUER || 'monchantier-api';
const FALLBACK_CURRENCY_RATES = { USD: 1, CDF: 2800, EUR: 0.92 };
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_DAYS = 30;
const PASSWORD_RESET_MINUTES = 15;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const googleOAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Middleware
// Le navigateur envoie un en-tête Origin même pour une requête de même origine (POST, PUT...).
// Le site étant servi par ce serveur, refuser sa propre origine reviendrait à bloquer
// l'application elle-même, quel que soit le port ou le nom d'hôte utilisé pour y accéder.
function isSameOrigin(origin, host) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch (error) {
    return false;
  }
}

function isAllowedOrigin(origin, host) {
  return !origin
    || isSameOrigin(origin, host)
    || allowedOrigins.includes(origin)
    || (codespaceOriginPattern && codespaceOriginPattern.test(origin));
}

app.use(cors((req, callback) => {
  if (isAllowedOrigin(req.headers.origin, req.headers.host)) {
    return callback(null, { origin: true });
  }
  return callback(new Error('Origine non autorisée par CORS'));
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      // Le catalogue charge Tailwind par CDN et utilise des gestionnaires d'événements inline.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...allowedOrigins],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null })
    }
  }
}));

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ success: false, message: 'Webhook Stripe non configuré' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Signature Stripe invalide' });
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === 'paid') {
        await database.query(
          `UPDATE payment SET status = 'paid', provider_reference = $1, updated_at = now()
           WHERE order_id = $2 AND provider IN ('stripe_card', 'google_pay') AND status = 'pending'`,
          [session.id, orderId]
        );
        await database.query(
          `UPDATE orders SET status = 'confirmed', updated_at = now()
           WHERE id = $1 AND status = 'pending'`,
          [orderId]
        );
      }
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await database.query("UPDATE payment SET status = 'failed', updated_at = now() WHERE order_id = $1 AND provider IN ('stripe_card', 'google_pay') AND status = 'pending'", [orderId]);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('Webhook Stripe échoué:', error.message);
    return res.status(500).json({ success: false, message: 'Traitement du webhook impossible' });
  }
});
app.use(express.json({ limit: '100kb' }));
// Derrière un proxy (Codespaces, hébergeur), l'adresse du client est dans X-Forwarded-For.
// Ne faire confiance à cet en-tête que si on est réellement derrière un proxy, sinon
// n'importe qui pourrait le forger pour contourner les quotas.
app.set('trust proxy', Number(process.env.TRUST_PROXY || (process.env.CODESPACES === 'true' ? 1 : 0)));

function quotaResponse(message) {
  return (req, res) => res.status(429).json({ success: false, message });
}

// Le quota ne vise que l'API: une page web charge plusieurs fichiers et l'épuiserait.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: quotaResponse('Trop de requêtes. Patientez quelques minutes avant de réessayer.')
});

// Connexion: quota strict, c'est la cible des attaques par force brute. Seuls les échecs
// comptent, et le compteur lui est propre: un attaquant qui l'épuise ne doit pas empêcher
// les autres visiteurs de créer un compte.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: quotaResponse('Trop de tentatives de connexion. Réessayez dans quelques minutes.')
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: quotaResponse('Trop de créations de compte depuis cette adresse. Réessayez plus tard.')
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  handler: quotaResponse('Trop de demandes. Réessayez plus tard.')
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/google', loginLimiter);
app.use('/api/auth/facebook', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);

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

// Stockage temporaire des paniers (en production, utiliser une base de données)
let carts = {};

const cartSchema = z.object({
  sessionId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().min(1).max(32),
    qty: z.number().int().min(1).max(10000)
  })).min(1).max(100)
});

const orderSchema = z.object({
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(254).optional()
  }),
  currency: z.enum(['USD', 'CDF', 'EUR']),
  paymentProvider: z.enum(['paypal', 'mobile_money', 'stripe_card', 'google_pay']),
  items: z.array(z.object({
    id: z.string().min(1).max(32),
    qty: z.number().int().min(1).max(10000)
  })).min(1).max(100)
});

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128)
});
const forgotPasswordSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp']),
  identifier: z.string().trim().min(3).max(254)
});
const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128) });
const registrationSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30)
});
const refreshTokenSchema = z.object({ token: z.string().min(32).max(512) });
const googleAuthSchema = z.object({ credential: z.string().min(20).max(4096) });
const facebookAuthSchema = z.object({ accessToken: z.string().min(20).max(4096) });
const paypalCaptureSchema = z.object({ confirmationToken: z.string().min(20).max(256) });
const orderStatusSchema = z.object({ status: z.enum(['confirmed', 'delivering', 'completed', 'cancelled']) });
const userRoleSchema = z.object({ role: z.enum(['customer', 'staff', 'admin']) });
const adminListQuerySchema = z.object({
  search: z.string().trim().max(254).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const ROLE_PERMISSIONS = Object.freeze({
  customer: Object.freeze(['orders:create', 'orders:read_own', 'payments:create_own']),
  staff: Object.freeze(['orders:read_operational', 'orders:claim', 'orders:update_assigned']),
  admin: Object.freeze(['orders:read_all', 'orders:update_any', 'users:assign_role'])
});

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

function resetPasswordUrl(token) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/reset-password.html#token=${encodeURIComponent(token)}`;
}

function isPasswordResetChannelConfigured(channel) {
  if (channel === 'email') return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

async function sendPasswordResetMessage({ channel, destination, token }) {
  const url = resetPasswordUrl(token);
  if (channel === 'email') {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new Error('Envoi e-mail non configuré');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [destination], subject: 'Réinitialisation de votre mot de passe MonChantier', text: `Réinitialisez votre mot de passe dans les 15 minutes : ${url}` })
    });
    if (!response.ok) throw new Error('Envoi e-mail refusé');
    return;
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) throw new Error('Envoi SMS/WhatsApp non configuré');
  const body = new URLSearchParams({
    To: channel === 'whatsapp' ? `whatsapp:${destination}` : destination,
    From: channel === 'whatsapp' ? `whatsapp:${process.env.TWILIO_FROM}` : process.env.TWILIO_FROM,
    Body: `MonChantier : réinitialisez votre mot de passe dans les 15 minutes : ${url}`
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error('Envoi SMS/WhatsApp refusé');
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

async function verifyGoogleCredential(credential) {
  if (!googleOAuthClient) throw Object.assign(new Error('Connexion Google non configurée'), { statusCode: 503 });
  let ticket;
  try {
    ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  } catch (error) {
    throw Object.assign(new Error('Jeton Google invalide'), { statusCode: 401 });
  }
  const payload = ticket.getPayload();
  // email_verified vient de Google, pas de l'appelant: c'est ce qui permet de relier ou
  // créer un compte par e-mail sans révérifier nous-mêmes la boîte mail.
  if (!payload?.email || !payload.email_verified) {
    throw Object.assign(new Error('Compte Google sans e-mail vérifié'), { statusCode: 401 });
  }
  return { providerId: payload.sub, email: payload.email.toLowerCase(), fullName: payload.name || payload.email };
}

async function verifyFacebookAccessToken(accessToken) {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) throw Object.assign(new Error('Connexion Facebook non configurée'), { statusCode: 503 });
  // debug_token confirme que le jeton a bien été émis pour CETTE application Facebook:
  // sans ce contrôle, le jeton valide d'une autre appli suffirait à usurper un compte.
  const appAccessToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
  const debugResponse = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`);
  const debugData = await debugResponse.json().catch(() => ({}));
  const tokenInfo = debugData.data;
  if (!debugResponse.ok || !tokenInfo?.is_valid || tokenInfo.app_id !== FACEBOOK_APP_ID) {
    throw Object.assign(new Error('Jeton Facebook invalide'), { statusCode: 401 });
  }
  const profileResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || profile.id !== tokenInfo.user_id) {
    throw Object.assign(new Error('Profil Facebook invalide'), { statusCode: 401 });
  }
  if (!profile.email) throw Object.assign(new Error('Autorisez le partage de votre e-mail Facebook pour continuer'), { statusCode: 401 });
  return { providerId: profile.id, email: profile.email.toLowerCase(), fullName: profile.name || profile.email };
}

// Relie un compte existant (même e-mail) ou en crée un nouveau sans mot de passe local.
async function findOrCreateSocialAccount(client, provider, { providerId, email, fullName }) {
  const providerColumn = provider === 'google' ? 'google_sub' : 'facebook_id';
  const existingByProvider = await client.query(`SELECT id, role FROM user_account WHERE ${providerColumn} = $1`, [providerId]);
  if (existingByProvider.rows[0]) return existingByProvider.rows[0];

  const existingByEmail = await client.query('SELECT id, role FROM user_account WHERE email = $1', [email]);
  if (existingByEmail.rows[0]) {
    await client.query(`UPDATE user_account SET ${providerColumn} = $1, updated_at = now() WHERE id = $2`, [providerId, existingByEmail.rows[0].id]);
    return existingByEmail.rows[0];
  }

  const customerResult = await client.query('INSERT INTO customer (full_name, email) VALUES ($1, $2) RETURNING id', [fullName, email]);
  const accountResult = await client.query(
    `INSERT INTO user_account (customer_id, email, ${providerColumn}) VALUES ($1, $2, $3) RETURNING id, role`,
    [customerResult.rows[0].id, email, providerId]
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

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) === true;
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.auth.role, permission)) return res.status(403).json({ success: false, message: 'Droits insuffisants' });
    next();
  };
}

function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!permissions.some((permission) => hasPermission(req.auth.role, permission))) {
      return res.status(403).json({ success: false, message: 'Droits insuffisants' });
    }
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

async function getPaypalAccessToken() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal n’est pas configuré');
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

// Routes API

// Route de test
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API MonChantier',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
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

// Sonde de disponibilité: dit en un appel si l'API répond et si la base est joignable.
app.get('/api/health', async (req, res) => {
  const health = { success: true, api: 'ok', database: database ? 'inconnu' : 'non configuré', uptime: Math.round(process.uptime()) };
  if (database) {
    try {
      await database.query('SELECT 1');
      health.database = 'ok';
    } catch (error) {
      health.success = false;
      health.database = 'injoignable';
    }
  }
  res.status(health.success ? 200 : 503).json(health);
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

// Ajouter/mettre à jour le panier
app.post('/api/cart', async (req, res, next) => {
  const parsedCart = cartSchema.safeParse(req.body);
  if (!parsedCart.success) {
    return res.status(400).json({
      success: false,
      message: 'Panier invalide',
      errors: parsedCart.error.flatten().fieldErrors
    });
  }

  const { sessionId, items } = parsedCart.data;

  try {
    // Le stock affiché reste indicatif: seul le passage de commande le réserve.
    const catalog = new Map((await listCatalog()).map((product) => [product.id, product]));
    for (const [id, qty] of aggregateQuantities(items)) {
      const product = catalog.get(id);
      if (!product || qty > product.stock) {
        return res.status(400).json({
          success: false,
          message: 'Un produit est introuvable ou la quantité dépasse le stock disponible'
        });
      }
    }
  } catch (error) {
    return next(error);
  }

  carts[sessionId] = {
    items: items.map((item) => ({ id: item.id, qty: item.qty })),
    updatedAt: new Date()
  };

  res.json({
    success: true,
    message: 'Panier mis à jour',
    cart: carts[sessionId]
  });
});

// Créer un identifiant de panier non devinable.
app.post('/api/cart/session', (req, res) => {
  res.status(201).json({
    success: true,
    sessionId: crypto.randomUUID()
  });
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
  try {
    const accountResult = await database.query('SELECT id, email, password_hash, role, is_active FROM user_account WHERE email = $1', [parsed.data.email]);
    const account = accountResult.rows[0];
    const validPassword = account && account.is_active && await argon2.verify(account.password_hash, parsed.data.password);
    if (!validPassword) return res.status(401).json({ success: false, message: 'Adresse e-mail ou mot de passe incorrect' });
    const refreshToken = await createRefreshToken(database, account.id);
    res.json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email: account.email } });
  } catch (error) {
    next(error);
  }
});

// Permet au frontend de savoir quels boutons afficher et avec quel identifiant public
// d'application, sans dupliquer cette configuration dans chaque client statique.
app.get('/api/auth/social-config', (req, res) => {
  res.json({
    success: true,
    google: googleOAuthClient ? { clientId: GOOGLE_CLIENT_ID } : null,
    facebook: FACEBOOK_APP_ID ? { appId: FACEBOOK_APP_ID } : null
  });
});

async function completeSocialAuth(req, res, next, provider, verify, credentialField) {
  if (!requireDatabase(res)) return;
  try {
    requireJwtSecret();
  } catch (error) {
    return next(error);
  }
  const parsed = (provider === 'google' ? googleAuthSchema : facebookAuthSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton manquant ou invalide' });
  let identity;
  try {
    identity = await verify(parsed.data[credentialField]);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
  let client;
  try {
    client = await database.connect();
    await client.query('BEGIN');
    const account = await findOrCreateSocialAccount(client, provider, identity);
    const accountResult = await client.query('SELECT is_active FROM user_account WHERE id = $1', [account.id]);
    if (!accountResult.rows[0]?.is_active) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, message: 'Compte désactivé' });
    }
    const refreshToken = await createRefreshToken(client, account.id);
    await client.query('COMMIT');
    res.json({ success: true, accessToken: createAccessToken(account), refreshToken, user: { id: account.id, role: account.role, email: identity.email } });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally {
    if (client) client.release();
  }
}

app.post('/api/auth/google', (req, res, next) => completeSocialAuth(req, res, next, 'google', verifyGoogleCredential, 'credential'));
app.post('/api/auth/facebook', (req, res, next) => completeSocialAuth(req, res, next, 'facebook', verifyFacebookAccessToken, 'accessToken'));

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

app.post('/api/auth/forgot-password', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  const genericResponse = { success: true, message: 'Si ces informations correspondent à un compte, un lien de réinitialisation sera envoyé.' };
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Canal ou identifiant invalide' });
  const { channel } = parsed.data;
  if (!isPasswordResetChannelConfigured(channel)) return res.status(503).json({ success: false, message: 'Ce canal de récupération est momentanément indisponible' });
  const identifier = channel === 'email' ? parsed.data.identifier.toLowerCase() : parsed.data.identifier.replace(/[^\d+]/g, '');
  try {
    const contactColumn = channel === 'whatsapp' ? 'COALESCE(NULLIF(customer.whatsapp, \'\'), customer.phone)' : 'customer.phone';
    const result = await database.query(
      `SELECT user_account.id, user_account.email,
              ${contactColumn} AS phone
       FROM user_account LEFT JOIN customer ON customer.id = user_account.customer_id
       WHERE user_account.is_active = true AND ${channel === 'email'
         ? 'user_account.email = $1'
         : `regexp_replace(COALESCE(${contactColumn}, ''), '[^0-9+]', '', 'g') = $1`}
       LIMIT 1`,
      [identifier]
    );
    const account = result.rows[0];
    if (!account || (channel !== 'email' && !account.phone)) return res.json(genericResponse);
    const destination = channel === 'email' ? account.email : account.phone;
    const token = crypto.randomBytes(32).toString('base64url');
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE password_reset_token SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [account.id]);
      await client.query(
        'INSERT INTO password_reset_token (user_id, token_hash, channel, expires_at) VALUES ($1, $2, $3, now() + ($4 * interval \'1 minute\'))',
        [account.id, hashToken(token), channel, PASSWORD_RESET_MINUTES]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    await sendPasswordResetMessage({ channel, destination, token });
    res.json(genericResponse);
  } catch (error) {
    console.error('Échec de l’envoi du lien de réinitialisation:', error.message);
    if (error.message.startsWith('Envoi ')) return res.status(503).json({ success: false, message: 'Ce canal de récupération est momentanément indisponible' });
    next(error);
  }
});

app.post('/api/auth/reset-password', async (req, res, next) => {
  if (!requireDatabase(res)) return;
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Jeton ou mot de passe invalide' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, user_id FROM password_reset_token WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE',
      [hashToken(parsed.data.token)]
    );
    const resetToken = result.rows[0];
    if (!resetToken) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré' });
    }
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
    await client.query('UPDATE user_account SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, resetToken.user_id]);
    await client.query('UPDATE password_reset_token SET used_at = now() WHERE id = $1', [resetToken.id]);
    await client.query('UPDATE refresh_token SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [resetToken.user_id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.get('/api/auth/me', requireAuthentication, (req, res) => {
  res.json({
    success: true,
    user: { id: req.auth.userId, role: req.auth.role, permissions: ROLE_PERMISSIONS[req.auth.role] || [] }
  });
});

app.get('/api/admin/users', requireAuthentication, requirePermission('users:assign_role'), async (req, res, next) => {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Paramètres de recherche invalides' });
  const { search, limit, offset } = parsed.data;
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(`email LIKE $${values.length}`);
  }
  values.push(limit, offset);
  try {
    const result = await database.query(
      `SELECT id, email, role, is_active, created_at, updated_at,
              COUNT(*) OVER()::integer AS total_count
       FROM user_account
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const total = result.rows[0]?.total_count || 0;
    res.json({ success: true, total, users: result.rows.map(({ total_count, ...user }) => user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit-log', requireAuthentication, requirePermission('users:assign_role'), async (req, res, next) => {
  const parsed = adminListQuerySchema.pick({ limit: true, offset: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Paramètres de pagination invalides' });
  const { limit, offset } = parsed.data;
  try {
    const result = await database.query(
      `SELECT audit_log.id, audit_log.action, audit_log.details, audit_log.created_at,
              actor.email AS actor_email, target.email AS target_email
       FROM audit_log
       LEFT JOIN user_account actor ON actor.id = audit_log.actor_user_id
       LEFT JOIN user_account target ON target.id = audit_log.target_user_id
       ORDER BY audit_log.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ success: true, events: result.rows });
  } catch (error) {
    next(error);
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

app.patch('/api/admin/users/:userId/role', requireAuthentication, requirePermission('users:assign_role'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.userId).success) return res.status(400).json({ success: false, message: 'Identifiant utilisateur invalide' });
  const parsed = userRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Rôle utilisateur invalide' });
  if (req.params.userId === req.auth.userId) return res.status(409).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE user_account SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, email, role, is_active', [parsed.data.role, req.params.userId]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_user_id, details)
       VALUES ($1, 'user.role_updated', $2, $3::jsonb)`,
      [req.auth.userId, req.params.userId, JSON.stringify({ role: parsed.data.role })]
    );
    await client.query('COMMIT');
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/orders', requireAuthentication, requirePermission('orders:create'), async (req, res, next) => {
  if (!requireDatabase(res)) return;
  const parsedOrder = orderSchema.safeParse(req.body);
  if (!parsedOrder.success) {
    return res.status(400).json({ success: false, message: 'Commande invalide', errors: parsedOrder.error.flatten().fieldErrors });
  }

  const { customer, currency, paymentProvider, items } = parsedOrder.data;
  if (paymentProvider === 'paypal' && currency === 'CDF') {
    return res.status(400).json({
      success: false,
      message: 'PayPal ne prend pas en charge le CDF. Sélectionnez USD ou EUR.'
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
      'SELECT id, price_usd, stock_qty FROM product WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE',
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

    await client.query('UPDATE customer SET full_name = $1, phone = $2, email = COALESCE($3, email) WHERE id = $4', [customer.fullName, customer.phone, customer.email || null, req.auth.customerId]);
    const rateResult = await client.query('SELECT units_per_usd FROM currency_rate WHERE currency = $1', [currency]);
    if (rateResult.rowCount !== 1) throw new Error('Devise indisponible');
    const rate = Number(rateResult.rows[0].units_per_usd);
    let subtotalUsd = 0;
    for (const [productId, qty] of quantities) {
      subtotalUsd += Number(products.get(productId).price_usd) * qty;
    }
    const subtotal = Number((subtotalUsd * rate).toFixed(2));
    const orderResult = await client.query(
      'INSERT INTO orders (customer_id, currency, subtotal_amount, total_amount) VALUES ($1, $2, $3, $3) RETURNING id, status, total_amount, currency',
      [req.auth.customerId, currency, subtotal]
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
    res.status(201).json({ success: true, order: { id: order.id, status: order.status, totalAmount: order.total_amount, currency: order.currency, paymentProvider } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/orders/:orderId/paypal', requireAuthentication, requirePermission('payments:create_own'), async (req, res, next) => {
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
    next(error);
  }
});

app.post('/api/orders/:orderId/stripe', requireAuthentication, requirePermission('payments:create_own'), async (req, res, next) => {
  if (!requireDatabase(res)) return;
  if (!stripe) return res.status(503).json({ success: false, message: 'Paiement par carte non configuré' });
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  try {
    const paymentResult = await database.query(
      `SELECT payment.id, payment.amount, payment.currency, payment.provider
       FROM payment JOIN orders ON orders.id = payment.order_id
       WHERE payment.order_id = $1 AND orders.customer_id = $2
         AND payment.provider IN ('stripe_card', 'google_pay') AND payment.status = 'pending'`,
      [req.params.orderId, req.auth.customerId]
    );
    if (paymentResult.rowCount !== 1) return res.status(404).json({ success: false, message: 'Paiement Stripe introuvable ou déjà traité' });
    const payment = paymentResult.rows[0];
    if (!['USD', 'EUR'].includes(payment.currency.trim())) return res.status(400).json({ success: false, message: 'La carte bancaire et Google Pay acceptent USD ou EUR uniquement.' });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: payment.currency.trim().toLowerCase(),
          product_data: { name: `Commande MonChantier ${req.params.orderId.slice(0, 8)}` },
          unit_amount: Math.round(Number(payment.amount) * 100)
        },
        quantity: 1
      }],
      metadata: { orderId: req.params.orderId, paymentId: payment.id },
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-success.html?provider=stripe&orderId=${req.params.orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/cart.html?payment=cancelled`
    });
    await database.query('UPDATE payment SET provider_reference = $1, updated_at = now() WHERE id = $2', [session.id, payment.id]);
    res.json({ success: true, checkoutUrl: session.url });
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', requireAuthentication, requireAnyPermission('orders:read_own', 'orders:read_operational', 'orders:read_all'), async (req, res, next) => {
  const canReadOwn = hasPermission(req.auth.role, 'orders:read_own');
  const canReadOperational = hasPermission(req.auth.role, 'orders:read_operational');
  const canReadAll = hasPermission(req.auth.role, 'orders:read_all');
  const status = z.enum(['pending', 'confirmed', 'delivering', 'completed', 'cancelled']).safeParse(req.query.status);
  if (req.query.status && !status.success) return res.status(400).json({ success: false, message: 'Statut de commande invalide' });
  const filters = [];
  const values = [];
  if (canReadOwn) {
    values.push(req.auth.customerId);
    filters.push(`orders.customer_id = $${values.length}`);
  } else if (canReadOperational) {
    values.push(req.auth.userId);
    filters.push(`(orders.assigned_to = $${values.length} OR (orders.assigned_to IS NULL AND orders.status IN ('confirmed', 'delivering')))`);
  }
  if (status.success) {
    values.push(status.data);
    filters.push(`orders.status = $${values.length}`);
  }
  try {
    const result = await database.query(`SELECT orders.id, orders.status, orders.currency, orders.total_amount, orders.created_at, orders.assigned_to, customer.full_name, customer.phone FROM orders JOIN customer ON customer.id = orders.customer_id ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY orders.created_at DESC`, values);
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:orderId/claim', requireAuthentication, requirePermission('orders:claim'), async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  try {
    const result = await database.query("UPDATE orders SET assigned_to = $1, updated_at = now() WHERE id = $2 AND assigned_to IS NULL AND status = 'confirmed' RETURNING id, status, assigned_to", [req.auth.userId, req.params.orderId]);
    if (!result.rowCount) return res.status(409).json({ success: false, message: 'Cette commande n’est plus disponible pour affectation' });
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/orders/:orderId/status', requireAuthentication, requireAnyPermission('orders:update_assigned', 'orders:update_any'), async (req, res, next) => {
  const canUpdateAny = hasPermission(req.auth.role, 'orders:update_any');
  const canUpdateAssigned = hasPermission(req.auth.role, 'orders:update_assigned');
  if (!z.string().uuid().safeParse(req.params.orderId).success) return res.status(400).json({ success: false, message: 'Identifiant de commande invalide' });
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Statut de commande invalide' });
  const allowedPreviousStatuses = { confirmed: ['pending'], delivering: ['confirmed'], completed: ['delivering'], cancelled: ['pending', 'confirmed'] };
  const values = [req.params.orderId, parsed.data.status, allowedPreviousStatuses[parsed.data.status]];
  let ownership = '';
  if (canUpdateAssigned && !canUpdateAny) {
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
    await client.query('COMMIT');
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Récupérer le panier
app.get('/api/cart/:sessionId', (req, res) => {
  const cart = carts[req.params.sessionId];
  
  if (!cart) {
    return res.json({
      success: true,
      cart: { items: [] }
    });
  }
  
  res.json({
    success: true,
    cart
  });
});

// Supprimer le panier
app.delete('/api/cart/:sessionId', (req, res) => {
  delete carts[req.params.sessionId];
  
  res.json({
    success: true,
    message: 'Panier supprimé'
  });
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  const isCorsError = err.message === 'Origine non autorisée par CORS';
  res.status(isCorsError ? 403 : 500).json({
    success: false,
    message: isCorsError ? 'Origine non autorisée' : 'Erreur interne du serveur'
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📦 ${PRODUCTS.length} produits chargés`);
  console.log(`🌍 CORS activé pour: ${allowedOrigins.join(', ')}${codespaceOriginPattern ? ' (+ ports de ce Codespace)' : ''}`);
  console.log(`🖥️  Site web servi sur http://localhost:${PORT}/`);
  syncCatalog()
    .then(() => database && console.log('🗄️  Catalogue synchronisé en base'))
    .catch((error) => console.error('⚠️  Synchronisation du catalogue impossible:', error.message));
});
