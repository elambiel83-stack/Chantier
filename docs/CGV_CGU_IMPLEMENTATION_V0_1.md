# CGV/CGU MonChantier — exigences d'implémentation v0.1

Statut : projet à valider juridiquement avant publication contractuelle.

## Contrôles transactionnels
Chaque offre/devis/commande doit figer avant acceptation :
- le rôle commercial (`principal_seller` ou `marketplace_agent`) ;
- le vendeur/prestataire contractuel ;
- le responsable du transport lorsqu'il existe ;
- prix, devise, taxes/frais, commission et montant total ;
- la version des CGV/CGU et l'horodatage de l'acceptation.

Une modification substantielle après acceptation impose une nouvelle acceptation.

## Paiement et remboursement
Un paiement n'est `paid` qu'après confirmation fiable du prestataire ou contrôle documenté d'un paiement manuel. Un remboursement n'est `refunded` qu'après preuve de restitution des fonds. L'avoir comptable ne vaut pas preuve de remboursement.

## Traçabilité
Conserver de façon non destructive les transitions de commande/paiement, versions contractuelles acceptées, confirmations de paiement, annulations, remboursements et preuves de livraison.

## Confidentialité
Ne jamais placer de documents administratifs sensibles dans GitHub ou un répertoire web public. Les engagements de conservation/suppression de géolocalisation doivent correspondre au comportement réel du système.

## Avant production
Compléter l'identité légale MonChantier, le régime fiscal/facturation, la politique de confidentialité, le règlement des différends et les règles spécifiques aux activités réglementées. Faire valider les textes par un juriste RDC et le traitement fiscal/comptable par un professionnel compétent.
