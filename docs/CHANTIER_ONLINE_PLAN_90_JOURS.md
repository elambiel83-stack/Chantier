# Chantier.online — réseau BTP et plan de lancement sur 90 jours

## Positionnement et périmètre
Chantier.online est le pont entre producteurs, grossistes, transporteurs,
logisticiens, acheteurs et prestataires BTP. Slogan : « Tout pour bâtir. »
Lancement Web uniquement à Kolwezi/Lualaba ; extension par zones selon les
capacités vérifiées. WhatsApp Business : +243 840 468 602 (activation à confirmer).

La plateforme sélectionne les partenaires, présente les offres, valide les
prix, prépare les devis, coordonne l'exécution et traite les réclamations.
Chaque devis doit préciser qui fournit, transporte, exécute, facture et traite
les réserves, ainsi que les fournitures et opérations exclues.

## Réseau initial
Objectifs indicatifs : 3–5 producteurs, 3–5 grossistes, 3–5 transporteurs,
1–2 logisticiens, 5–10 prestataires et 10 acheteurs pilotes. Chercher deux
sources pour chaque matériau essentiel. Ne pas publier de fausses références.

Fiche partenaire : identité/entreprise, téléphone, responsable, localisation,
zones, catégories, photos réelles, références, capacité, tarifs, durée de
validité, délai, conditions de paiement, équipements et vérification.
Statuts à mettre en œuvre : à vérifier, validé, suspendu. L'inscription seule
ne donne pas droit au badge « vérifié ».

## Catalogue de lancement
- Briques rouges : dimensions et prix à obtenir.
- Blocs creux 15 × 20 × 40 cm : 1,30 USD/pièce ; minimum 100 pièces.
- Blocs creux 20 × 20 × 40 cm : 1,50 USD/pièce ; minimum 100 pièces.
- Sable concassé, moellon, tout-venant, gravier : prix, calibre et unités à confirmer.

Le promoteur a initialement annoncé livraison incluse en RDC. Après le
recentrage sur le réseau, ne confirmer le prix livré qu'après validation du
fournisseur et du transporteur pour la destination. Aucun forfait national
non confirmé n'est présenté comme garantie. Stock non chiffré : devis requis.
Les unités des agrégats dans le catalogue sont des bases de devis, à confirmer.

Fiche produit complète : caractéristiques/dimensions, granulométrie, unité,
source, stock ou disponibilité partenaire, prix, validité, minimum, délai,
transport, déchargement et photos réelles. Un camion doit avoir une capacité
précisée ; distinguer stock propre, partenaire et sur commande.

Extensions : ciment/ferraillage ; pavés/bordures/préfabrication ; toiture/bois ;
plomberie/électricité ; carrelage/peinture/sanitaires ; outillage/EPI ;
isolation/étanchéité ; drainage/voirie ; équipements et sécurité du bâtiment.
Le catalogue BTP étendu existant est une liste de recherche, pas du stock garanti.

Services : maçonnerie, menuiserie/soudure, plomberie, électricité, transport,
manutention, location. Devis séparant fournitures, main-d'œuvre, transport,
exclusions ; visite technique lorsque nécessaire.

## Prix et rémunération
Le partenaire soumet son prix, l'administrateur vérifie et valide le prix
public. La logique existante pending/approved/rejected est conservée.
La commission existante est une majoration du coût : prix = base × (1 + taux/100).
Une marge sur prix final est un autre calcul : base / (1 - taux/100).
Ne pas confondre les deux, ni compter tout l'encaissement comme revenu.

Définir séparément base fournisseur, transport, manutention, commission,
frais de paiement, réduction et provision pour incidents ; afficher les
conditions et le total au client avant acceptation. Commencer par une
rémunération sur transactions ; abonnements partenaires à étudier après preuve
régulière de commandes. Taux exact à décider, aucun taux nouveau imposé.

## Parcours opérationnel
Demande → disponibilité/caractéristiques → chiffrage → devis à durée limitée →
acceptation → paiement/acompte convenu → confirmation partenaires → préparation/
intervention/livraison → réception avec réserves → règlement et clôture.
Toute modification après acceptation doit être acceptée avant exécution.

Transport : départ/destination, capacité utile, accessibilité, manutention,
attente, contact destinataire, délai, incident. Réception : bon, accord client,
photos avec autorisation. Réclamation liée à la commande : problème, preuves,
responsable, solution, échéance, clôture. Prévoir annulation/remboursement.

## Organisation
Administrateur principal : validation partenaires/prix/commissions/exceptions.
Commercial : demandes, devis, relances. Logistique : planning et réception.
Finance : paiements, règlements, rapprochement. Communication : contenus et
acquisition. Accès individuels, MFA, journal des changements et validations.

## Développement : réalisé et restant
### Livré dans cet incrément
- Positionnement public et parcours de demande sur l'accueil.
- Page réseau pour les six acteurs et formulaire préparant un message WhatsApp.
- Catalogue de lancement commun au frontend de secours et au backend.
- Prix/minimum des blocs, offres sur devis, protection contre achat direct de
  ces offres avant confirmation logistique, nouveau contact et logo choisi.
- Aucun partenaire fictif, aucun stock chiffré inventé.

Le formulaire WhatsApp ne crée pas de compte, ne transmet rien sans action de
l'utilisateur et ne constitue pas une validation ou un registre en base.
Le stock des offres de lancement démarre à 0. Un administrateur renseigne le stock
physique confirmé avant de convertir un devis accepté en commande. Leur disponibilité
annoncée est celle du promoteur, à vérifier.

### Modules BTP ajoutés
Devis persistants et versionnés, acceptation client, conversion en commande avec
réservation du stock ; missions avec chauffeur, planning et preuve de réception ;
registre des règlements partenaires avec référence de paiement et journal d’audit.
Voir [le guide opérationnel](BTP_OPERATIONS.md) pour les accès et limites.

### Fiches métiers et annuaire ajoutés
Fiches partenaires multi-métiers, spécialités, zones, références déclarées,
conditions tarifaires, disponibilité et publication volontaire. Annuaire filtrable
et demande de devis ciblée, avec accès aux demandes de son entreprise uniquement.
Voir [le guide des fiches partenaires](PARTNER_DIRECTORY.md).

### Backlog fonctionnel
1. Registre administratif : pièces, références, zones, capacité, validation,
   suspension et accès cloisonnés. Pas de publication de pièces personnelles.
2. Étendre les devis et missions livrés : documents PDF et notifications.
3. Optimisation des tournées et suivi GPS.
4. Rapprochement automatisé des virements partenaires (registre manuel livré).
5. Réclamations, annulation/remboursement et suivi qualité.
6. Dashboards acheteur, producteur/grossiste, prestataire, transporteur/logisticien,
   chauffeur et administrateur. Vérifier les accès serveur, pas seulement les menus.
7. Mesure des indicateurs et notification des actions importantes.

La présence de ce backlog ne signifie pas que ces modules sont déjà développés.

## Réseaux sociaux
Nom Chantier.online ; casque/bâtiments ; navy #14283F, orange #F47B20 ;
contacts/horaires/zones identiques. Identifiants à vérifier avant réservation.
Facebook/Instagram : offres et confiance ; TikTok : démonstrations/conseils ;
WhatsApp : devis et suivi ; site : catalogue/commandes une fois validés.
Trois contenus/semaine : offre disponible, preuve réelle, conseil utile.
Appel : produit/service, quantité, destination, date. Images générées réservées
à la marque, pas à des preuves de réalisation. Comptes et publication à créer
séparément ; budget publicitaire plafonné à décider après essais opérationnels.

## Calendrier et preuves
| Période | Action | Livrable/preuve |
|---|---|---|
| J1–7 | Responsabilités, partenaires, méthode de prix | Registre et devis type |
| J8–21 | Vérification et documentation des sept offres | Fiches et références |
| J22–30 | Opérations pilotes | Devis, réception, coûts et réclamations |
| J31–45 | Corrections et parcours Web | Résultats tests et captures |
| J46–60 | Ouverture progressive et communication | Commandes suivies |
| J61–90 | Mesure, fiabilité et extension | Bilan par commande et par partenaire |

Première semaine : fournisseurs des sept produits, deux transporteurs,
unités/prix/capacités/délais, méthode commission, devis/bon, une commande pilote.

## Validation avant lancement
Prix soumis/validés et recalcul ; protections des rôles ; paiement réel confirmé ;
mission et réception ; notifications ; annulation/réclamation ; mobile et
ordinateur. Aucune intégration non validée présentée comme opérationnelle.
Preuves texte et captures. DNS/hébergement chantier.online à vérifier séparément.

Indicateurs hebdomadaires : demandes qualifiées, devis envoyés/acceptés, délai
de réponse, commandes exécutées à temps, annulations/réclamations, résultat net
par commande, clients récurrents, partenaires actifs. Fixer les objectifs après
les pilotes. Étendre uniquement avec partenaires et coûts confirmés.
