# MonChantier - Guide de Connexion Frontend/Backend

## ✅ Intégration Complétée !

Le frontend et le backend sont maintenant connectés. Voici ce qui a été mis en place :

## 📋 Architecture

Le projet est divisé en deux parties :

- **Backend** : API REST avec Node.js + Express (dossier `backend/`)
- **Frontend** : Site web statique (HTML, CSS, JavaScript) (dossier `web/`)

## 🚀 Démarrage Rapide

### 1. Démarrer le Backend

```bash
cd ../backend
npm install  # Première fois seulement
node server.js
```

**Résultat attendu :**
```
✅ Serveur démarré sur http://localhost:3000
📦 10 produits chargés
🌍 CORS activé pour: http://localhost:8080
```

### 2. Démarrer le Frontend

**Option A - Avec Python :**
```bash
cd web
python3 -m http.server 8080
```

**Option B - Avec VS Code Live Server :**
- Installer l'extension "Live Server"
- Clic droit sur `index.html` → "Open with Live Server"

**Option C - Avec Node.js :**
```bash
npx http-server -p 8080
```

### 3. Tester l'intégration

Ouvrez dans votre navigateur :
- **Site principal :** http://localhost:8080/index.html
- **Page de test API :** http://localhost:8080/test-api.html

## 🧪 Test de l'API

Le fichier `test-api.html` vous permet de tester tous les endpoints de l'API :

1. ✅ Test de connexion
2. 📦 Récupération des produits
3. 🏷️ Filtrage par catégorie
4. 🔍 Recherche de produits
5. 🛒 Gestion du panier

## 🔌 API Endpoints

### Produits

```
GET /api/products
```
Récupère tous les produits. Query params optionnels :
- `?category=produits` - Filtrer par catégorie
- `?search=ciment` - Rechercher un produit

**Exemple de réponse :**
```json
{
  "success": true,
  "count": 10,
  "products": [
    {
      "id": "BRQ-001",
      "name_fr": "Brique en bloc ciment",
      "name_en": "Cement block brick",
      "unit": "pcs",
      "price": 0.45,
      "stock": 10000,
      "category": "produits",
      "img": "..."
    }
  ]
}
```

### Panier

```
POST /api/cart
```
Créer ou mettre à jour un panier.

**Body :**
```json
{
  "sessionId": "session_123",
  "items": [
    { "id": "BRQ-001", "qty": 10 }
  ]
}
```

```
GET /api/cart/:sessionId
```
Récupérer un panier existant.

```
DELETE /api/cart/:sessionId
```
Supprimer un panier.

## 📦 Fichiers Créés/Modifiés

### ✅ Backend (nouveau dossier)
- `backend/server.js` - Serveur Express avec toutes les routes API
- `backend/package.json` - Dépendances (express, cors, dotenv)
- `backend/.env` - Configuration (PORT, CORS_ORIGIN)
- `backend/.gitignore` - Fichiers à ignorer (node_modules, .env)

### ✅ Frontend (modifications)
- `web/config.js` - **NOUVEAU** - Configuration de l'API
- `web/products.js` - **MODIFIÉ** - Chargement dynamique depuis API avec fallback
- `web/site.js` - **MODIFIÉ** - Attente du chargement des produits, affichage du stock
- `web/index.html` - **MODIFIÉ** - Ajout du script config.js
- `web/cart.html` - **MODIFIÉ** - Ajout du script config.js
- `web/test-api.html` - **NOUVEAU** - Page de test de l'API

## 🔧 Comment ça fonctionne

### Chargement des produits

1. Au chargement de la page, `products.js` appelle `loadProducts()`
2. Si l'API est disponible, les produits sont récupérés depuis `/api/products`
3. Sinon, un fallback charge les données locales
4. Les produits sont stockés dans `window.PRODUCTS`
5. `site.js` attend la fin du chargement avant de faire le rendu

### Configuration API

Le fichier `config.js` fournit :
- `API_CONFIG` - Configuration de base (URL, endpoints, timeout)
- `apiCall()` - Fonction utilitaire pour les appels API
- `getSessionId()` - Génération d'ID de session unique

### Mode Fallback

Pour utiliser uniquement les données locales sans l'API :

```javascript
// Dans web/products.js
window.USE_API = false;
```

## 🌐 Déploiement en Production

### Backend

**Heroku / Railway / Render :**

1. Créer un fichier `Procfile` dans `backend/` :
   ```
   web: node server.js
   ```

2. Configurer les variables d'environnement :
   ```
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://votre-site.com
   ```

3. Déployer via Git

### Frontend

**Netlify / Vercel / GitHub Pages :**

1. Déployer le dossier `web/`

2. Mettre à jour `web/config.js` :
   ```javascript
   const API_CONFIG = {
     baseURL: 'https://votre-api.herokuapp.com/api',
     // ...
   };
   ```

## 🔒 Recommandations pour la Production

### Sécurité
- ✅ CORS configuré
- ⚠️ Ajouter une vraie base de données (MongoDB, PostgreSQL)
- ⚠️ Implémenter l'authentification JWT
- ⚠️ Valider toutes les entrées (joi, express-validator)
- ⚠️ Utiliser HTTPS uniquement
- ⚠️ Ajouter un rate limiting (express-rate-limit)
- ⚠️ Variables d'environnement sécurisées

### Performance
- ⚠️ Ajouter un cache Redis
- ⚠️ Compresser les réponses (compression middleware)
- ⚠️ Optimiser les images
- ⚠️ Minifier le code frontend

### Monitoring
- ⚠️ Logs structurés (winston, pino)
- ⚠️ Monitoring des erreurs (Sentry)
- ⚠️ Métriques d'utilisation

## 📝 Prochaines Étapes

### Backend
- [ ] Intégrer une base de données (MongoDB/PostgreSQL)
- [ ] Système d'authentification
- [ ] Gestion des commandes
- [ ] Interface d'administration
- [ ] Webhooks pour les notifications

### Frontend
- [ ] Synchroniser le panier avec le backend
- [ ] Historique des commandes
- [ ] Système de compte utilisateur
- [ ] Notifications en temps réel
- [ ] Mode hors ligne (PWA)

### Fonctionnalités Business
- [ ] Intégration de paiement (Stripe, Paypal)
- [ ] Suivi des livraisons
- [ ] Système de facturation
- [ ] Programme de fidélité
- [ ] Analytics et rapports

## 🐛 Dépannage

### Le backend ne démarre pas

**Erreur : "port already in use"**
```bash
# Trouver le processus sur le port 3000
lsof -ti:3000
# Tuer le processus
kill -9 $(lsof -ti:3000)
```

**Erreur : "Cannot find module"**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Le frontend ne charge pas les produits

1. Vérifier que le backend est démarré (http://localhost:3000/api)
2. Ouvrir la console du navigateur (F12) pour voir les erreurs
3. Vérifier que CORS est bien configuré dans `.env`
4. En cas de problème, les données locales seront utilisées automatiquement

### Erreur CORS

Si vous voyez "blocked by CORS policy" :

1. Vérifier que le backend tourne sur le bon port
2. Vérifier `CORS_ORIGIN` dans `backend/.env`
3. Redémarrer le backend après modification du `.env`

## 📞 Support

- WhatsApp : +243999972466
- Documentation complète : Ce fichier INTEGRATION.md

## 📄 Licence

Tous droits réservés © 2026 MonChantier
