# Chantier
vente en ligne des matériaux et services de construction

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

## Authentification et rôles

L’API applique une authentification par jeton Bearer. Les mots de passe sont hachés avec Argon2id ; les jetons d’accès JWT ont une durée de 15 minutes et les jetons de renouvellement sont stockés sous forme de hachage et rotatifs.

Avant de démarrer le backend, définissez une valeur aléatoire d’au moins 32 caractères pour `JWT_ACCESS_SECRET` dans `backend/.env`. Ne versionnez jamais cette valeur.

Les rôles sont les suivants :

- `customer` : crée ses commandes et ne consulte que les siennes.
- `staff` : consulte les commandes confirmées non affectées et celles qui lui sont affectées ; il réclame une commande puis la fait progresser.
- `admin` : consulte toutes les commandes, applique leurs transitions de statut et attribue les rôles.

Routes d’authentification :

- `POST /api/auth/register` : `{ "email", "password", "fullName", "phone" }` ; le mot de passe doit contenir de 12 à 128 caractères.
- `POST /api/auth/login` : `{ "email", "password" }`.
- `POST /api/auth/refresh` : `{ "token" }` ; le jeton précédent devient immédiatement invalide.
- `GET /api/auth/me` : en-tête `Authorization: Bearer <accessToken>`.

La création et la liste des commandes nécessitent aussi cet en-tête. Un membre `staff` réclame une commande confirmée au moyen de `POST /api/orders/:orderId/claim`; les membres `staff` et `admin` changent son statut avec `PATCH /api/orders/:orderId/status`. Seul un administrateur peut attribuer un rôle via `PATCH /api/admin/users/:userId/role`.

Pour créer le premier administrateur, inscrivez d’abord le compte puis, depuis un accès PostgreSQL administrateur, exécutez :

```sql
UPDATE user_account SET role = 'admin' WHERE email = 'admin@example.com';
```
