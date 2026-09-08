-- ============================================================================
-- Chantier — schéma cible : marketplace multi-vendeurs internationale (BTP)
-- ============================================================================
-- Ceci est un schéma de CONCEPTION, pas la base vivante (backend/schema.sql).
-- Il décrit la structure de données vers laquelle migrer pour transformer
-- l'e-commerce mono-vendeur actuel en place de marché multi-vendeurs de
-- classe internationale pour le secteur construction/BTP. Voir
-- docs/marketplace-schema-cible.md pour le raisonnement, le mapping avec le
-- schéma actuel et un phasage de migration réaliste.
--
-- Ordre des sections = ordre de création valide (dépendances FK respectées).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Référentiels internationaux
-- ============================================================================
-- Remplace les CHECK (currency IN (...)) figés du schéma actuel : ajouter un
-- pays ou une devise devient une insertion, plus une migration.

CREATE TABLE country (
  code CHAR(2) PRIMARY KEY,                 -- ISO 3166-1 alpha-2
  name TEXT NOT NULL,
  phone_prefix TEXT,
  region TEXT                                -- regroupement libre (zones de livraison/taxes)
);

CREATE TABLE currency (
  code CHAR(3) PRIMARY KEY,                  -- ISO 4217
  decimal_places SMALLINT NOT NULL DEFAULT 2, -- 0 pour JPY/CDF-like, 3 pour BHD...
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE currency_rate (
  currency CHAR(3) PRIMARY KEY REFERENCES currency(code),
  units_per_usd NUMERIC(18,6) NOT NULL CHECK (units_per_usd > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locale (
  code TEXT PRIMARY KEY,                     -- BCP 47 : fr, en, pt-BR, sw, ar...
  name TEXT NOT NULL
);

-- Un taux par pays/région/catégorie : la TVA/GST varie par juridiction ET par
-- type de bien (le ciment n'est pas toujours taxé comme la prestation de pose).
CREATE TABLE tax_rate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code CHAR(2) NOT NULL REFERENCES country(code),
  region TEXT,                               -- état/province si taxation infranationale
  product_category TEXT,                     -- NULL = taux par défaut du pays
  rate_percent NUMERIC(6,3) NOT NULL CHECK (rate_percent >= 0),
  tax_type TEXT NOT NULL CHECK (tax_type IN ('vat', 'sales_tax', 'gst', 'none')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE
);

-- ============================================================================
-- 2. Identité, organisations, comptes
-- ============================================================================
-- "organization" est l'entité pivot du marketplace : un vendeur, un acheteur
-- professionnel (entreprise de construction), ou les deux. Un particulier
-- reste un simple "customer", comme aujourd'hui.

CREATE TABLE organization (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  org_type TEXT NOT NULL CHECK (org_type IN ('vendor', 'buyer', 'both')),
  country_code CHAR(2) NOT NULL REFERENCES country(code),
  registration_number TEXT,                  -- RCCM/SIRET/EIN/CRN... format libre selon pays
  tax_id TEXT,                                -- n° TVA intracommunautaire ou équivalent
  status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified', 'suspended', 'rejected'))
    DEFAULT 'pending_verification',
  default_currency CHAR(3) REFERENCES currency(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT
);

CREATE TABLE user_account (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID UNIQUE REFERENCES customer(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT,                         -- NULL si connexion Google/Apple uniquement
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff', 'admin')) DEFAULT 'customer',
  google_sub TEXT UNIQUE,
  apple_sub TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rattache un utilisateur à une (ou plusieurs) organisation(s) avec un rôle
-- métier : la même personne peut être "finance" chez un vendeur et "viewer"
-- chez un autre. Distinct de user_account.role, qui reste le rôle plateforme
-- (staff/admin Chantier), pas le rôle dans l'entreprise.
CREATE TABLE organization_member (
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  org_role TEXT NOT NULL CHECK (org_role IN ('owner', 'manager', 'sales', 'purchasing', 'finance', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Adresse internationale générique (particulier ou organisation), remplace
-- customer_address dont les champs étaient trop pauvres pour de la logistique
-- internationale (pas de code postal/région/pays structurés).
CREATE TABLE address (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
  label TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postal_code TEXT,
  country_code CHAR(2) NOT NULL REFERENCES country(code),
  google_place_id TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  CHECK ((organization_id IS NULL) <> (customer_id IS NULL))
);

CREATE TABLE refresh_token (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE verification_code (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Conformité vendeur (KYB, documents, paiement sortant)
-- ============================================================================

CREATE TABLE vendor_document (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'business_license', 'tax_certificate', 'insurance', 'trade_certification', 'id_proof', 'bank_proof'
  )),
  trade TEXT,                                 -- ex: "électricité", "soudure" si trade_certification
  file_url TEXT NOT NULL,
  issued_country CHAR(2) REFERENCES country(code),
  issued_at DATE,
  expires_at DATE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES user_account(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "details" en JSONB car le format de coordonnées de paiement varie trop par
-- pays/méthode (IBAN+BIC, routing+account number US, numéro mobile money...)
-- pour des colonnes fixes ; à chiffrer au niveau applicatif avant écriture.
CREATE TABLE payout_account (
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

-- ============================================================================
-- 4. Catalogue : produits, services, location
-- ============================================================================
-- "listing" unifie produit physique, prestation de service et location de
-- matériel sous un même socle (prix, devise, disponibilité, médias,
-- attributs) ; listing_type + les tables d'extension (rental_terms,
-- service_booking...) portent ce qui est spécifique à chaque cas. Le BTP
-- mélange constamment les trois dans un même panier (sacs de ciment + pose
-- par un artisan + location de bétonnière) : un modèle éclaté product/service
-- rendrait le panier et la commande multi-vendeurs bien plus complexes.

CREATE TABLE category (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES category(id),
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE category_translation (
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES locale(code),
  name TEXT NOT NULL,
  PRIMARY KEY (category_id, locale)
);

CREATE TABLE listing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  category_id UUID REFERENCES category(id),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'service', 'rental')),
  sku TEXT,
  unit TEXT NOT NULL,                         -- sac, m3, m2, ml, heure, jour, forfait...
  base_price NUMERIC(14,4) NOT NULL CHECK (base_price >= 0),
  base_currency CHAR(3) NOT NULL REFERENCES currency(code),
  moq NUMERIC(12,3) NOT NULL DEFAULT 1,        -- quantité minimale de commande (courant en gros BTP)
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listing_translation (
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES locale(code),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (listing_id, locale)
);

CREATE TABLE listing_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0
);

-- Attributs libres clé/valeur (résistance, grade acier, certification CE...)
-- plutôt que des colonnes fixes : le BTP a trop de familles de produits aux
-- caractéristiques hétérogènes pour un schéma rigide par catégorie.
CREATE TABLE listing_attribute (
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  attr_key TEXT NOT NULL,
  attr_value TEXT NOT NULL,
  PRIMARY KEY (listing_id, attr_key)
);

CREATE TABLE inventory (
  listing_id UUID PRIMARY KEY REFERENCES listing(id) ON DELETE CASCADE,
  warehouse_address_id UUID REFERENCES address(id),
  stock_qty NUMERIC(12,3) CHECK (stock_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rental_terms (
  listing_id UUID PRIMARY KEY REFERENCES listing(id) ON DELETE CASCADE,
  deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  late_fee_per_day NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_duration_days INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- 5. Devis et négociation (courant en BTP : gros volumes, prix à négocier)
-- ============================================================================

CREATE TABLE quote_request (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_customer_id UUID REFERENCES customer(id),
  buyer_organization_id UUID REFERENCES organization(id),
  organization_id UUID NOT NULL REFERENCES organization(id), -- vendeur sollicité
  project_description TEXT,
  site_address_id UUID REFERENCES address(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'quoted', 'accepted', 'declined', 'expired')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((buyer_customer_id IS NULL) <> (buyer_organization_id IS NULL))
);

CREATE TABLE quote_request_line (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES quote_request(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listing(id),
  free_text_description TEXT,                 -- demande hors catalogue possible
  qty NUMERIC(12,3) NOT NULL
);

CREATE TABLE quote (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES quote_request(id),
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  valid_until DATE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted'))
    DEFAULT 'draft',
  created_by UUID REFERENCES user_account(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quote_line (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listing(id),
  description TEXT NOT NULL,
  qty NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(14,4) NOT NULL
);

-- ============================================================================
-- 6. Panier et commande multi-vendeurs
-- ============================================================================
-- Un panier peut mêler plusieurs vendeurs. "orders" est le regroupement de
-- paiement/facturation vu par l'acheteur (un seul paiement possible pour tout
-- le panier) ; "vendor_order" est l'unité opérationnelle par vendeur (statut
-- de préparation/livraison, commission, versement) — c'est la pièce qui
-- manquait entièrement au schéma actuel pour être multi-vendeurs.

CREATE TABLE cart (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customer(id),
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_item (
  cart_id UUID NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listing(id),
  qty NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  PRIMARY KEY (cart_id, listing_id)
);

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_customer_id UUID REFERENCES customer(id),
  buyer_organization_id UUID REFERENCES organization(id),
  source_quote_id UUID REFERENCES quote(id),
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((buyer_customer_id IS NULL) <> (buyer_organization_id IS NULL))
);

CREATE TABLE vendor_order (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization(id),
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'shipped', 'delivering', 'delivered',
    'completed', 'cancelled', 'disputed'
  )) DEFAULT 'pending',
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_rate_percent NUMERIC(6,3) NOT NULL,
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listing(id),
  description TEXT NOT NULL,                  -- copie figée du libellé au moment de la vente
  qty NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(14,4) NOT NULL
);

CREATE TABLE order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES user_account(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rental_booking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listing(id),
  order_item_id UUID REFERENCES order_item(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'picked_up', 'returned', 'overdue', 'cancelled'))
    DEFAULT 'reserved',
  CHECK (end_date >= start_date)
);

CREATE TABLE service_booking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listing(id),
  order_item_id UUID REFERENCES order_item(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  site_address_id UUID REFERENCES address(id),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
    DEFAULT 'scheduled'
);

-- ============================================================================
-- 7. Jalons de paiement (chantiers : acompte / avancement / solde)
-- ============================================================================
-- Un chantier ne se paie presque jamais en un seul versement. payment_schedule
-- porte cette réalité au niveau du vendor_order, indépendamment du produit.

CREATE TABLE payment_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                         -- "Acompte", "Avancement 50%", "Solde à réception"
  sequence SMALLINT NOT NULL,
  due_amount NUMERIC(14,2) NOT NULL,
  due_on DATE,
  trigger_event TEXT CHECK (trigger_event IN ('on_acceptance', 'on_site_milestone', 'on_delivery', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'invoiced', 'paid', 'overdue', 'waived')) DEFAULT 'pending',
  UNIQUE (vendor_order_id, sequence)
);

-- ============================================================================
-- 8. Paiement, séquestre, commission, versement aux vendeurs
-- ============================================================================

CREATE TABLE payment_intent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  payment_schedule_id UUID REFERENCES payment_schedule(id),
  provider TEXT NOT NULL CHECK (provider IN (
    'paypal', 'stripe', 'airtel_money', 'orange_money', 'mpesa', 'bank_transfer', 'wire_swift'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'))
    DEFAULT 'pending',
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  provider_reference TEXT UNIQUE,
  confirmation_token_hash TEXT,                -- capture sans session, comme le schéma actuel
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_fee_rule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES category(id),     -- NULL = taux par défaut plateforme
  organization_id UUID REFERENCES organization(id), -- surcharge par vendeur si négocié
  rate_percent NUMERIC(6,3) NOT NULL CHECK (rate_percent >= 0),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE
);

-- Répartit un paiement (qui peut couvrir plusieurs vendeurs dans un panier
-- mixte) entre les vendor_order concernés, avec séquestre : les fonds restent
-- "held" jusqu'à validation de livraison/jalon, puis "released" déclenche
-- l'éligibilité au versement — standard des marketplaces internationales.
CREATE TABLE payment_split (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_intent_id UUID NOT NULL REFERENCES payment_intent(id) ON DELETE CASCADE,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id),
  gross_amount NUMERIC(14,2) NOT NULL,
  commission_amount NUMERIC(14,2) NOT NULL,
  net_amount NUMERIC(14,2) NOT NULL,            -- gross - commission, dû au vendeur
  escrow_status TEXT NOT NULL CHECK (escrow_status IN ('held', 'released', 'refunded')) DEFAULT 'held',
  released_at TIMESTAMPTZ
);

CREATE TABLE payout (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  payout_account_id UUID NOT NULL REFERENCES payout_account(id),
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed')) DEFAULT 'pending',
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE payout_item (
  payout_id UUID NOT NULL REFERENCES payout(id) ON DELETE CASCADE,
  payment_split_id UUID NOT NULL REFERENCES payment_split(id),
  PRIMARY KEY (payout_id, payment_split_id)
);

-- Grand livre append-only : source de vérité comptable, indépendante des
-- statuts mutables ci-dessus. Toute écriture financière (encaissement,
-- commission prélevée, versement, remboursement) y laisse une trace
-- immuable — nécessaire pour l'audit et la réconciliation multi-devises
-- d'une place de marché internationale.
CREATE TABLE ledger_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'payment_received', 'commission_charged', 'vendor_payout', 'refund', 'chargeback', 'adjustment'
  )),
  organization_id UUID REFERENCES organization(id),
  vendor_order_id UUID REFERENCES vendor_order(id),
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL REFERENCES currency(code),
  reference_table TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. Fiscalité appliquée aux commandes
-- ============================================================================

CREATE TABLE order_tax_line (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id) ON DELETE CASCADE,
  tax_rate_id UUID NOT NULL REFERENCES tax_rate(id),
  taxable_amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) NOT NULL
);

-- ============================================================================
-- 10. Logistique
-- ============================================================================
-- Les matériaux BTP sont lourds/volumineux et parfois transfrontaliers : un
-- envoi peut comporter plusieurs étapes (site vendeur -> transporteur routier
-- -> douane -> livraison chantier), d'où shipment_leg plutôt qu'un statut
-- plat unique.

CREATE TABLE carrier (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tracking_url_template TEXT
);

CREATE TABLE shipping_zone (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organization(id),
  country_code CHAR(2) REFERENCES country(code),
  region TEXT
);

CREATE TABLE shipping_rate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_zone_id UUID NOT NULL REFERENCES shipping_zone(id) ON DELETE CASCADE,
  min_weight_kg NUMERIC(10,2),
  max_weight_kg NUMERIC(10,2),
  price NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL REFERENCES currency(code)
);

CREATE TABLE shipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id),
  carrier_id UUID REFERENCES carrier(id),
  tracking_number TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'label_created', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'failed'
  )) DEFAULT 'label_created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipment_leg (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  sequence SMALLINT NOT NULL,
  from_address_id UUID REFERENCES address(id),
  to_address_id UUID REFERENCES address(id),
  status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ
);

-- ============================================================================
-- 11. Confiance : avis et litiges
-- ============================================================================

CREATE TABLE review (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id), -- garantit "achat vérifié"
  organization_id UUID NOT NULL REFERENCES organization(id), -- vendeur noté
  listing_id UUID REFERENCES listing(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  vendor_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_order_id, listing_id)
);

CREATE TABLE dispute (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID NOT NULL REFERENCES vendor_order(id),
  opened_by UUID NOT NULL REFERENCES user_account(id),
  reason TEXT NOT NULL CHECK (reason IN ('not_delivered', 'damaged', 'wrong_item', 'quality', 'payment', 'other')),
  status TEXT NOT NULL CHECK (status IN (
    'open', 'under_review', 'resolved_refund', 'resolved_replacement', 'resolved_denied', 'closed'
  )) DEFAULT 'open',
  resolved_by UUID REFERENCES user_account(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dispute_message (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES dispute(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES user_account(id),
  body TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. Messagerie acheteur/vendeur
-- ============================================================================

CREATE TABLE conversation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID REFERENCES vendor_order(id),
  quote_request_id UUID REFERENCES quote_request(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (vendor_order_id IS NOT NULL OR quote_request_id IS NOT NULL)
);

CREATE TABLE message (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_account(id),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. Audit
-- ============================================================================

CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES user_account(id),
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. Index
-- ============================================================================

CREATE INDEX organization_member_user_idx ON organization_member(user_id);
CREATE INDEX address_organization_idx ON address(organization_id);
CREATE INDEX address_customer_idx ON address(customer_id);
CREATE INDEX vendor_document_organization_idx ON vendor_document(organization_id);
CREATE INDEX payout_account_organization_idx ON payout_account(organization_id);
CREATE INDEX listing_organization_idx ON listing(organization_id);
CREATE INDEX listing_category_idx ON listing(category_id);
CREATE INDEX quote_request_organization_idx ON quote_request(organization_id);
CREATE INDEX cart_item_listing_idx ON cart_item(listing_id);
CREATE INDEX orders_buyer_customer_idx ON orders(buyer_customer_id);
CREATE INDEX orders_buyer_organization_idx ON orders(buyer_organization_id);
CREATE INDEX vendor_order_order_idx ON vendor_order(order_id);
CREATE INDEX vendor_order_organization_idx ON vendor_order(organization_id);
CREATE INDEX vendor_order_assigned_to_idx ON vendor_order(assigned_to);
CREATE INDEX order_item_vendor_order_idx ON order_item(vendor_order_id);
CREATE INDEX order_status_history_vendor_order_idx ON order_status_history(vendor_order_id);
CREATE INDEX payment_schedule_vendor_order_idx ON payment_schedule(vendor_order_id);
CREATE INDEX payment_intent_order_idx ON payment_intent(order_id);
CREATE INDEX payment_split_payment_intent_idx ON payment_split(payment_intent_id);
CREATE INDEX payment_split_vendor_order_idx ON payment_split(vendor_order_id);
CREATE INDEX payout_organization_idx ON payout(organization_id);
CREATE INDEX ledger_entry_organization_idx ON ledger_entry(organization_id);
CREATE INDEX ledger_entry_vendor_order_idx ON ledger_entry(vendor_order_id);
CREATE INDEX shipment_vendor_order_idx ON shipment(vendor_order_id);
CREATE INDEX review_organization_idx ON review(organization_id);
CREATE INDEX dispute_vendor_order_idx ON dispute(vendor_order_id);
CREATE INDEX message_conversation_idx ON message(conversation_id);
CREATE INDEX refresh_token_user_id_idx ON refresh_token(user_id);
CREATE INDEX verification_code_user_id_idx ON verification_code(user_id);
