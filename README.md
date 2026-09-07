# Chantier
vente en ligne des matériaux et services de construction

## Base de données

Le fichier `backend/schema.sql` est idempotent et fait aussi office de migration : il doit être
rejoué à chaque déploiement, pas seulement à la création du volume PostgreSQL. Docker Compose ne
l’exécute automatiquement (via `docker-entrypoint-initdb.d`) qu’au tout premier démarrage du volume
PostgreSQL ; une base déjà existante n’obtiendrait donc jamais les tables et colonnes ajoutées
depuis par ce seul mécanisme.

Avec `docker compose up -d` (voir plus bas), le conteneur `backend` rejoue `schema.sql` lui-même à
chaque démarrage (`backend/docker-entrypoint.sh`) : rien à faire manuellement dans ce cas. Pour un
déploiement qui n’utilise pas ce conteneur (Render, ou tout hébergeur qui exécute directement
`node server.js`), rejouez-le à la main à chaque déploiement :

```bash
psql "$DATABASE_URL" -f backend/schema.sql
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

### Airtel Money et Orange Money

Aucune API de collecte automatisée n’est branchée pour ces deux opérateurs : la confirmation est
manuelle. Quand `paymentProvider` vaut `airtel_money` ou `orange_money`, `POST /api/orders` renvoie
en plus un objet `payment` (`payoutNumber`, `reference` = l’identifiant de la commande) que le
client utilise pour envoyer son paiement. Si le numéro marchand correspondant n’est pas défini
(`AIRTEL_MONEY_PAYOUT_NUMBER` / `ORANGE_MONEY_PAYOUT_NUMBER`), la commande est refusée avec un
`503` plutôt que créée sans moyen de payer.

Une fois le paiement reçu et vérifié manuellement (SMS, relevé marchand...), un membre `staff` ou
`admin` confirme la commande via `PATCH /api/orders/:orderId/status` (`{"status": "confirmed"}`),
ce qui marque aussi le paiement correspondant comme `paid`.

## Authentification et rôles

L’API applique une authentification par jeton Bearer. Les mots de passe sont hachés avec Argon2id ; les jetons d’accès JWT ont une durée de 15 minutes et les jetons de renouvellement sont stockés sous forme de hachage et rotatifs.

Avant de démarrer le backend, définissez une valeur aléatoire d’au moins 32 caractères pour `JWT_ACCESS_SECRET` dans `backend/.env`. Ne versionnez jamais cette valeur.

## Déploiement derrière un reverse proxy

En production, l’app tourne presque toujours derrière un reverse proxy ou un load balancer
(Nginx, Render, Fly...). Définissez `TRUST_PROXY` dans `backend/.env` avec le nombre de sauts
de proxy de confiance (`1` pour un seul proxy devant l’app). Sans ce réglage, le rate-limiting
et la détection d’IP client se basent sur l’IP du proxy plutôt que sur celle du client, via
l’en-tête `X-Forwarded-For`.

Une sonde de santé est exposée sur `GET /healthz` (hors quota et hors authentification) : elle
vérifie la connexion à PostgreSQL et répond `503` si la base est injoignable. À utiliser pour le
health check de l’orchestrateur ou du monitoring d’uptime.

## Déploiement avec Docker Compose

`docker-compose.yml` fait tourner la pile complète : PostgreSQL et le backend (`backend/Dockerfile`,
qui inclut aussi `web/` — le backend sert le site en statique). Créez d’abord `backend/.env` (voir
`backend/.env.example`), puis :

```bash
docker compose up -d --build
```

Le backend rejoue `schema.sql` à chaque démarrage (voir « Base de données » plus haut) et n’écoute
que lorsque PostgreSQL répond (`depends_on` + `pg_isready`). `DATABASE_URL` est fixé par
`docker-compose.yml` (hôte `postgres`, celui du réseau Compose) ; toutes les autres variables
viennent de `backend/.env`.

Ceci convient à un serveur avec Docker (VPS...). Sur une plateforme qui gère déjà le déploiement
et le TLS (Render, Fly, Heroku...), ce `docker-compose.yml` n’est pas nécessaire — déployez-y
directement `backend/` (ou l’image construite par `backend/Dockerfile`) selon ses instructions.

### TLS (profil `tls`, optionnel)

Sur un serveur avec IP publique et nom de domaine mais sans TLS géré en amont, un service
[Caddy](https://caddyserver.com) optionnel (`Caddyfile`) termine le TLS avec un certificat Let’s
Encrypt obtenu et renouvelé automatiquement :

```bash
DOMAIN=exemple.com docker compose --profile tls up -d --build
```

Le domaine doit déjà pointer vers ce serveur (DNS `A`/`AAAA`) et les ports `80`/`443` être
accessibles publiquement — Caddy en a besoin pour la validation Let’s Encrypt. Inutile si la
plateforme d’hébergement termine déjà le TLS (c’est le cas de Render, notamment).

Le port `3000` du backend n’est publié que sur `127.0.0.1` (voir `docker-compose.yml`) : seul
Caddy y accède, via le réseau Compose interne, pas depuis l’extérieur.

## Suivi d’erreurs et arrêt propre

Définissez `SENTRY_DSN` dans `backend/.env` pour envoyer les erreurs serveur (500, exceptions non
interceptées) à [Sentry](https://sentry.io). Sans cette variable, elles restent seulement
journalisées sur la sortie standard — aucune donnée n’est envoyée nulle part. Les rejets CORS
(origine refusée) ne sont pas remontés : ce sont des refus attendus, pas des bugs.

Le serveur intercepte `SIGTERM`/`SIGINT` (envoyés par Render, Docker, systemd... à chaque
redéploiement ou arrêt) pour cesser d’accepter de nouvelles requêtes, laisser les requêtes en
cours se terminer, puis fermer le pool PostgreSQL avant de quitter — plutôt que de couper les
connexions net. Un arrêt forcé après 10 secondes évite de rester bloqué si une requête traîne.
Après une exception non interceptée (`uncaughtException`), l’état du process n’étant plus fiable,
le serveur s’arrête de la même façon plutôt que de continuer à servir des requêtes.

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

### Interface staff/admin

`web/admin.html` (lien « Commandes » dans l’en-tête, visible une fois connecté avec un compte
`staff` ou `admin`) donne une vue web sur la gestion des commandes, jusqu’ici accessible seulement
en appelant l’API directement : liste filtrable par statut, réclamation d’une commande par un
`staff`, et boutons de transition de statut adaptés au rôle et à l’affectation de chacun (le serveur
reste la seule autorité : un bouton affiché à tort échoue simplement en `409`). `GET /api/orders`
renvoie désormais aussi `payment_provider`/`payment_status` par commande, nécessaires pour vérifier
manuellement un paiement Airtel/Orange Money avant de confirmer.

La gestion des rôles (`PATCH /api/admin/users/:userId/role`) n’a pas d’interface : l’API ne propose
aucune route pour lister les utilisateurs, donc l’attribution de rôles reste à faire via un accès
direct à la base (voir ci-dessus) ou un appel API avec l’identifiant utilisateur déjà connu.
