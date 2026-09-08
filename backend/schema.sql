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

CREATE INDEX IF NOT EXISTS product_category_idx ON product(category);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_assigned_to_idx ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS payment_order_id_idx ON payment(order_id);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS verification_code_user_id_idx ON verification_code(user_id);

-- ============================================================================
-- Marketplace multi-vendeurs — phase 1 (fondations vendeur)
-- Voir docs/marketplace-schema-cible.sql et docs/marketplace-schema-cible.md
-- pour le schéma cible complet et le phasage. Cette phase est additive et ne
-- modifie aucune table existante en profondeur : elle introduit l'identité
-- vendeur et rattache le catalogue actuel à un vendeur "historique", sans
-- changer le nom ni la forme de `product` (le rebasculement vers `listing`
-- et l'éclatement des commandes par vendeur sont des phases ultérieures,
-- qui touchent aussi backend/server.js, web/ et mobile/).
-- ============================================================================

CREATE TABLE IF NOT EXISTS country (
  code CHAR(2) PRIMARY KEY,              -- ISO 3166-1 alpha-2
  name TEXT NOT NULL,
  phone_prefix TEXT,
  region TEXT
);

INSERT INTO country (code, name, phone_prefix, region) VALUES
  ('CD', 'République démocratique du Congo', '+243', 'Afrique centrale'),
  ('CI', 'Côte d''Ivoire', '+225', 'Afrique de l''Ouest'),
  ('CM', 'Cameroun', '+237', 'Afrique centrale'),
  ('KE', 'Kenya', '+254', 'Afrique de l''Est'),
  ('RW', 'Rwanda', '+250', 'Afrique de l''Est'),
  ('UG', 'Ouganda', '+256', 'Afrique de l''Est'),
  ('ZA', 'Afrique du Sud', '+27', 'Afrique australe'),
  ('FR', 'France', '+33', 'Europe'),
  ('BE', 'Belgique', '+32', 'Europe'),
  ('GB', 'Royaume-Uni', '+44', 'Europe'),
  ('AE', 'Émirats arabes unis', '+971', 'Moyen-Orient'),
  ('IN', 'Inde', '+91', 'Asie'),
  ('CN', 'Chine', '+86', 'Asie'),
  ('US', 'États-Unis', '+1', 'Amérique du Nord')
ON CONFLICT (code) DO NOTHING;

-- Référentiel devise à ne pas confondre avec `currency_rate` (taux de change
-- facturés) : celui-ci décrit la devise elle-même (précision décimale,
-- activation). Les colonnes `currency CHAR(3) CHECK (... IN ('USD','CDF','EUR'))`
-- des tables cart/orders/payment restent en l'état à cette phase — les faire
-- pointer vers cette table est un changement plus large qui touche aussi la
-- validation applicative (`server.js`), traité dans une phase suivante.
CREATE TABLE IF NOT EXISTS currency (
  code CHAR(3) PRIMARY KEY,
  decimal_places SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO currency (code, decimal_places, is_active) VALUES
  ('USD', 2, true), ('CDF', 2, true), ('EUR', 2, true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  org_type TEXT NOT NULL CHECK (org_type IN ('vendor', 'buyer', 'both')),
  country_code CHAR(2) NOT NULL REFERENCES country(code),
  registration_number TEXT,
  tax_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified', 'suspended', 'rejected'))
    DEFAULT 'pending_verification',
  default_currency CHAR(3) REFERENCES currency(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendeur historique : l'unique fournisseur du catalogue actuel devient une
-- organisation à part entière, déjà vérifiée puisqu'il opère depuis toujours.
-- L'UUID est fixé (pas gen_random_uuid()) pour rester stable à chaque rejeu
-- du script et permettre le backfill idempotent de product.organization_id.
INSERT INTO organization (id, legal_name, trade_name, org_type, country_code, status, default_currency)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MonChantier', 'MonChantier', 'vendor', 'CD', 'verified', 'USD'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_member (
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  org_role TEXT NOT NULL CHECK (org_role IN ('owner', 'manager', 'sales', 'purchasing', 'finance', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS vendor_document (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'business_license', 'tax_certificate', 'insurance', 'trade_certification', 'id_proof', 'bank_proof'
  )),
  trade TEXT,
  file_url TEXT NOT NULL,
  issued_country CHAR(2) REFERENCES country(code),
  issued_at DATE,
  expires_at DATE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES user_account(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `details` en JSONB : le format des coordonnées de paiement sortant varie
-- trop par pays/méthode (IBAN+BIC, routing+account number, numéro mobile
-- money) pour des colonnes fixes ; à chiffrer côté applicatif avant écriture.
CREATE TABLE IF NOT EXISTS payout_account (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN (
    'bank_transfer', 'wire_swift', 'paypal', 'airtel_money', 'orange_money', 'mpesa'
  )),
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  details JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adresse générique d'organisation (siège, entrepôt...). Distincte de
-- `customer_address` (adresses de particuliers, non modifiée ici).
CREATE TABLE IF NOT EXISTS address (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  label TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postal_code TEXT,
  country_code CHAR(2) NOT NULL REFERENCES country(code),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

-- Rattache chaque produit existant à son vendeur. Nullable le temps du
-- backfill (rejouable), puis verrouillé NOT NULL : un produit sans vendeur
-- n'a pas de sens dans un catalogue multi-vendeurs.
ALTER TABLE product ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organization(id);
UPDATE product SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE product ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS product_organization_id_idx ON product(organization_id);
CREATE INDEX IF NOT EXISTS organization_member_user_id_idx ON organization_member(user_id);
CREATE INDEX IF NOT EXISTS vendor_document_organization_id_idx ON vendor_document(organization_id);
CREATE INDEX IF NOT EXISTS payout_account_organization_id_idx ON payout_account(organization_id);
CREATE INDEX IF NOT EXISTS address_organization_id_idx ON address(organization_id);
