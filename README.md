# Chantier
vente en ligne des matériaux et services de construction

## Démarrage

Le backend sert l'API **et** les pages web sur le même port : une seule origine, donc ni CORS,
ni contenu mixte, ni adresse d'API à configurer côté navigateur.

```bash
cd backend && npm install && npm start   # ou bash web/start.sh
```

- Site : <http://localhost:3000/>
- API : <http://localhost:3000/api>
- État du service : <http://localhost:3000/api/health> — répond `200` avec l'état de la base,
  `503` si PostgreSQL est injoignable. C'est le premier appel à faire quand une page affiche
  « Failed to fetch ».

N'ouvrez pas les pages depuis un second serveur (`python -m http.server`, Live Server, aperçu
Vite…) : elles seraient servies depuis une autre origine, et les appels à l'API échoueraient. Si
vous devez malgré tout le faire, `web/config.js` déduit l'adresse de l'API de celle de la page
(port 3000 du même hôte) et l'origine peut être forcée avec `localStorage.setItem('apiBaseUrl', '…')`.
Les origines autorisées côté serveur se déclarent dans `CORS_ORIGIN` (`backend/.env`) ; en
Codespaces, les ports du codespace courant sont acceptés automatiquement.

## Base de données

Le fichier `backend/schema.sql` est idempotent et fait aussi office de migration : il doit être
rejoué à chaque déploiement, pas seulement à la création du volume PostgreSQL. Docker Compose ne
l’exécute qu’au tout premier démarrage du conteneur ; une base déjà existante n’obtiendrait donc
jamais les tables et colonnes ajoutées depuis.

```bash
docker compose up -d
docker exec -i chantier-postgres-1 psql -U monchantier -d monchantier < backend/schema.sql
```

Le stock, les prix et les catégories vivent dans la table `product` : c’est la source de vérité.
Le catalogue codé dans `backend/server.js` ne sert qu’à amorcer les produits absents de la base
(le stock existant n’est jamais écrasé) et de repli lorsque `DATABASE_URL` n’est pas défini. De
même, les taux de change facturés proviennent de la table `currency_rate` et sont exposés aux
clients par `GET /api/currency-rates` : les valeurs présentes dans `web/config.js` et l’app mobile
ne sont qu’un repli hors ligne.

## Commandes, stock et paiement

Le stock est réservé au moment de la création de la commande, dans la même transaction que
l’insertion : les lignes du catalogue sont verrouillées (`FOR UPDATE`) puis décrémentées
conditionnellement, ce qui rend la survente impossible même en cas de commandes simultanées
(réponse `409` quand le stock ne suffit plus). Passer une commande au statut `cancelled` rend
automatiquement les quantités au stock.

`POST /api/orders/:orderId/paypal` exige le jeton du client propriétaire de la commande. Il renvoie
un jeton de confirmation à usage unique, également placé dans l’URL de retour PayPal
(paramètre `ct`) : `POST /api/orders/:orderId/paypal/capture` l’exige, ce qui permet de confirmer
le paiement depuis n’importe quel navigateur sans session ouverte, mais seulement à qui revient de
PayPal. Le montant réellement encaissé est comparé à celui de la commande avant confirmation.
Le panier propose également `stripe_card` et `google_pay`. Ces deux options utilisent Stripe
Checkout : les données de carte ne transitent jamais par MonChantier et Google Pay apparaît
automatiquement lorsque le navigateur, le domaine HTTPS et le compte Stripe sont éligibles.
La commande est confirmée uniquement par le webhook signé `POST /api/webhooks/stripe` après
réception d’un événement de paiement réussi. Configurez `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` et `APP_URL` dans `backend/.env`.

## Authentification et rôles

L’API applique une authentification par jeton Bearer et un contrôle d’accès RBAC (Role-Based Access Control). Les mots de passe sont hachés avec Argon2id ; les jetons d’accès JWT ont une durée de 15 minutes et les jetons de renouvellement sont stockés sous forme de hachage et rotatifs.

Avant de démarrer le backend, définissez une valeur aléatoire d’au moins 32 caractères pour `JWT_ACCESS_SECRET` dans `backend/.env`. Ne versionnez jamais cette valeur.

Les rôles sont les suivants :

- `customer` : crée ses commandes et ne consulte que les siennes.
- `staff` : consulte les commandes confirmées non affectées et celles qui lui sont affectées ; il réclame une commande puis la fait progresser.
- `admin` : consulte toutes les commandes, applique leurs transitions de statut et attribue les rôles.

Permissions effectives :

- `customer` : `orders:create`, `orders:read_own`, `payments:create_own`.
- `staff` : `orders:read_operational`, `orders:claim`, `orders:update_assigned`.
- `admin` : `orders:read_all`, `orders:update_any`, `users:assign_role`.

L’accès est refusé par défaut lorsqu’aucune permission ne correspond. Les contrôles de propriété
du client et d’affectation du membre `staff` restent appliqués en complément du RBAC.

Routes d’authentification :

- `POST /api/auth/register` : `{ "email", "password", "fullName", "phone" }` ; le mot de passe doit contenir de 12 à 128 caractères.
- `POST /api/auth/login` : `{ "email", "password" }`.
- `GET /api/auth/social-config` : indique quels boutons Google/Facebook afficher côté client (client ID / app ID publics, ou `null` si non configuré).
- `POST /api/auth/google` : `{ "credential" }` ; jeton d'identité renvoyé par Google Identity Services. Relie ou crée un compte à partir de l'e-mail vérifié par Google.
- `POST /api/auth/facebook` : `{ "accessToken" }` ; jeton d'accès renvoyé par le SDK Facebook, vérifié auprès de l'API Graph avant toute connexion.
- `POST /api/auth/refresh` : `{ "token" }` ; le jeton précédent devient immédiatement invalide.
- `GET /api/auth/me` : en-tête `Authorization: Bearer <accessToken>` ; renvoie aussi les permissions effectives.
- `POST /api/auth/logout` : `{ "token" }` ; révoque le jeton de renouvellement fourni.
- `POST /api/auth/forgot-password` : `{ "channel": "email|sms|whatsapp", "identifier": "..." }` ; envoie un lien générique de récupération.
- `POST /api/auth/reset-password` : `{ "token", "password" }` ; consomme le lien et révoque les sessions existantes.

La récupération expire après 15 minutes et le jeton n’est jamais stocké en clair. Configurez
`RESEND_API_KEY` et `MAIL_FROM` pour l’e-mail, ou `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et
`TWILIO_FROM` pour SMS/WhatsApp. L’URL publique de retour est définie par `APP_URL`.

Connexion Google et Facebook : configurez `GOOGLE_CLIENT_ID` (Google Cloud Console) et
`FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` (Meta for Developers) dans `backend/.env` ; laissez ces
variables vides pour désactiver le fournisseur correspondant, le bouton disparaît alors
automatiquement côté web et mobile. Le mot de passe est optionnel pour un compte créé ainsi ; si un
compte avec le même e-mail existe déjà, la connexion sociale s’y relie au lieu d’en créer un
second.

La création et la liste des commandes nécessitent aussi cet en-tête. Un membre `staff` réclame une commande confirmée au moyen de `POST /api/orders/:orderId/claim`; les membres `staff` et `admin` changent son statut avec `PATCH /api/orders/:orderId/status`. Seul un administrateur peut attribuer un rôle via `PATCH /api/admin/users/:userId/role`.

Pour créer le premier administrateur, inscrivez d’abord le compte puis, depuis un accès PostgreSQL administrateur, exécutez :

```sql
UPDATE user_account SET role = 'admin' WHERE email = 'admin@example.com';
```

Chaque changement de rôle réussi est écrit dans `audit_log` avec l’action `user.role_updated`,
l’identifiant de l’acteur, l’utilisateur cible et le nouveau rôle. Un administrateur ne peut pas
modifier son propre rôle via l’API.
