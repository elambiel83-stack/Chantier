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
-- n'a pas de sens dans un catalogue multi-vendeurs. DEFAULT sur le vendeur
-- historique : ensureCatalog() (server.js) insère aussi sans le préciser
-- explicitement pour les lignes déjà connues (ON CONFLICT DO UPDATE ne
-- touche pas organization_id, pour ne jamais écraser une réassignation
-- ultérieure à un autre vendeur).
ALTER TABLE product ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organization(id);
UPDATE product SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE product ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE product ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS product_organization_id_idx ON product(organization_id);
CREATE INDEX IF NOT EXISTS organization_member_user_id_idx ON organization_member(user_id);
CREATE INDEX IF NOT EXISTS vendor_document_organization_id_idx ON vendor_document(organization_id);
CREATE INDEX IF NOT EXISTS payout_account_organization_id_idx ON payout_account(organization_id);
CREATE INDEX IF NOT EXISTS address_organization_id_idx ON address(organization_id);

-- ============================================================================
-- Marketplace multi-vendeurs — phase 4 (éclatement des commandes par vendeur)
-- Voir docs/marketplace-schema-cible.md. Ne touche pas orders.status/assigned_to,
-- toujours la source de vérité pour le contrôle staff (claim, transitions, capture
-- PayPal) : vendor_order.status/assigned_to sont tenus en miroir par server.js dans
-- les mêmes transactions, pour rester un reflet fidèle plutôt qu'un second état à
-- faire diverger. Un paiement (`payment`) reste global à `orders`: aucune répartition
-- ni séquestre par vendeur à ce stade (voir docs/marketplace-schema-cible.md, phase 5).
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_order (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'delivering', 'completed', 'cancelled')) DEFAULT 'pending',
  -- En USD, comme order_item.unit_price_usd (le seul montant ligne à ligne déjà présent
  -- dans le schéma) : évite d'avoir à connaître le taux de change appliqué à la commande
  -- pour calculer la part de chaque vendeur.
  subtotal_amount_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, organization_id)
);

ALTER TABLE order_item ADD COLUMN IF NOT EXISTS vendor_order_id UUID REFERENCES vendor_order(id) ON DELETE CASCADE;

-- Backfill: crée un vendor_order pour chaque couple (commande, vendeur) déjà présent
-- parmi les order_item existants (une commande passée avant cette migration n'a par
-- construction qu'un seul vendeur, l'historique, mais le calcul reste général). Rejouable:
-- ON CONFLICT réutilise le vendor_order déjà créé si le script est relancé.
INSERT INTO vendor_order (order_id, organization_id, status, subtotal_amount_usd, assigned_to, created_at, updated_at)
SELECT o.id, p.organization_id, o.status, SUM(oi.qty * oi.unit_price_usd), o.assigned_to, o.created_at, o.updated_at
FROM order_item oi
JOIN orders o ON o.id = oi.order_id
JOIN product p ON p.id = oi.product_id
WHERE oi.vendor_order_id IS NULL
GROUP BY o.id, p.organization_id, o.status, o.assigned_to, o.created_at, o.updated_at
ON CONFLICT (order_id, organization_id) DO NOTHING;

UPDATE order_item oi
SET vendor_order_id = vo.id
FROM vendor_order vo, product p
WHERE oi.vendor_order_id IS NULL
  AND oi.product_id = p.id
  AND vo.order_id = oi.order_id
  AND vo.organization_id = p.organization_id;

ALTER TABLE order_item ALTER COLUMN vendor_order_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_order_order_id_idx ON vendor_order(order_id);
CREATE INDEX IF NOT EXISTS vendor_order_organization_id_idx ON vendor_order(organization_id);
CREATE INDEX IF NOT EXISTS vendor_order_assigned_to_idx ON vendor_order(assigned_to);
CREATE INDEX IF NOT EXISTS order_item_vendor_order_id_idx ON order_item(vendor_order_id);

-- ============================================================================
-- Marketplace multi-vendeurs — phase 5 (commission, séquestre, versement)
-- Voir docs/marketplace-schema-cible.md. Le paiement collecté (`payment`) reste global à
-- la commande (phase 4, inchangé): cette phase ajoute la couche comptable qui détermine
-- combien chaque vendeur doit toucher et en garde la trace, indépendamment du moyen
-- utilisé pour le lui reverser (manuel comme Airtel/Orange Money aujourd'hui, ou une
-- intégration automatisée — voir backend/cinetpay.js, désactivée tant qu'aucun
-- identifiant réel n'est configuré). Montants en USD, comme vendor_order.subtotal_amount_usd.
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_fee_rule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organization(id), -- NULL = taux par défaut plateforme
  rate_percent NUMERIC(6,3) NOT NULL CHECK (rate_percent >= 0),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE
);

-- Taux par défaut de lancement (décision produit, pas un choix technique): 15%.
INSERT INTO platform_fee_rule (organization_id, rate_percent)
SELECT NULL, 15
WHERE NOT EXISTS (SELECT 1 FROM platform_fee_rule WHERE organization_id IS NULL);

CREATE TABLE IF NOT EXISTS payout (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  payout_account_id UUID REFERENCES payout_account(id),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd >= 0),
  method TEXT NOT NULL CHECK (method IN ('manual', 'cinetpay_transfer')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed')) DEFAULT 'pending',
  provider_reference TEXT,
  recorded_by UUID REFERENCES user_account(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Une ligne par vendor_order confirmé (paiement encaissé): calculée à la confirmation,
-- pas à la création de la commande, pour ne prélever de commission que sur ce qui est
-- réellement payé. escrow_status passe à 'released' quand la livraison est confirmée
-- (vendor_order 'completed') — avant cela les fonds restent conceptuellement dus mais non
-- exigibles, pour se prémunir d'un remboursement/litige avant livraison.
CREATE TABLE IF NOT EXISTS payment_split (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id) ON DELETE CASCADE UNIQUE,
  gross_amount_usd NUMERIC(14,2) NOT NULL,
  commission_rate_percent NUMERIC(6,3) NOT NULL,
  commission_amount_usd NUMERIC(14,2) NOT NULL,
  net_amount_usd NUMERIC(14,2) NOT NULL,
  escrow_status TEXT NOT NULL CHECK (escrow_status IN ('held', 'released')) DEFAULT 'held',
  released_at TIMESTAMPTZ,
  payout_id UUID REFERENCES payout(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal append-only: trace de chaque mouvement comptable, indépendante des statuts
-- mutables ci-dessus. Jamais mis à jour ni supprimé, seulement complété.
CREATE TABLE IF NOT EXISTS ledger_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('commission_charged', 'commission_reversed', 'escrow_released', 'vendor_payout')),
  organization_id UUID REFERENCES organization(id),
  vendor_order_id UUID REFERENCES vendor_order(id),
  amount_usd NUMERIC(14,2) NOT NULL,
  reference_table TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_organization_id_idx ON payout(organization_id);
CREATE INDEX IF NOT EXISTS payment_split_escrow_status_idx ON payment_split(escrow_status);
CREATE INDEX IF NOT EXISTS payment_split_payout_id_idx ON payment_split(payout_id);
CREATE INDEX IF NOT EXISTS ledger_entry_organization_id_idx ON ledger_entry(organization_id);
CREATE INDEX IF NOT EXISTS ledger_entry_vendor_order_id_idx ON ledger_entry(vendor_order_id);

-- ============================================================================
-- Marketplace multi-vendeurs — phase 6 (prestations sur devis et rendez-vous de visite)
-- Volontairement séparé de `product`: une prestation qui nécessite une visite de terrain
-- n'a pas de prix connu à l'avance (ni de stock), donc ne peut pas passer par le panier/
-- verrouillage de stock existant. Le prix se fixe après la visite (quoted_amount_usd sur
-- le rendez-vous) — convertir ce devis en commande payante reste hors périmètre de cette
-- phase (voir docs/marketplace-schema-cible.md, quote_request/quote de la cible complète).
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_offering (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'services',
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- organization_id dupliqué depuis service_offering: évite une jointure supplémentaire pour
-- filtrer "les rendez-vous de mon organisation", le cas d'accès le plus fréquent.
CREATE TABLE IF NOT EXISTS service_appointment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_offering_id UUID NOT NULL REFERENCES service_offering(id),
  organization_id UUID NOT NULL REFERENCES organization(id),
  customer_id UUID NOT NULL REFERENCES customer(id),
  requested_by UUID NOT NULL REFERENCES user_account(id),
  status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'requested',
  requested_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  site_line1 TEXT NOT NULL,
  site_city TEXT NOT NULL,
  site_country_code CHAR(2) NOT NULL REFERENCES country(code),
  site_latitude DOUBLE PRECISION,
  site_longitude DOUBLE PRECISION,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  quoted_amount_usd NUMERIC(14,2),
  quote_note TEXT,
  assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_offering_organization_id_idx ON service_offering(organization_id);
CREATE INDEX IF NOT EXISTS service_appointment_service_offering_id_idx ON service_appointment(service_offering_id);
CREATE INDEX IF NOT EXISTS service_appointment_organization_id_idx ON service_appointment(organization_id);
CREATE INDEX IF NOT EXISTS service_appointment_customer_id_idx ON service_appointment(customer_id);
CREATE INDEX IF NOT EXISTS service_appointment_status_idx ON service_appointment(status);

-- ============================================================================
-- Marketplace multi-vendeurs — phase 7 (conversion d'un devis chiffré en commande)
-- Réutilise orders/vendor_order/order_item/payment tels quels (un devis complété devient
-- une commande à un seul vendeur, une seule ligne) plutôt qu'un chemin de paiement
-- parallèle: la capture PayPal, les transitions de statut, le calcul de commission et le
-- séquestre (phases 4-5) s'appliquent donc sans aucune modification.
-- ============================================================================

ALTER TABLE order_item ADD COLUMN IF NOT EXISTS service_offering_id UUID REFERENCES service_offering(id);
ALTER TABLE order_item ADD COLUMN IF NOT EXISTS service_appointment_id UUID REFERENCES service_appointment(id);

-- Une ligne de commande vient soit du catalogue produit, soit d'un devis de prestation
-- (jamais les deux, jamais ni l'un ni l'autre).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_item_product_xor_service') THEN
    ALTER TABLE order_item ADD CONSTRAINT order_item_product_xor_service CHECK (
      (product_id IS NOT NULL AND service_offering_id IS NULL AND service_appointment_id IS NULL) OR
      (product_id IS NULL AND service_offering_id IS NOT NULL AND service_appointment_id IS NOT NULL)
    );
  END IF;
END $$;

-- Un seul order_item par rendez-vous: empêche de convertir deux fois le même devis en
-- commande (index unique plutôt qu'une contrainte de table: NULL multiples autorisés,
-- seules les lignes "service" sont concernées).
CREATE UNIQUE INDEX IF NOT EXISTS order_item_service_appointment_id_unique_idx ON order_item(service_appointment_id) WHERE service_appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_item_service_offering_id_idx ON order_item(service_offering_id);
