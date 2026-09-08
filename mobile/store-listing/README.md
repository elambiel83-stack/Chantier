# Publication sur les stores — checklist

Ce dossier contient le texte prêt à copier-coller pour les fiches App Store et Google Play
(`apple-app-store.md`, `google-play.md`). Ce fichier liste tout ce qu'il reste à faire
manuellement, dans l'ordre, en plus de ce texte.

## 0. Prérequis (comptes)

- [ ] Compte [Expo/EAS](https://expo.dev) (gratuit pour builder ; nécessaire pour `eas build`/`eas submit`)
- [ ] Compte [Apple Developer Program](https://developer.apple.com/programs/) — 99 $/an
- [ ] Compte [Google Play Console](https://play.google.com/console) — 25 $ à vie (paiement unique)

## 1. EAS — builder l'app

```bash
cd mobile
npm install -g eas-cli   # ou: npx eas-cli <commande>
eas login                # compte Expo créé ci-dessus
eas init                 # crée le projet EAS et écrit extra.eas.projectId dans app.json
```

`eas.json` est déjà configuré (`development`/`preview`/`production`) — rien à modifier sauf
besoin particulier. Premier build de test (installable sans passer par un store) :

```bash
eas build --profile preview --platform ios       # nécessite un compte Apple Developer pour un
                                                    # vrai appareil ; le profil preview inclut
                                                    # ios.simulator=true pour tester sans ça
eas build --profile preview --platform android    # génère un .apk installable directement
```

Build de production (ce que vous soumettrez aux stores) :

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

## 2. Icônes et splash screen

Générés dans cette session à partir du logo existant (`assets/monchantier_logo.svg`/`.png`) :

- `mobile/assets/icon.png` — 1024×1024, opaque (sans canal alpha, requis par Apple)
- `mobile/assets/adaptive-icon.png` — 1024×1024, transparent, motif dans la zone de sécurité
  Android (le fond blanc vient de `android.adaptiveIcon.backgroundColor` dans `app.json`)
- `mobile/assets/splash.png` — logo complet (avec le texte « MonChantier »), fond transparent,
  composé sur `splash.backgroundColor` (blanc) au démarrage

Si vous préférez une autre déclinaison (fond de couleur différent, icône sans le texte
« VENTE D'AGRÉGATS EN LIGNE » pour la version splash...), remplacez ces fichiers puis relancez
`eas build` — rien d'autre à changer.

## 3. Captures d'écran (obligatoire, pas encore faites)

Aucun simulateur/émulateur n'est disponible dans cet environnement : ces captures doivent être
prises par vous, une fois un build installé sur un appareil ou dans un simulateur/émulateur local.

**iOS** (App Store Connect) : au moins un jeu de captures pour l'iPhone 6.7" (1290×2796) — les
tailles plus petites sont dérivées automatiquement par Apple. `ios.supportsTablet: true` dans
`app.json` signifie qu'Apple demandera aussi des captures iPad (12.9", 2048×2732) sauf si vous
désactivez le support tablette.

**Android** (Play Console) : au moins 2 captures téléphone (min. 320px, max. 3840px, ratio
16:9 ou 9:16 recommandé), plus une image « feature graphic » 1024×500 (bannière affichée en
haut de la fiche Play Store — à concevoir séparément, ce n'est pas l'icône).

Écrans à couvrir a minima : accueil/catalogue, fiche produit, panier, tunnel de commande,
connexion.

## 4. Fiches store

Voir `apple-app-store.md` et `google-play.md` dans ce dossier — texte déjà rédigé (nom,
description, mots-clés, catégorie, réponses au questionnaire de confidentialité). Il ne reste
qu'à copier-coller dans App Store Connect / Play Console, et à vérifier que l'URL de la
politique de confidentialité (`https://monchantier.net/privacy.html`) est bien accessible
publiquement une fois le site déployé.

## 5. Points de conformité déjà couverts par le code

- Connexion Google **et** Apple toutes les deux présentes (règle Apple 4.8 : un login social
  tiers exige une alternative Sign in with Apple équivalente).
- Paiement : PayPal/Airtel Money/Orange Money servent à payer des matériaux physiques, donc pas
  soumis à l'obligation d'In-App Purchase d'Apple (celle-ci ne s'applique qu'au contenu/service
  numérique) — voir règle Apple 3.1.1.
- Politique de confidentialité déjà en ligne (`web/privacy.html`), CGV aussi
  (`web/terms.html`) — les deux stores l'exigent.

## 6. Après soumission

- Apple : le premier examen prend généralement 24–48h ; répondez rapidement à toute demande de
  clarification dans Resolution Center pour ne pas perdre de temps.
- Google : la première publication peut être soumise à une vérification renforcée du compte
  développeur (délai variable, parfois plusieurs jours).
