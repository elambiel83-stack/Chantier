# Schéma cible : marketplace multi-vendeurs internationale (BTP)

Ce document accompagne `docs/marketplace-schema-cible.sql`. C'est une proposition de
conception, vérifiée exécutable sur PostgreSQL 16 (`psql -f`), mais **pas** la base
vivante — `backend/schema.sql` reste la source de vérité tant que la migration n'est pas
décidée et menée.

## Pourquoi une refonte et pas des `ALTER TABLE`

Le schéma actuel modélise une boutique mono-vendeur : `product` n'a pas de propriétaire,
`payment` ne connaît qu'un seul flux d'argent par commande, `orders.status` est un cycle
logistique simple. Un marketplace multi-vendeurs BTP a besoin de notions qui n'existent
nulle part aujourd'hui (vendeur, commission, séquestre, devis, jalons de chantier,
litiges...). Ajouter ces notions une par une par migrations sur le schéma actuel
aboutirait à la même structure cible, en plus risqué (colonnes ajoutées après coup,
contraintes moins cohérentes). D'où un schéma cible pensé d'un bloc, à migrer en phases
(voir plus bas) plutôt qu'à coups d'`ALTER` isolés.

## Principes de conception

- **Référentiels extensibles plutôt que `CHECK (... IN (...))` figés.** `country`,
  `currency`, `locale`, `tax_rate` sont des tables, pas des énumérations en dur : ajouter
  un pays ou une devise devient une insertion, pas une migration. C'est la première chose
  qui bloquait le schéma actuel pour un usage international (devises limitées à
  USD/CDF/EUR par contrainte SQL).
- **`organization` unifie vendeur et acheteur professionnel.** Le BTP est majoritairement
  du B2B (entreprises qui achètent en gros, sous-traitent, louent du matériel) ; modéliser
  un `vendor` et un `buyer_company` séparés aurait dupliqué toute la conformité (KYB,
  adresses, membres) pour rien. `org_type` distingue les deux usages, `both` couvre le cas
  d'un vendeur qui achète aussi sur la plateforme.
- **`listing` unifie produit, service et location.** Un panier BTP mélange typiquement
  des sacs de ciment (produit), la pose par un artisan (service) et la location d'une
  bétonnière (location). Trois tables séparées auraient compliqué panier, commande et
  paiement (trois chemins différents à agréger). `listing_type` + tables d'extension
  (`rental_terms`, `rental_booking`, `service_booking`) portent ce qui est spécifique sans
  dupliquer le socle commun (prix, devise, médias, attributs).
- **`vendor_order` est la pièce manquante centrale.** `orders` reste le regroupement de
  paiement vu par l'acheteur ; chaque vendeur impliqué dans ce panier obtient son propre
  `vendor_order` avec son propre statut, sa propre commission, sa propre expédition. C'est
  ce qui rend un panier multi-vendeurs opérable : sans ça, impossible de savoir qui doit
  préparer/livrer quoi, ni combien reverser à qui.
- **Séquestre et grand livre plutôt qu'un `payment.status` unique.** `payment_split` retient
  les fonds (`escrow_status = held`) jusqu'à validation de livraison ou de jalon, puis les
  libère pour versement. `ledger_entry` est un journal append-only : chaque mouvement
  financier (encaissement, commission, versement, remboursement) y est tracé
  immuablement, indépendamment des statuts mutables des autres tables — nécessaire pour
  l'audit et la réconciliation comptable multi-devises.
- **Devis (`quote_request`/`quote`) avant commande.** Une bonne partie des transactions
  BTP (gros volumes, prestations sur mesure) se négocient avant tout paiement. Le
  parcours devient : devis → acceptation → commande, plutôt qu'achat direct uniquement.
- **Jalons de paiement (`payment_schedule`).** Un chantier se paie rarement en un seul
  versement (acompte / avancement / solde). Porté au niveau du `vendor_order`, indépendant
  du contenu de la commande.
- **`shipment_leg` plutôt qu'un statut de livraison plat.** Matériaux lourds/volumineux,
  parfois transfrontaliers : site vendeur → transporteur routier → douane → livraison
  chantier. Un seul statut ne peut pas représenter ce parcours.
- **`payout_account.details` en JSONB.** Le format de coordonnées de paiement sortant
  varie trop par pays/méthode (IBAN+BIC, routing+account number américain, numéro mobile
  money) pour des colonnes fixes ; à chiffrer côté applicatif avant écriture, jamais en
  clair.
- **`avis` (`review`) lié à `vendor_order`, pas librement postable.** Garantit l'« achat
  vérifié » : impossible de noter un vendeur sans commande réelle passée chez lui.

## Ce qui est conservé tel quel du schéma actuel

`customer`, `user_account` (auth Argon2id + JWT + refresh rotatif + OAuth Google/Apple),
`refresh_token`, `verification_code`, `currency_rate` : cette partie était déjà solide et
n'a pas de raison de changer pour devenir multi-vendeurs. Le verrouillage transactionnel
du stock (`FOR UPDATE`) reste valable, à reporter sur `inventory` (remplace
`product.stock_qty`).

## Table de correspondance avec le schéma actuel

| Actuel (`backend/schema.sql`)      | Cible                                            | Notes |
|---|---|---|
| `product`                           | `listing` + `listing_translation` + `inventory` | ajout `organization_id` (propriétaire), i18n en table séparée au lieu de `name_fr`/`name_en` |
| `customer_address`                  | `address`                                        | champs postaux structurés (pays/région/code postal), polymorphe organisation/particulier |
| `cart` / `cart_item`                | `cart` / `cart_item`                             | `cart_item.product_id` → `listing_id` |
| `orders`                            | `orders` + `vendor_order`                        | split par vendeur ajouté ; `orders` ne porte plus le statut opérationnel |
| `order_item`                        | `order_item`                                     | rattaché à `vendor_order`, pas directement à `orders` |
| `payment`                           | `payment_intent` + `payment_split`               | séparation encaissement global / répartition + commission + séquestre par vendeur |
| — (inexistant)                      | `organization`, `organization_member`, `vendor_document`, `payout_account` | identité et conformité vendeur, absentes du schéma actuel |
| — (inexistant)                      | `quote_request`, `quote`, `quote_line`           | devis, absents du schéma actuel |
| — (inexistant)                      | `payment_schedule`                               | jalons de paiement chantier |
| — (inexistant)                      | `ledger_entry`, `payout`, `platform_fee_rule`    | comptabilité marketplace, commission |
| — (inexistant)                      | `review`, `dispute`, `dispute_message`           | confiance et litiges |
| — (inexistant)                      | `conversation`, `message`                        | messagerie acheteur/vendeur |
| — (inexistant)                      | `country`, `currency` (table), `locale`, `tax_rate` | référentiels internationaux extensibles |
| — (inexistant)                      | `carrier`, `shipping_zone`, `shipping_rate`, `shipment`, `shipment_leg` | logistique multi-vendeurs et internationale |
| — (inexistant)                      | `rental_terms`, `rental_booking`, `service_booking` | location de matériel et prestations de service |
| — (inexistant)                      | `audit_log`                                      | traçabilité générique |

## Phasage de migration recommandé

Une bascule en un seul déploiement serait risquée (perte de service, backfill massif).
Découpage proposé, chaque phase livrable et testable indépendamment :

1. **Fondations vendeur** — `country`, `currency` (table), `organization`,
   `organization_member`, `vendor_document`, `payout_account`, `address`. Migrer
   `product` → `listing` avec un `organization_id` unique (le vendeur historique) pour ne
   rien casser côté catalogue existant.
2. **Commande multi-vendeurs** — `vendor_order`, éclatement de `order_item`, split des
   paiements (`payment_intent`/`payment_split`), `platform_fee_rule`. C'est la phase qui
   active réellement le multi-vendeurs pour l'acheteur.
3. **Confiance et BTP** — `quote_request`/`quote`, `payment_schedule`, `review`,
   `dispute`, `conversation`/`message`.
4. **International** — `tax_rate`, `shipping_zone`/`shipping_rate`, `shipment`/
   `shipment_leg`, `rental_*`, `service_booking`.
5. **Comptabilité** — `ledger_entry`, `payout`/`payout_item`, `audit_log` : à faire une
   fois les flux d'argent stabilisés, pour ne pas migrer un historique comptable
   incomplet.

## Hors périmètre de ce document

Ce schéma ne couvre pas la couche applicative (API, autorisation par organisation,
recalcul des commissions, moteur de matching devis) ni les choix d'infrastructure de
paiement (quel PSP supporte réellement le split/séquestre par pays — Stripe Connect,
Adyen for Platforms, etc. ont des contraintes différentes à valider avant implémentation).
