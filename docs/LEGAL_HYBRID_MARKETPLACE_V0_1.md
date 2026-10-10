# MonChantier — Modèle juridique hybride (projet v0.1)

**État : projet soumis à validation juridique en RDC. Ne pas activer automatiquement la signature ni publier comme contrat définitif.**

## Qualification par transaction
- `principal_seller` : MonChantier vend en son nom ; vendeur contractuel = MonChantier ; prix total client distinct des achats fournisseurs.
- `marketplace_agent` : partenaire vendeur/prestataire contractuel ; MonChantier facture sa commission de mise en relation ; ne pas présumer que le montant total client constitue son chiffre d'affaires.
- Transport : rôle et rémunération séparés, avec contrat, preuve de réception et responsabilité définie.

## Données à figer au moment du devis accepté
`commercial_role`, `contractual_seller_id`, `vendor_base_amount`, `platform_commission`, `transport_amount`, `tax_amount`, `currency`, `terms_version`, `accepted_at`. Ne jamais exposer le coût fournisseur aux clients.

## Admission partenaire
Statut documentaire : `pending` / `received` / `verified` / `expired` ; vérification par domaine, assurances, permis, pièces fiscales et ARSP uniquement si l'activité entre dans le champ applicable. Pas d'identifiants légaux inventés.

## Documents à préparer
Convention-cadre et annexes fournisseur/vendeur, artisan/prestataire, transporteur/logisticien. Clauses : prix, commission, TVA et fiscalité, responsabilité, sécurité chantier, qualité, livraison, annulation, avoir, remboursement, confidentialité, données personnelles, résiliation, litiges.

## Contrôles bloquants avant production
1. Impossible de publier une offre sans vendeur contractuel et rôle commercial explicites.
2. Impossible de changer le rôle après acceptation sans nouvelle acceptation.
3. Factures, règlements et écritures comptables cohérents avec le rôle commercial.
4. Aucun remboursement déclaré effectué sans preuve du prestataire de paiement.
5. Vérification du régime de sous-traitance et des règles de contenu local en vigueur au moment de la signature (réformes 2026 comprises).
6. Validation juridique et comptable locale avant signature.

Document de cadrage, non preuve d'implémentation des contrôles.
