# Google Play Console — fiche à copier-coller

## Informations générales

- **Nom de l'application** : MonChantier
- **Nom du package** : `net.monchantier.app`
- **Catégorie** : Shopping
- **Coordonnées** : contact@monchantier.net

## Description courte (80 caractères max)

Achetez vos matériaux de construction en ligne en RDC, livrés sur votre chantier.

## Description complète (4000 caractères max)

MonChantier est la marketplace en ligne pour acheter vos matériaux de construction en RDC :
agrégats (sable, gravier, moellons), ciment et autres fournitures de chantier, livrés
directement où vous en avez besoin.

Fonctionnalités :
• Catalogue de matériaux avec prix à jour et conversion automatique USD/CDF/EUR
• Commande en quelques étapes, suivi de son statut en temps réel
• Paiement par PayPal, Airtel Money ou Orange Money
• Connexion rapide par e-mail ou Google
• Contact WhatsApp direct pour toute question

Que vous soyez un particulier qui rénove ou une entreprise de construction, MonChantier
simplifie l'approvisionnement de votre chantier, du bon de commande à la livraison.

## Éléments graphiques requis

- **Icône** : générée automatiquement par Google Play depuis `assets/icon.png` (1024×1024) — pas
  d'upload séparé nécessaire au-delà du build.
- **Feature graphic** (bannière, obligatoire) : 1024×500, PNG/JPEG — **pas encore créée**, à
  concevoir séparément (ce n'est pas une simple version redimensionnée du logo).
- **Captures d'écran** : au moins 2, jusqu'à 8, prises sur un appareil/émulateur réel (voir
  `README.md` de ce dossier).

## URLs

- **Site web** : https://monchantier.net
- **Politique de confidentialité** (obligatoire) : https://monchantier.net/privacy.html

## Formulaire « Sécurité des données » (Data safety)

Basé sur ce que le backend collecte réellement (`backend/server.js`, `web/privacy.html`) :

| Catégorie | Collectée | Partagée avec des tiers | Finalité |
|---|---|---|---|
| Nom | Oui | Non | Fonctionnalité de l'app (compte, commandes) |
| E-mail | Oui | Non | Fonctionnalité de l'app (compte, connexion) |
| Numéro de téléphone | Oui | Non | Fonctionnalité de l'app (compte, livraison, vérification SMS/WhatsApp) |
| Adresse | Oui, si saisie | Non | Livraison |
| Historique d'achats | Oui | Non | Suivi de commande |
| Identifiants utilisateur | Oui | Non | Fonctionnement du compte |
| Position précise/approximative | **Non collectée** | — | — |
| Photos/vidéos | **Non collectée** | — | — |
| Informations financières | **Non collectée directement** — PayPal gère son propre flux ; Airtel/Orange Money confirmés manuellement sans transiter par l'app | — | — |

Répondre **Oui** à « Les données sont-elles chiffrées en transit ? » (HTTPS partout) et **Oui** à
« Les utilisateurs peuvent-ils demander la suppression de leurs données ? » (voir
`web/privacy.html` : contact@monchantier.net).

Aucun SDK publicitaire ni analytics tiers dans le code actuel — répondre **Non** aux questions
sur le partage à des fins publicitaires/analytiques tant que ça reste le cas.

## Questionnaire de classification du contenu (IARC)

À remplir dans Play Console (génère automatiquement la classification d'âge) :
- Violence, contenu choquant, contenu sexuel : Non
- Jeu d'argent réel : Non (Airtel/Orange Money/PayPal servent à payer des matériaux physiques,
  pas des paris)
- Contenu généré par les utilisateurs / interactions entre utilisateurs : Non
- Partage de position : Non

Devrait aboutir à une classification proche de « Tout public » / PEGI 3.

## Compte de démonstration pour l'examinateur Google

Comme pour Apple, prévoyez un compte customer de test (ex. `play-review@monchantier.net`) et
indiquez ses identifiants dans les instructions d'accès de l'app si Google Play les demande lors
de l'examen.
