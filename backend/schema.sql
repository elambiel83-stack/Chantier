-- MonChantier schema (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  image_url TEXT
);

-- Le catalogue devient la source de vérité du stock et des catégories.
ALTER TABLE product ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'produits';
-- Volontairement nullable: une colonne NULL signale un produit jamais initialisé, que
-- la synchronisation du catalogue amorcera; 0 signifie réellement "en rupture".
ALTER TABLE product ADD COLUMN IF NOT EXISTS stock_qty NUMERIC(12,3) CHECK (stock_qty >= 0);

CREATE TABLE IF NOT EXISTS currency_rate (
  currency CHAR(3) PRIMARY KEY CHECK (currency IN ('USD', 'CDF', 'EUR')),
  units_per_usd NUMERIC(18,6) NOT NULL CHECK (units_per_usd > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO currency_rate (currency, units_per_usd)
VALUES ('USD', 1), ('CDF', 2800), ('EUR', 0.92)
ON CONFLICT (currency) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT
);

CREATE TABLE IF NOT EXISTS user_account (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID UNIQUE REFERENCES customer(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff', 'admin')) DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Connexion Google/Apple: un compte créé par ce biais n'a pas de mot de passe, et se
-- retrouve par l'identifiant stable ('sub') que renvoie le fournisseur dans son jeton.
ALTER TABLE user_account ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS apple_sub TEXT UNIQUE;

-- NULL = jamais vérifié. Un compte Google/Apple n'a pas besoin de ce parcours (le
-- fournisseur a déjà vérifié l'e-mail) mais rien ne l'y force ici.
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_address (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
  label TEXT,
  google_place_id TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS cart (
  session_id UUID PRIMARY KEY,
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF', 'EUR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_item (
  cart_session_id UUID REFERENCES cart(session_id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  qty NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  PRIMARY KEY (cart_session_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customer(id),
  status TEXT CHECK (status IN ('pending','confirmed','delivering','completed','cancelled')) DEFAULT 'pending',
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF', 'EUR')),
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS order_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  qty NUMERIC(12,3) NOT NULL,
  unit_price_usd NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paypal', 'airtel_money', 'orange_money')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded')) DEFAULT 'pending',
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'CDF', 'EUR')),
  provider_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remplace 'mobile_money' (générique) par 'airtel_money'/'orange_money': Airtel Money et
-- Orange Money sont confirmés manuellement par le staff, pas par 'mobile_money' en général.
-- La contrainte est retirée avant la conversion des lignes existantes, sans quoi son
-- ajout échouerait sur les commandes déjà enregistrées en 'mobile_money'.
ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_provider_check;
UPDATE payment SET provider = 'airtel_money' WHERE provider = 'mobile_money';
ALTER TABLE payment ADD CONSTRAINT payment_provider_check CHECK (provider IN ('paypal', 'airtel_money', 'orange_money'));

-- Jeton à usage unique transmis dans l'URL de retour PayPal (capture sans session).
ALTER TABLE payment ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT;

-- CinetPay: agrégateur Mobile Money automatisé (voir POST /orders/{orderId}/cinetpay).
ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_provider_check;
ALTER TABLE payment ADD CONSTRAINT payment_provider_check CHECK (provider IN ('paypal', 'cinetpay', 'airtel_money', 'orange_money'));

-- Code de vérification (e-mail, SMS ou WhatsApp, au choix du client). Stocké haché comme
-- refresh_token; expire et se limite en tentatives pour résister au brute-force.
CREATE TABLE IF NOT EXISTS verification_code (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demande d'importation: le client décrit un produit repéré chez un fournisseur (lien +
-- description) plutôt que de faire confiance à un scraping automatisé du site fournisseur.
-- compliance_notes doit être renseigné (voir POST /import-requests/:id/compliance) avant
-- qu'une demande puisse passer à 'ordered' — voir server.js pour la machine à états complète.
CREATE TABLE IF NOT EXISTS import_request (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  source_url TEXT,
  description TEXT NOT NULL,
  target_qty NUMERIC(12,3) NOT NULL CHECK (target_qty > 0),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'quoted', 'compliance_cleared', 'ordered', 'delivered', 'rejected', 'cancelled')) DEFAULT 'submitted',
  quote_amount NUMERIC(14,2),
  quote_currency CHAR(3) CHECK (quote_currency IN ('USD', 'CDF', 'EUR')),
  compliance_notes TEXT,
  staff_notes TEXT,
  assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_category_idx ON product(category);
CREATE INDEX IF NOT EXISTS import_request_customer_id_idx ON import_request(customer_id);
CREATE INDEX IF NOT EXISTS import_request_assigned_to_idx ON import_request(assigned_to);
CREATE INDEX IF NOT EXISTS import_request_status_idx ON import_request(status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_assigned_to_idx ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS payment_order_id_idx ON payment(order_id);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS verification_code_user_id_idx ON verification_code(user_id);
