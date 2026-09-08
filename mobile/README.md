# MonChantier Mobile - Application React Native

Application mobile React Native pour MonChantier e-commerce.

## 🚀 Installation

### Prérequis

1. **Node.js** (v16 ou supérieur)
2. **Expo CLI**
   ```bash
   npm install -g expo-cli
   ```
3. **Application Expo Go** sur votre téléphone :
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

### Installation des dépendances

```bash
cd mobile
npm install
```

## 📱 Lancement de l'application

### 1. Configurer l'API

Copiez `.env.example` vers `.env.local` (non versionné) et renseignez l'IP de votre
machine :

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000/api
```

Expo inline automatiquement les variables `EXPO_PUBLIC_*` au démarrage — redémarrez
`npm start` après avoir modifié `.env.local`.

**Pour trouver votre IP :**

Linux/Mac:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Windows:
```bash
ipconfig
```

### 2. Démarrer le backend

Dans un terminal :
```bash
cd ../backend
node server.js
```

### 3. Démarrer l'application mobile

Dans un autre terminal :
```bash
cd mobile
npm start
```

### 4. Scanner le QR Code

1. Ouvrez **Expo Go** sur votre téléphone
2. Scannez le QR code affiché dans le terminal
3. L'application se chargera automatiquement

## 🔧 Développement

### Tester sur émulateur

**Android :**
```bash
npm run android
```

**iOS (Mac uniquement) :**
```bash
npm run ios
```

### Structure du projet

```
mobile/
├── App.js                    # Point d'entrée
├── config.js                 # Configuration API
├── screens/
│   ├── HomeScreen.js        # Écran d'accueil
│   ├── ProductsScreen.js    # Catalogue produits
│   ├── CartScreen.js        # Panier
│   └── OrdersScreen.js      # Mes commandes (historique + détail)
├── context/
│   ├── CartContext.js       # Gestion du panier
│   └── AuthContext.js       # Session, jetons, authFetch
└── assets/                   # Images et icônes
```

## ✨ Fonctionnalités

- ✅ Navigation entre écrans
- ✅ Affichage des produits depuis l'API
- ✅ Filtrage par catégorie
- ✅ Recherche de produits
- ✅ Gestion du panier
- ✅ Commande via WhatsApp
- ✅ Authentification (e-mail/mot de passe, Google, Apple)
- ✅ Paiement (PayPal, Airtel Money, Orange Money)
- ✅ Design responsive

## 🐛 Dépannage

### L'app ne charge pas les produits

1. Vérifiez que le backend est démarré
2. Vérifiez `EXPO_PUBLIC_API_BASE_URL` dans `.env.local`
3. Assurez-vous que téléphone et PC sont sur le même réseau WiFi
4. Testez l'API : `http://VOTRE_IP:3000/api` dans le navigateur

### Erreur "Network request failed"

- Le téléphone ne peut pas accéder au backend
- Vérifiez le pare-feu de votre PC
- Utilisez l'IP correcte (pas localhost)

### QR Code ne se charge pas

```bash
# Redémarrer avec le cache nettoyé
expo start -c
```

## 📦 Build pour production

`expo build:android`/`expo build:ios` (Expo Classic Build) sont retirés depuis des années — le
build passe maintenant par [EAS Build](https://docs.expo.dev/build/introduction/), déjà
configuré (`eas.json`) :

```bash
npm install -g eas-cli
eas login
eas init                                   # une seule fois : crée le projet EAS
eas build --profile preview --platform android   # .apk installable directement, sans store
eas build --profile production --platform ios
eas build --profile production --platform android
```

Voir `store-listing/README.md` pour la suite (comptes développeur, captures d'écran, soumission).

## 🎨 Personnalisation

### Couleurs

Modifiez les couleurs dans les `styles` de chaque écran :
- Primary: `#1e293b` (Noir ardoise)
- Accent: `#dc2626` (Rouge)
- Success: `#22c55e` (Vert)

### Logo

Remplacez les images dans `assets/` :
- `icon.png` — 1024×1024, **opaque** (sans canal alpha, exigé par Apple)
- `adaptive-icon.png` — 1024×1024, transparent, motif centré dans la zone de sécurité Android
  (`android.adaptiveIcon.backgroundColor` dans `app.json` fournit le fond)
- `splash.png` — fond transparent ; `resizeMode: "contain"` dans `app.json` l'adapte à tout
  écran, la taille exacte importe peu tant que le ratio interne reste raisonnable

## 🌐 Déploiement

### App Stores

Fiches App Store/Play Store déjà rédigées dans `store-listing/` (nom, description, mots-clés,
réponses aux questionnaires de confidentialité). `store-listing/README.md` liste dans l'ordre
tout ce qui reste à faire manuellement : comptes développeur, `eas build`/`eas submit`,
captures d'écran.

## 📝 TODO

- [x] Authentification utilisateur (e-mail/mot de passe, Google, Apple — voir `GOOGLE_AUTH_SETUP.md`/`APPLE_AUTH_SETUP.md`)
- [x] Historique des commandes (`OrdersScreen.js`, lien « Mes commandes » sur l'accueil pour un compte customer connecté)
- [ ] Notifications push
- [ ] Mode hors ligne
- [x] Paiement intégré (PayPal, Airtel Money, Orange Money — voir le README à la racine du dépôt)
- [ ] Géolocalisation pour livraison

## 📞 Support

WhatsApp : +243 999 972 466

---

**Version :** 1.0.0  
**Plateforme :** React Native + Expo  
**Backend :** Node.js + Express
