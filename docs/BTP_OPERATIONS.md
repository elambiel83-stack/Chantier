# Devis, missions et règlements BTP

Accès : `web/operations.html`, depuis l’accueil, le compte, les commandes et les espaces administrateur/partenaire.

## Parcours
1. Le client connecté crée une demande avec sa destination. L’administrateur peut aussi saisir une demande pour un client inscrit.
2. L’administrateur confirme la disponibilité, prépare les lignes (produit ou service), le coût fournisseur, la commission, le transport, les conditions et une date de validité. Chaque sauvegarde crée une révision immuable ; un brouillon reste privé.
3. Le client accepte ou refuse la version envoyée. Une version dépassée ou expirée ne peut pas être acceptée. Les coûts fournisseurs et la commission interne restent réservés à l’administrateur.
4. Après acceptation, l’administrateur crée la commande et choisit le moyen de paiement convenu. Le stock physique des produits doit être renseigné et suffisant : réservation et commande se font dans une transaction. Relancer la conversion ne crée pas de doublon. Les services peuvent être chiffrés sans produit à réserver.
5. Pour une commande confirmée, l’administrateur attribue une mission à un transporteur partenaire actif et, éventuellement, à un chauffeur (compte `staff`). La mission passe de « attribuée » à « en route », puis « livrée » avec une preuve de réception. Seul l’administrateur la termine.
6. La clôture de la commande reste distincte de celle d’une mission, car une commande peut mobiliser plusieurs intervenants.
7. Pour une commande terminée en USD, l’administrateur crée les montants dus aux fournisseurs des lignes ou aux transporteurs ayant terminé leur mission. Leur somme ne peut pas dépasser le total client. Le règlement ne peut être marqué payé qu’après confirmation intégrale du paiement client et saisie d’une référence unique du transfert réellement effectué.

**Le module des règlements est un registre : il ne déclenche aucun virement.** La conversion d’un devis prépare un paiement en attente ; elle ne simule pas une réception de fonds. Les parcours de paiement existants restent utilisés.

## Accès
| Compte | Accès |
| --- | --- |
| Client | Ses demandes, version publique du devis et décision ; ses missions en consultation |
| Partenaire (`vendor`) | Ses missions de transport, progression et preuve ; ses règlements en consultation |
| Chauffeur (`staff`) | Missions qui lui sont attribuées, progression et preuve |
| Administrateur | Chiffrage, commande, stock plateforme, attribution/clôture, règlements et historique |

Les contrôles sont appliqués côté serveur. Les listes affichent les 200 opérations les plus récentes ; l’annuaire administratif affiche jusqu’à 500 entrées par type. La pagination et la recherche restent à ajouter.

## Calcul et traçabilité
Montants USD calculés en cents, quantités limitées à trois décimales. Commission = sous-total fournisseur × taux ; le transport s’ajoute ensuite sans majoration. Arrondi commercial à chaque ligne et sur la commission. Exemple : 100 × 1,30 USD + 10 % + 20 USD de transport = 163 USD. Le prix contractuel dépend des conditions validées sur le devis.

L’acceptation porte sur une version précise. Les événements devis/missions/règlements sont enregistrés avec l’acteur et la date dans `btp_operation_event`. Les montants des lignes acceptées sont conservés dans la commande ; les modifications ultérieures du catalogue n’en changent pas le descriptif ou le total.

## API
Toutes les routes sont sous `/api/btp`, authentifiées.
- `GET /directory` : annuaire administratif.
- `GET/POST /quotes`, `GET /quotes/:id` : demandes et consultation.
- `POST /quotes/:id/revisions`, `/decision`, `/cancel`, `/order` : révisions, acceptation/refus, annulation, conversion.
- `PATCH /stock/:id` : stock physique des produits plateforme, administrateur uniquement.
- `GET/POST /missions`, `PATCH /missions/:id/status` : attribution et exécution.
- `GET/POST /settlements`, `PATCH /settlements/:id/status` : dus et paiements constatés.
- `GET /events/:type/:id` : historique administratif.

## Déploiement et vérification
Rejouer le schéma idempotent sur une base existante :
```sh
psql "$DATABASE_URL" -f backend/schema.sql
```
Le conteneur backend Docker le rejoue au démarrage ; les hébergements exécutant directement Node doivent appliquer cette migration. Aucun déploiement ni changement de base de production n’est effectué par la simple publication du code.

`npm test --prefix backend` vérifie le calcul, les migrations rejouées, les transactions avec PostgreSQL embarqué PGlite, les accès entre comptes, les stocks insuffisants, les versions expirées, les références de règlement et les interactions DOM selon le rôle. Ces tests ne remplacent pas une recette sur hébergement réel avec les prestataires de paiement, ni des essais de concurrence sur PostgreSQL déployé ou une inspection visuelle sur téléphone.
