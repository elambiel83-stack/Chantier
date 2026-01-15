# Commandes Utiles - MonChantier

## 🚀 Démarrage

### Backend
```bash
# Première installation
cd backend
npm install

# Démarrer
node server.js

# Avec rechargement automatique (dev)
npm run dev
```

### Frontend
```bash
# Option 1: Python
cd web
python3 -m http.server 8080

# Option 2: Node.js
cd web
npx http-server -p 8080

# Option 3: VS Code Live Server
# Clic droit sur index.html → "Open with Live Server"
```

## 🧪 Test

```bash
# Tester l'API backend
curl http://localhost:3000/api

# Récupérer les produits
curl http://localhost:3000/api/products

# Filtrer par catégorie
curl http://localhost:3000/api/products?category=produits

# Rechercher
curl "http://localhost:3000/api/products?search=ciment"
```

## 🔍 Débogage

```bash
# Vérifier le port 3000
lsof -i :3000

# Tuer le processus sur le port 3000
kill -9 $(lsof -ti:3000)

# Vérifier le port 8080
lsof -i :8080

# Voir les logs du backend
# (dans le terminal où tourne node server.js)
```

## 📦 URLs Importantes

- **Backend API** : http://localhost:3000/api
- **Frontend** : http://localhost:8080/index.html
- **Test API** : http://localhost:8080/test-api.html
- **Panier** : http://localhost:8080/cart.html

## 🛠️ Développement

### Ajouter un nouveau produit

Éditer `backend/server.js` :
```javascript
const PRODUCTS = [
  // ... produits existants
  { 
    id: "NEW-001", 
    name_fr: "Nouveau Produit", 
    name_en: "New Product", 
    unit: "pcs", 
    price: 10.00, 
    img: "https://...", 
    category: "produits",
    stock: 100
  }
];
```

Redémarrer le backend.

### Modifier la configuration

Éditer `backend/.env` :
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080
```

Éditer `web/config.js` :
```javascript
const API_CONFIG = {
  baseURL: 'http://localhost:3000/api',
  timeout: 10000
};
```

## 🌐 Déploiement

### Backend sur Heroku

```bash
cd backend

# Login Heroku
heroku login

# Créer l'app
heroku create monchantier-api

# Configurer les variables
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://monchantier-web.netlify.app

# Déployer
git push heroku main
```

### Frontend sur Netlify

```bash
cd web

# Via l'interface Netlify
# 1. Glisser-déposer le dossier web/
# 2. Ou connecter via Git

# Mettre à jour config.js avec l'URL de prod
const API_CONFIG = {
  baseURL: 'https://monchantier-api.herokuapp.com/api',
  // ...
};
```

## 📊 Statistiques

```bash
# Compter les lignes de code
cd web
find . -name "*.js" -o -name "*.html" | xargs wc -l

# Taille du projet
du -sh .
du -sh ../backend
```

## 🔄 Mise à jour

```bash
# Backend - Mettre à jour les dépendances
cd backend
npm update

# Vérifier les vulnérabilités
npm audit
npm audit fix

# Frontend - Pas de dépendances npm à gérer
```

## 📝 Git

```bash
# Initialiser le repo (si pas déjà fait)
git init

# Ajouter tout
git add .

# Commit
git commit -m "feat: intégration backend API"

# Pousser vers GitHub
git remote add origin https://github.com/username/monchantier.git
git branch -M main
git push -u origin main
```

## 🧹 Nettoyage

```bash
# Supprimer node_modules
cd backend
rm -rf node_modules

# Réinstaller
npm install

# Nettoyer le cache npm
npm cache clean --force
```

## 📈 Performance

```bash
# Tester la vitesse de l'API
time curl http://localhost:3000/api/products

# Load testing (installer siege)
siege -c 10 -r 100 http://localhost:3000/api/products
```

## 🔐 Sécurité

```bash
# Scanner les vulnérabilités
cd backend
npm audit

# Mettre à jour les packages à risque
npm audit fix

# Forcer les mises à jour majeures
npm audit fix --force
```

## 💾 Backup

```bash
# Sauvegarder le projet
tar -czf monchantier-backup-$(date +%Y%m%d).tar.gz \
  backend/ web/ --exclude=node_modules

# Restaurer
tar -xzf monchantier-backup-YYYYMMDD.tar.gz
```

## 🎯 Raccourcis Personnalisés

Ajouter à votre `~/.bashrc` ou `~/.zshrc` :

```bash
# Alias MonChantier
alias mc-start='cd ~/Images/MonChantier_Starter_Kit/backend && node server.js'
alias mc-web='cd ~/Images/MonChantier_Starter_Kit/web && python3 -m http.server 8080'
alias mc-test='curl http://localhost:3000/api'
```

Puis :
```bash
source ~/.bashrc  # ou ~/.zshrc

# Utiliser
mc-start
mc-web
mc-test
```

## 📚 Documentation

- [INTEGRATION.md](INTEGRATION.md) - Guide complet d'intégration
- [QUICKSTART.md](QUICKSTART.md) - Démarrage rapide
- Ce fichier - Commandes de référence

## 💡 Tips

- Utilisez `nodemon` pour le développement (rechargement auto)
- Ouvrez deux terminaux : un pour le backend, un pour le frontend
- Gardez la page test-api.html ouverte pour déboguer
- Consultez la console du navigateur (F12) pour les erreurs
- Les logs du backend s'affichent dans le terminal

---

**Dernière mise à jour :** 14 janvier 2026
