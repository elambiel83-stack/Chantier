# MonChantier — Starter Kit (Web + Mobile + Backend)

Un kit de démarrage prêt à personnaliser pour lancer vite le site et l’application mobile MonChantier.

## Dossier
- `web/` : site statique (HTML + Tailwind CDN) avec bilingue FR/EN, panier local et commande via WhatsApp.
- `mobile/` : app React Native Expo (Android & iOS) avec catalogue, recherche, page produit et bouton WhatsApp.
- `backend/` : `schema.sql` (PostgreSQL) et `openapi.yaml` (ébauche d’API REST).
- `assets/` : logo SVG.

---

## Lancer le site (web/)
Aucun build nécessaire.
1. Ouvrez `web/index.html` dans votre navigateur, ou servez le dossier avec un serveur statique (ex: `npx serve web`).
2. Modifiez les produits dans `web/products.js`.
3. Le panier envoie un message WhatsApp pré-rempli au numéro `+243 999 972 466`.

## Lancer l’app mobile (mobile/)
1. Prérequis : Node.js LTS et Expo CLI.
2. Dans `mobile/` : `npm install` puis `npm start` (ou `npx expo start`).
3. Testez sur Android/iOS avec l’app Expo Go ou `expo run:android` / `expo run:ios` pour build natif.

> Intégration WhatsApp : dans ce starter, le bouton est préparé. Pour ouvrir WhatsApp, ajoutez `import * as Linking from 'expo-linking';` puis `Linking.openURL(wa)`.

## Backend (backend/)
- Importez `schema.sql` dans PostgreSQL (ex : Supabase).
- Exposez des endpoints selon `openapi.yaml` (Node/Express, NestJS ou Next.js API routes).
- Exemple d’objets : `product`, `orders`, `order_item`, `customer`.

## À personnaliser rapidement
- **Logo final** : remplacez `assets/monchantier_logo.svg`.
- **Numéro WhatsApp** : cherchez `+243999972466` dans le code et remplacez si besoin.
- **Produits et prix** : modifiez `web/products.js` et le tableau `PRODUCTS` dans `mobile/App.js`.
- **Bilingue** : ajoutez d’autres clés dans `site.js`.

## Prochaines étapes recommandées
1. **Hébergement Web** : Netlify, Vercel ou GitHub Pages pour le dossier `web/`.
2. **Base de données & Auth** : Supabase (PostgreSQL + Auth) — synchroniser produits, prix, commandes.
3. **Paiements** : Intégrer Flutterwave/PayPal Mobile Money/MTN Momo si disponible localement (ou 100% à la livraison).
4. **Livraison** : Champ “localisation” + calcul des frais selon distance (Google Distance Matrix) + tableau de bord chauffeurs.
5. **Admin** : Back-office (produits, prix, stocks, commandes, zones, tarifs).
6. **Branding** : couleurs rouge Trucor, fonds texturés, slogans, QR code WhatsApp.

Bon lancement ! 🚀
