# 📱 MonChantier - Application Web Progressive (PWA)

Votre site web MonChantier est maintenant une Progressive Web App (PWA) complète et installable !

## 🚀 Installation

### Sur Chrome/Android

1. Ouvrez http://localhost:8080/index.html dans Chrome
2. Cliquez sur le menu ⋮ (trois points)
3. Sélectionnez **"Installer MonChantier"**
4. Confirmez l'installation
5. L'app s'installe sur votre écran d'accueil

### Sur Safari/iOS

1. Ouvrez http://localhost:8080/index.html dans Safari
2. Cliquez sur **Partager** (carré avec flèche)
3. Sélectionnez **"Sur l'écran d'accueil"**
4. Confirmez
5. L'app s'ajoute à votre écran d'accueil

### Sur Chrome Desktop (Windows/Mac/Linux)

1. Ouvrez http://localhost:8080/index.html
2. Cliquez sur l'icône d'installation (coin haut droit)
3. Confirmez
4. L'app s'installe en tant qu'application de bureau

## ✨ Fonctionnalités PWA

### ✅ Mode Hors Ligne
- L'app fonctionne sans connexion internet
- Service Worker met en cache toutes les ressources
- API fallback sur les données en cache

### ✅ Installation
- Icône sur l'écran d'accueil
- Accès rapide depuis le menu des apps
- Raccourcis vers Catalogue et Panier

### ✅ Identité
- Nom et description complets
- Icône personnalisée (emoji 🏗️)
- Couleur de thème rouge (#dc2626)

### ✅ Expérience Native
- Interface fullscreen (pas de barre de navigation)
- Barre de statut personnalisée
- Orientation portrait verrouillée

## 🔄 Service Worker

Le fichier `sw.js` gère :

- **Installation** : Mise en cache initiale
- **Cache First** : Pour les ressources statiques (CSS, JS, images)
- **Network First** : Pour les appels API (avec 5s timeout)
- **Sync** : Synchronisation en arrière-plan (préparé)

## 📋 Manifest

Le fichier `site.webmanifest` contient :

- Icônes adaptatives (192x192, 512x512, maskable)
- Raccourcis vers Catalogue et Panier
- Description et catégories
- Configuration de démarrage

## 🔧 Configuration requise

### Pour HTTPS (Production)

En production, utilisez HTTPS obligatoirement :

```bash
# Avec Let's Encrypt (gratuit)
certbot certonly --webroot -w /var/www/html -d votre-domaine.com

# Ou avec un reverse proxy (Nginx)
server {
  listen 443 ssl;
  server_name votre-domaine.com;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://localhost:8080;
  }
}
```

### Avec Localhost (Dev)

En développement local, le Service Worker fonctionne directement.

## 🧪 Test du Service Worker

Ouvrez DevTools (F12) et allez dans l'onglet **Application** :

- **Service Workers** : Affiche le statut (Active)
- **Cache Storage** : Affiche les fichiers en cache
- **Offline** : Cochez pour tester le mode hors ligne

## 🎯 Shortcuts

L'app expose deux raccourcis :

| Nom | URL | Icône |
|-----|-----|-------|
| Catalogue | `/index.html#catalog` | 📦 |
| Panier | `/cart.html` | 🛒 |

Accessibles via un long appui sur l'icône de l'app.

## 📊 Checklist PWA

- ✅ Service Worker enregistré
- ✅ HTTPS (ou localhost en dev)
- ✅ Manifest valide
- ✅ Icônes configurées
- ✅ Mode offline
- ✅ Responsive design
- ✅ Theme color
- ✅ Description et catégories
- ✅ Raccourcis app

## 🚀 Déploiement Production

### Avec Heroku

```bash
# Créer un Procfile
echo "web: python3 -m http.server 8080" > Procfile

# Déployer
heroku create monchantier-pwa
git push heroku main
```

### Avec Netlify

```bash
# Configurer les headers
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

### Avec Vercel

```bash
vercel --prod
```

## 📈 Avantages PWA

| Avant | Après |
|-------|-------|
| Site web | App installable |
| Accès navigateur | Icône écran d'accueil |
| Besoin connexion | Fonctionne offline |
| Temps de chargement | Très rapide (cache) |
| Pas de notifications | Prête pour notifications |
| Engagement faible | Engagement utilisateur ↑ |

## 📱 Taille de l'App

- APK Web : ~1 MB (vs 50 MB pour app native)
- Cache offline : ~5 MB
- Vraie app installée : ~10 MB sur l'appareil

## 🔐 Sécurité

- ✅ Service Worker isolé
- ✅ HTTPS obligatoire (production)
- ✅ Pas d'accès au système de fichiers
- ✅ Sandboxing navigateur
- ⚠️ À ajouter : CSP (Content Security Policy)

## 💡 Tips

1. **Icônes SVG** : Plus légères et adaptatives
2. **Service Worker** : Versionnez avec `CACHE_NAME = 'v1'`
3. **Manifest** : Les icônes maskable sont recommandées
4. **Offline** : Montrez un message "Mode hors ligne"
5. **Updates** : Vérifiez les mises à jour du SW

## 📞 Support

- WhatsApp : +243 999 972 466
- Issue tracker : [GitHub](https://github.com)

---

**Version :** 1.0.0 - PWA  
**Plateforme :** Web Progressive  
**Type :** Installable sur tous les appareils
