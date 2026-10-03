# Fiches partenaires et demandes par métier

## Parcours livré
- Le partenaire inscrit et actif ouvre **Ma fiche métier** (`web/partner-profile.html`). Il sélectionne un ou plusieurs métiers, puis renseigne ses spécialités, zones, présentation, références publiques, conditions tarifaires indicatives et disponibilité.
- Il décide de publier ou de garder sa fiche privée. Aucune fiche ni référence fictive n’est créée. Les informations sont déclaratives, sans badge de certification automatique ; aucun téléphone, e-mail, document privé ou identifiant de compte n’est publié.
- Le client visite **Trouver un professionnel BTP** (`web/professionals.html`) et filtre par métier, spécialité/entreprise, zone et disponibilité. Les résultats sont paginés par 20.
- Depuis la fiche, il demande un devis au partenaire choisi. Après connexion, ce choix est conservé. La demande porte le partenaire et, si la recherche en précisait un, son métier. Le serveur refuse un partenaire masqué/suspendu ou un métier qu’il ne propose pas.
- L’administrateur consulte le destinataire demandé dans le détail du devis et prépare la proposition dans le module des opérations. Les conditions déclarées sur la fiche ne constituent pas le prix contractuel : le devis accepté fait foi. Le destinataire est une préférence client ; il ne crée pas automatiquement une commande ni une attribution logistique.
- Le partenaire voit les 200 demandes les plus récentes adressées à son entreprise depuis sa fiche. Il contacte l’équipe Chantier.online pour préparer sa proposition. Il n’accède pas aux devis d’autres entreprises ni aux coûts/commissions internes. Les coordonnées privées du client ne sont pas exposées dans cette liste.

## Métiers
La nomenclature reprend les 22 catégories `metiers` du catalogue et ajoute 14 domaines : transport, logistique/manutention, terrassement/conduite d’engins, charpente/couverture, soudure/ferronnerie, étanchéité, solaire, HSE, contrôle qualité/supervision, forage/pompage/exhaure, nettoyage, production, commerce de matériaux et location. Les spécialités libres précisent les interventions au sein de chaque domaine. Tous les profils conservent le rôle technique `vendor` ; les spécialités ne donnent aucun droit administratif supplémentaire.

## API et données
- `GET /api/trades` : nomenclature.
- `GET /api/partners?trade=…&zone=…&q=…&availability=…&page=1` : fiches publiées et actives ; recherche textuelle littérale insensible à la casse (sans expansion des caractères SQL `%` et `_`).
- `GET /api/partners/:id` : fiche publique.
- `GET/PUT /api/vendor/profile` : lecture/modification de sa propre fiche uniquement. L’identifiant du partenaire vient de la session, jamais du formulaire.
- `GET /api/vendor/quote-requests` : demandes adressées à son entreprise.
- `POST /api/btp/quotes` accepte les champs facultatifs `targetVendorId` et `requestedTradeId`. Le client est déterminé par la session.

`vendor_public_profile` conserve les domaines et informations publiques. `btp_quote.target_vendor_id` et `requested_trade_id` conservent le ciblage. Suspendre le partenaire, désactiver son compte ou retirer le rôle `vendor` masque sa fiche. La suspension du partenaire bloque aussi la modification de sa fiche et les nouvelles demandes ciblées.

## Déploiement
Rejouer `backend/schema.sql` avant de servir cette version sur une base existante :
```sh
psql "$DATABASE_URL" -f backend/schema.sql
```
Docker backend le fait au démarrage ; un hébergement Node direct doit le faire explicitement. Le code est distinct du déploiement : aucune migration de production n’est exécutée par un commit GitHub.

## Vérification et limites
Les tests PostgreSQL embarqués vérifient la publication volontaire, les filtres, le cloisonnement, le retrait de fiche, la suspension et les demandes ciblées. Les tests DOM vérifient les filtres, l’échappement des contenus, la sauvegarde et le passage du choix dans la demande de devis. La vérification visuelle sur appareil réel reste à faire.

Restent à développer : validation documentaire des qualifications, galerie de réalisations, avis clients vérifiés, propositions tarifaires directement rattachées à une demande et notifications aux partenaires. Le suivi du devis et la publication dans l’espace sont déjà disponibles, sans envoi automatique d’e-mail/SMS/WhatsApp.
