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
-- NULL = catalogue MonChantier (comportement historique, voir PRODUCTS/ensureCatalog).
-- Non-NULL = produit/service publié par un partenaire de la marketplace (voir table
-- vendor ci-dessous et POST/PATCH /api/vendor/products).
ALTER TABLE product ADD COLUMN IF NOT EXISTS vendor_id UUID;
-- Permet à un partenaire de suspendre une annonce sans la supprimer (ce qui casserait la
-- référence order_item.product_id des commandes déjà passées).
ALTER TABLE product ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

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

-- 'vendor': partenaire de la marketplace (transporteur, fournisseur, artisan, vendeur de
-- matériaux...) — voir table vendor ci-dessous. Retirer/ajouter la contrainte avant de la
-- recréer, sans quoi le second déploiement échouerait ("constraint already exists").
ALTER TABLE user_account DROP CONSTRAINT IF EXISTS user_account_role_check;
ALTER TABLE user_account ADD CONSTRAINT user_account_role_check CHECK (role IN ('customer', 'staff', 'admin', 'vendor'));

-- Profil partenaire (marketplace multi-vendeurs): un compte 'vendor' publie son propre
-- catalogue (product.vendor_id) et gère la préparation de ses articles sur les commandes
-- (order_item.vendor_id/vendor_status) — MonChantier reste l'unique vendeur légal et
-- collecteur du paiement (voir web/terms.html), les partenaires ne sont pas payés
-- automatiquement par ce système, comme Airtel/Orange Money aujourd'hui.
CREATE TABLE IF NOT EXISTS vendor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES user_account(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  -- Réutilise les catégories déjà utilisées par product.category: un partenaire "vendeur
  -- de matériaux" publie en 'produits', un "transporteur"/"artisan" plutôt en 'services'
  -- ou 'partenaires' — pas de nomenclature séparée à maintenir.
  category TEXT NOT NULL CHECK (category IN ('produits', 'services', 'facilitation', 'partenaires')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_vendor_id_fkey') THEN
    ALTER TABLE product ADD CONSTRAINT product_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendor(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS product_vendor_id_idx ON product(vendor_id);

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

-- Le panier par session ci-dessus n'a jamais été branché au code applicatif (le panier
-- vivait en mémoire dans server.js, jamais dans ces tables) : remplacé par un panier par
-- compte, synchronisable entre appareils (GET/PUT/DELETE /api/cart). Migration à usage
-- unique: schema.sql étant rejoué à chaque déploiement, le DROP ne doit s'exécuter que la
-- toute première fois (tant que cart_item a encore l'ancienne forme par session) — sans
-- cette garde, chaque redéploiement suivant effacerait le panier de tout le monde.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_item' AND column_name = 'cart_session_id'
  ) THEN
    DROP TABLE IF EXISTS cart_item;
    DROP TABLE IF EXISTS cart;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cart_item (
  user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
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

-- Position de livraison partagée par le client au moment de la commande (bouton "Partager ma
-- position", géolocalisation du navigateur/appareil) — optionnelle, une commande reste possible
-- sans elle (numéro de téléphone/adresse verbale restent le repli habituel dans ce marché).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION CHECK (delivery_latitude BETWEEN -90 AND 90);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION CHECK (delivery_longitude BETWEEN -180 AND 180);

-- Position en direct du livreur (partagée par le staff assigné depuis web/admin.html
-- pendant qu'une commande est confirmée/en livraison) — distincte de delivery_latitude/
-- longitude ci-dessus, qui est la destination fournie par le client. Repose sur un
-- partage volontaire et répété (PATCH /api/orders/:id/location) plutôt qu'un suivi
-- permanent en arrière-plan.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_latitude DOUBLE PRECISION CHECK (driver_latitude BETWEEN -90 AND 90);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_longitude DOUBLE PRECISION CHECK (driver_longitude BETWEEN -180 AND 180);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_location_updated_at TIMESTAMPTZ;
-- Évite de renvoyer une notification de retard à chaque balayage tant que la position n'a
-- pas été rafraîchie depuis la dernière alerte (voir checkDeliveryDelays dans server.js).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delay_notified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  qty NUMERIC(12,3) NOT NULL,
  unit_price_usd NUMERIC(10,2) NOT NULL
);

-- Copié depuis product.vendor_id au moment de la commande (dénormalisé, comme
-- unit_price_usd ci-dessus): un partenaire qui change/supprime un produit plus tard ne
-- doit pas perdre la trace de qui devait fournir une ligne déjà commandée. vendor_status
-- suit la préparation de CETTE ligne par le partenaire, indépendamment de orders.status
-- (piloté par le staff/admin) — permet à plusieurs partenaires de préparer leurs articles
-- en parallèle sur une même commande.
ALTER TABLE order_item ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL;
ALTER TABLE order_item ADD COLUMN IF NOT EXISTS vendor_status TEXT NOT NULL DEFAULT 'pending' CHECK (vendor_status IN ('pending', 'confirmed', 'ready', 'delivered', 'cancelled'));
CREATE INDEX IF NOT EXISTS order_item_vendor_id_idx ON order_item(vendor_id);

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

-- Ticket de support multicanal: un client connecté l'ouvre lui-même depuis le web, mais le
-- staff peut aussi en créer un pour quelqu'un qui l'a contacté par WhatsApp, e-mail ou
-- téléphone (canaux sans intégration entrante réelle dans cet environnement — voir
-- backend/notifications.js). customer_id reste NULL dans ce cas (ou pour un visiteur qui
-- écrit sans compte) et les coordonnées de contact sont alors obligatoires, faute de quoi le
-- staff n'aurait aucun moyen de recontacter la personne.
CREATE TABLE IF NOT EXISTS ticket (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'email', 'phone')),
  customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'pending', 'resolved', 'closed')) DEFAULT 'open',
  assigned_to UUID REFERENCES user_account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_contact_or_customer CHECK (
    customer_id IS NOT NULL OR (contact_name IS NOT NULL AND (contact_phone IS NOT NULL OR contact_email IS NOT NULL))
  )
);

-- Fil de messages d'un ticket. 'system' documente une action automatique (ex: changement de
-- statut) sans lui prêter un auteur humain qu'elle n'a pas. sent_via_channel distingue un
-- message réellement transmis au client par e-mail/WhatsApp/SMS (voir POST
-- /tickets/:id/messages) d'un message seulement consigné (canal 'web', ou historique d'un
-- appel téléphonique — aucune API SMS/WhatsApp entrante réelle ici).
CREATE TABLE IF NOT EXISTS ticket_message (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'staff', 'system')),
  author_user_id UUID REFERENCES user_account(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  sent_via_channel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_customer_id_idx ON ticket(customer_id);
CREATE INDEX IF NOT EXISTS ticket_assigned_to_idx ON ticket(assigned_to);
CREATE INDEX IF NOT EXISTS ticket_status_idx ON ticket(status);
CREATE INDEX IF NOT EXISTS ticket_message_ticket_id_idx ON ticket_message(ticket_id);

CREATE INDEX IF NOT EXISTS product_category_idx ON product(category);
CREATE INDEX IF NOT EXISTS import_request_customer_id_idx ON import_request(customer_id);
CREATE INDEX IF NOT EXISTS import_request_assigned_to_idx ON import_request(assigned_to);
CREATE INDEX IF NOT EXISTS import_request_status_idx ON import_request(status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_assigned_to_idx ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS payment_order_id_idx ON payment(order_id);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS verification_code_user_id_idx ON verification_code(user_id);
CREATE INDEX IF NOT EXISTS cart_item_user_id_idx ON cart_item(user_id);
