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

CREATE INDEX IF NOT EXISTS product_category_idx ON product(category);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_assigned_to_idx ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS payment_order_id_idx ON payment(order_id);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token(user_id);
