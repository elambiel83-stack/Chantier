# Chantier - Construction Materials Marketplace

🏗️ **Plateforme professionnelle de vente de matériaux de construction avec transport et livraison à l'échelle mondiale**

## 📋 Description

Chantier est une marketplace complète qui connecte les acheteurs et vendeurs de matériaux de construction à travers le monde entier. La plateforme offre:

- 🛒 **Marketplace en ligne** - Vente et achat de matériaux de construction
- 🚚 **Transport intégré** - Organisation du transport et suivi de livraison en temps réel
- 🌍 **Portée mondiale** - Connexion entre vendeurs et acheteurs partout dans le monde
- 📱 **Applications multiplateforme** - Site web professionnel + applications mobiles (Android & iOS)

## 🏗️ Architecture du Projet

Le projet est composé de trois parties principales:

```
Chantier/
├── backend/          # API REST Node.js/Express
├── web/             # Application web React
└── mobile/          # Application mobile React Native
```

### Backend (API)
- **Framework**: Node.js + Express
- **Base de données**: MongoDB (avec Mongoose)
- **Authentification**: JWT
- **Features**: 
  - Gestion des utilisateurs (acheteurs, vendeurs, transporteurs)
  - Catalogue de produits avec recherche et filtres
  - Système de commandes complet
  - Gestion du transport et suivi
  - Système d'évaluation

### Web (Frontend)
- **Framework**: React 18
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Features**:
  - Interface utilisateur moderne et responsive
  - Catalogue de produits avec filtres
  - Panier d'achat
  - Authentification utilisateur
  - Tableaux de bord vendeur/acheteur
  - Suivi des commandes

### Mobile (iOS & Android)
- **Framework**: React Native
- **Navigation**: React Navigation
- **Features**:
  - Interface native pour iOS et Android
  - Navigation par onglets
  - Catalogue de produits
  - Panier et commandes
  - Profil utilisateur

## 🚀 Installation et Démarrage

### Prérequis

- Node.js (v16 ou supérieur)
- npm ou yarn
- MongoDB (local ou cloud)
- Pour mobile: React Native CLI, Android Studio / Xcode

### Installation complète

```bash
# Cloner le repository
git clone https://github.com/elambiel83-stack/Chantier.git
cd Chantier

# Installer toutes les dépendances (backend, web, mobile)
npm run install-all
```

### Configuration

1. **Backend**: Créer un fichier `.env` à la racine du projet
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

2. **Web**: Optionnel - créer `.env.local` dans le dossier `web/`
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

3. **Mobile**: Modifier l'URL de l'API dans `mobile/src/services/api.js`

### Démarrage des services

#### Backend (API)
```bash
# En mode développement avec rechargement automatique
npm run dev

# En mode production
npm start
```
L'API sera disponible sur: `http://localhost:5000`

#### Web
```bash
npm run web
# ou
cd web && npm start
```
L'application web sera disponible sur: `http://localhost:3000`

#### Mobile
```bash
# Démarrer le Metro bundler
npm run mobile

# Dans un autre terminal - Android
cd mobile && npx react-native run-android

# Dans un autre terminal - iOS
cd mobile && npx react-native run-ios
```

## 📚 Documentation API

### Endpoints principaux

#### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur

#### Produits
- `GET /api/products` - Liste des produits (avec filtres)
- `GET /api/products/:id` - Détails d'un produit
- `POST /api/products` - Créer un produit (vendeur)
- `PUT /api/products/:id` - Modifier un produit
- `DELETE /api/products/:id` - Supprimer un produit

#### Commandes
- `GET /api/orders` - Liste des commandes
- `GET /api/orders/:id` - Détails d'une commande
- `POST /api/orders` - Créer une commande
- `PATCH /api/orders/:id/status` - Mettre à jour le statut
- `POST /api/orders/:id/cancel` - Annuler une commande

#### Transport
- `GET /api/transport` - Liste des transports
- `GET /api/transport/:id` - Détails d'un transport
- `POST /api/transport` - Créer un transport
- `PATCH /api/transport/:id/status` - Mettre à jour le statut
- `POST /api/transport/:id/tracking` - Mettre à jour la localisation

#### Utilisateurs
- `GET /api/users` - Liste des utilisateurs
- `GET /api/users/:id` - Détails d'un utilisateur
- `PUT /api/users/:id` - Modifier un utilisateur

## 🎨 Features Principales

### Pour les Acheteurs
- Parcourir le catalogue de produits
- Rechercher et filtrer par catégorie, prix, localisation
- Ajouter au panier et passer commande
- Suivre les livraisons en temps réel
- Évaluer les vendeurs et produits

### Pour les Vendeurs
- Publier et gérer leurs produits
- Gérer les stocks
- Recevoir et traiter les commandes
- Tableau de bord avec statistiques
- Évaluations et réputation

### Pour les Transporteurs
- Accepter des missions de transport
- Mettre à jour les statuts de livraison
- Suivre les itinéraires
- Gérer les preuves de livraison

## 🗃️ Modèles de Données

### User (Utilisateur)
- Informations personnelles et de contact
- Rôle (acheteur, vendeur, transporteur, admin)
- Adresse et localisation
- Entreprise (pour vendeurs/transporteurs)
- Système d'évaluation

### Product (Produit)
- Informations du produit
- Prix et unité
- Stock disponible
- Catégorie
- Spécifications techniques
- Localisation
- Images

### Order (Commande)
- Articles commandés
- Montants (sous-total, livraison, taxes, total)
- Adresse de livraison
- Statuts (pending, confirmed, shipped, delivered, etc.)
- Paiement
- Timeline des événements

### Transport
- Commande associée
- Transporteur
- Type de transport
- Informations véhicule et conducteur
- Points de collecte et livraison
- Suivi GPS en temps réel
- Preuve de livraison

## 🔐 Sécurité

- Authentification JWT
- Hash des mots de passe avec bcrypt
- Validation des entrées
- Protection CORS
- Variables d'environnement pour les secrets

## 🌍 Internationalisation

- Interface en français
- Support multi-devises (USD par défaut)
- Adaptable à d'autres langues

## 📱 Technologies Utilisées

**Backend:**
- Node.js & Express
- MongoDB & Mongoose
- JWT & bcryptjs
- CORS & dotenv

**Web:**
- React 18
- React Router v6
- Axios
- React Icons
- CSS3

**Mobile:**
- React Native
- React Navigation
- Axios
- React Native Vector Icons

## 🤝 Contribution

Les contributions sont les bienvenues! Pour contribuer:

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue sur GitHub.

---

**Fait avec ❤️ pour la communauté de la construction**
