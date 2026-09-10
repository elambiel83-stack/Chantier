# App Store Connect — fiche à copier-coller

## Informations générales

- **Nom** : MonChantier
- **Sous-titre** (30 caractères max) : Matériaux de construction
- **Bundle ID** : `net.monchantier.app`
- **Catégorie principale** : Shopping
- **Catégorie secondaire** : Utilitaires (ou Style de vie)
- **Classification d'âge** : 4+ (aucun contenu réservé — pas de violence, contenu adulte, jeu
  d'argent réel ni contenu généré par les utilisateurs)

## Description promotionnelle (170 caractères max, modifiable sans nouvelle version)

Commandez vos matériaux de construction en ligne à Kinshasa : sable, gravier, ciment et plus,
livrés directement sur votre chantier.

## Description (4000 caractères max)

MonChantier est la marketplace en ligne pour acheter vos matériaux de construction en RDC :
agrégats (sable, gravier, moellons), ciment et autres fournitures de chantier, livrés
directement où vous en avez besoin.

Fonctionnalités :
• Catalogue de matériaux avec prix à jour et conversion automatique USD/CDF/EUR
• Commande en quelques étapes, suivi de son statut en temps réel
• Paiement par PayPal, Airtel Money ou Orange Money
• Connexion rapide par e-mail, Google ou Sign in with Apple
• Contact WhatsApp direct pour toute question

Que vous soyez un particulier qui rénove ou une entreprise de construction, MonChantier
simplifie l'approvisionnement de votre chantier, du bon de commande à la livraison.

## Mots-clés (100 caractères max, séparés par des virgules, sans espace après la virgule)

matériaux,construction,agrégats,sable,gravier,ciment,chantier,BTP,RDC,Congo,Kinshasa,livraison

## URLs

- **Site web (marketing)** : https://monchantier.net
- **URL de support** : https://monchantier.net (ou une page de contact dédiée si vous en créez
  une — Apple exige une page web accessible, pas seulement une adresse e-mail)
- **Politique de confidentialité** (obligatoire) : https://monchantier.net/privacy.html
- **Contact support** : contact@monchantier.net

## Copyright

`2026 MonChantier` (ou la raison sociale exacte si l'entreprise est déclarée sous un autre nom).

## App Privacy (questionnaire de confidentialité App Store Connect)

Réponses basées sur ce que le code collecte réellement (voir `backend/server.js`,
`web/privacy.html`) :

| Type de donnée | Collectée ? | Liée à l'identité ? | Utilisée pour le tracking publicitaire ? |
|---|---|---|---|
| Nom | Oui (inscription) | Oui | Non |
| E-mail | Oui (compte, connexion) | Oui | Non |
| Numéro de téléphone | Oui (compte, livraison) | Oui | Non |
| Adresse | Oui, si saisie pour la livraison | Oui | Non |
| Historique d'achats | Oui (commandes) | Oui | Non |
| Identifiants (ID utilisateur) | Oui (compte) | Oui | Non |
| Données de localisation précise | **Non** — aucune géolocalisation device, seulement une adresse texte optionnelle | — | — |
| Données financières (carte, etc.) | **Non** — PayPal gère son propre flux de paiement, l'app ne voit jamais le numéro de carte ; Airtel/Orange Money sont confirmés manuellement sans passer de données bancaires à l'app | — | — |
| Contenu utilisateur/publicité tiers | **Non** — pas de SDK publicitaire, pas de tracking cross-app | — | — |

Finalité déclarée pour Nom/E-mail/Téléphone/Adresse/Historique d'achats/Identifiants :
**App Functionality** (fonctionnement du compte et des commandes) — pas *Third-Party
Advertising*, pas *Analytics* tant qu'aucun SDK de ce type n'est ajouté au projet.

## Sign in with Apple

`usesAppleSignIn: true` est déjà dans `app.json` — App Store Connect devrait détecter
automatiquement cette capacité. Assurez-vous d'avoir coché **Sign In with Apple** sur
l'identifiant `net.monchantier.app` dans le compte développeur (voir
`mobile/APPLE_AUTH_SETUP.md`) avant de soumettre, sinon l'examen sera rejeté.

## Compte de démonstration pour l'examinateur Apple

Apple exige souvent un compte de test fonctionnel dans les notes de version. Créez un compte
customer dédié (par ex. `apple-review@monchantier.net`) et indiquez ses identifiants dans le
champ « App Review Information » d'App Store Connect — ne réutilisez pas un compte réel.
