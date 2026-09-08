# Configuration Sign in with Apple (authentification iCloud) pour MonChantier Mobile

Contrairement à Google, aucun identifiant client à configurer côté app : `expo-apple-authentication`
utilise directement l'identifiant de l'app (`net.monchantier.app`) comme audience du jeton. Il reste
deux choses à faire côté compte développeur Apple, et une limite de test à connaître.

## 📋 Étapes de configuration

### 1. Activer la capacité dans le compte développeur Apple

1. [Apple Developer](https://developer.apple.com/account/) → **Certificates, Identifiers & Profiles** → **Identifiers**
2. Sélectionnez l'identifiant `net.monchantier.app` (ou créez-le s'il n'existe pas encore)
3. Cochez la capacité **Sign In with Apple**, enregistrez

Nécessite un compte Apple Developer Program payant (99 $/an) — pas possible avec un compte gratuit.

### 2. Déclarer les identifiants côté backend

Le backend vérifie le jeton reçu (signature, émetteur, audience) avant de créer ou relier un
compte — voir `README.md` > Authentification et rôles, et `backend/oidc.js`. Dans `backend/.env` :

```
APPLE_CLIENT_IDS=net.monchantier.app
```

L'app native envoie un jeton dont l'audience est le bundle ID (`net.monchantier.app`). Si vous
ajoutez un jour "Sign in with Apple" au site web (Services ID Apple distinct), ajoutez cet
identifiant à la liste, séparé par une virgule. Sans `APPLE_CLIENT_IDS` défini, `POST
/api/auth/apple` répond `503`.

### 3. Limite de test : pas disponible dans Expo Go

`expo-apple-authentication` est un module natif : il ne fonctionne pas dans l'app **Expo Go** du
App Store. Il faut soit :

- un **development build** (`npx expo run:ios`, ou un build EAS avec `expo-dev-client`), sur un
  vrai appareil iOS ou le simulateur (le simulateur doit être connecté à un compte iCloud pour
  tester réellement le flux — sinon Apple affiche une erreur) ;
- soit un build de production (voir `eas.json`, à mettre en place séparément).

Le bouton "Se connecter avec Apple" n'apparaît de toute façon que sur iOS (`Platform.OS ===
'ios'`) — Sign in with Apple n'existe pas sur Android.

## 🔐 Sécurité en production

- Le jeton est vérifié côté backend (signature + émetteur + audience, voir `backend/oidc.js`)
- Apple ne renvoie le nom complet de l'utilisateur qu'à la toute première autorisation : l'app le
  transmet au backend à ce moment précis (voir `handleApplePress` dans `App.js`), il ne sera plus
  jamais disponible ensuite — ni dans le jeton, ni via une nouvelle autorisation
- L'adresse e-mail peut être une adresse de relais Apple (`@privaterelay.appleid.com`) plutôt que
  la vraie adresse de l'utilisateur — c'est normal, Apple la gère et les messages y arrivent

## 📚 Ressources

- [Sign in with Apple — Expo docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Sign in with Apple — Apple Developer](https://developer.apple.com/sign-in-with-apple/)
