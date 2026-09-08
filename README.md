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
`APP_URL` (voir `backend/.env.example`) doit pointer vers le domaine public du site en production :
c’est lui qui sert à construire ces URLs de retour PayPal.

### Airtel Money et Orange Money

Aucune API de collecte automatisée n’est branchée pour ces deux opérateurs : la confirmation est
manuelle. Quand `paymentProvider` vaut `airtel_money` ou `orange_money`, `POST /api/orders` renvoie
en plus un objet `payment` (`payoutNumber`, `reference` = l’identifiant de la commande) que le
client utilise pour envoyer son paiement. Si le numéro marchand correspondant n’est pas défini
(`AIRTEL_MONEY_PAYOUT_NUMBER` / `ORANGE_MONEY_PAYOUT_NUMBER`), la commande est refusée avec un
`503` plutôt que créée sans moyen de payer.

Une fois le paiement reçu et vérifié manuellement (SMS, relevé marchand...), un membre `staff` ou
`admin` confirme la commande via `PATCH /api/orders/:orderId/status` (`{"status": "confirmed"}`),
ce qui marque aussi le paiement correspondant comme `paid`. Seul un `admin` peut faire cette
première transition (`pending → confirmed`) ; un `staff` ne peut réclamer
(`POST /api/orders/:orderId/claim`) et faire progresser qu'une commande déjà `confirmed`.

### Mes commandes et confirmation par e-mail

- `GET /api/orders` : historique du client connecté (`staff`/`admin` voient plus large, voir
  « Interface staff/admin » plus bas).
- `GET /api/orders/:orderId` : détail d'une commande avec ses articles (`items`), même périmètre
  d'accès que ci-dessus — un client qui n'est pas propriétaire de la commande reçoit un `404`,
  jamais un `403` qui confirmerait que la commande existe.
- `web/orders.html` (lien « Mes commandes » dans l'en-tête, visible une fois connecté avec un
  compte `customer`) liste ces commandes et charge le détail à la demande (au clic, pas au
  chargement de la page).

Un e-mail de confirmation est envoyé au client juste après la création de la commande (via
Resend, voir `RESEND_API_KEY`) : articles, total, instructions de paiement. Envoi purement
informatif et non bloquant — `channelAvailability().email` évite une tentative si Resend n'est
pas configuré, et un échec d'envoi (déjà configuré mais indisponible) n'empêche jamais la
création de la commande, seulement journalisé en avertissement.

## Panier

Un visiteur non connecté garde un panier purement local (`localStorage` côté web,
`AsyncStorage` côté mobile) : rien n'est envoyé au backend tant qu'il n'a pas de compte.

Une fois connecté, le panier est synchronisé entre appareils via trois routes authentifiées,
adossées à la table `cart_item` (par compte, pas par session anonyme) :

- `GET /api/cart` : `{ items: [{ id, qty }] }`.
- `PUT /api/cart` : remplace entièrement le panier serveur (`items: []` le vide). Même
  vérification indicative qu'à l'ajout côté panier local : produit existant et quantité ne
  dépassant pas le stock affiché — seul le passage de commande réserve réellement le stock.
- `DELETE /api/cart` : vide le panier serveur (appelé après une commande confirmée).

Le client (`web/site.js`+`web/config.js`, `mobile/context/CartContext.js`) applique la même
logique des deux côtés : à la connexion, panier local et panier serveur sont **fusionnés**
(quantités additionnées pour un même produit) puisque le local peut contenir des articles
ajoutés avant l'identification ; aux ouvertures suivantes (session déjà active), le panier
serveur est **adopté** tel quel — il peut refléter un ajout fait entre-temps depuis un autre
appareil. Chaque modification locale (ajout/retrait/quantité) pousse aussitôt le panier complet
vers le serveur (best-effort : une synchronisation qui échoue — hors ligne, session expirée —
laisse le panier local pleinement utilisable, sans bloquer l'UI).

## Authentification et rôles

L’API applique une authentification par jeton Bearer. Les mots de passe sont hachés avec Argon2id ; les jetons d’accès JWT ont une durée de 15 minutes et les jetons de renouvellement sont stockés sous forme de hachage et rotatifs.

Avant de démarrer le backend, définissez une valeur aléatoire d’au moins 32 caractères pour `JWT_ACCESS_SECRET` dans `backend/.env`. Ne versionnez jamais cette valeur.

## Déploiement derrière un reverse proxy

En production, l’app tourne presque toujours derrière un reverse proxy ou un load balancer
(Nginx, Render, Fly...). Définissez `TRUST_PROXY` dans `backend/.env` avec le nombre de sauts
de proxy de confiance (`1` pour un seul proxy devant l’app). Sans ce réglage, le rate-limiting
et la détection d’IP client se basent sur l’IP du proxy plutôt que sur celle du client, via
l’en-tête `X-Forwarded-For`.

**Avec Cloudflare devant Render (ou tout autre hébergeur déjà proxifié)** : comptez chaque
saut séparément. Render est déjà lui-même derrière son propre proxy (`TRUST_PROXY=1`). Si le
domaine passe aussi par Cloudflare en mode *Proxied* (nuage orange), c’est un deuxième saut :
`TRUST_PROXY=2`. En *DNS only* (nuage gris), un seul saut réel : `TRUST_PROXY=1`. Pendant la
vérification initiale du domaine personnalisé sur Render (émission du certificat Let’s
Encrypt), le enregistrement DNS doit être en *DNS only* — Render a besoin d’y résoudre
directement ; repassez en *Proxied* seulement après, et réglez alors le SSL/TLS Cloudflare sur
*Full (strict)* (jamais *Flexible*).

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

Le mot de passe PostgreSQL par défaut (`change-me`) ne convient qu'au développement local : en
production, créez un fichier `.env` à la racine du projet (lu automatiquement par `docker
compose`, à ne jamais committer — déjà couvert par `.gitignore`) contenant
`POSTGRES_PASSWORD=<mot de passe fort>`. Le port `5432` de PostgreSQL n'est de toute façon publié
que sur `127.0.0.1` (comme le port `3000` du backend, voir plus bas) : seul le backend y accède
via le réseau Compose interne, jamais depuis l'extérieur — mais un mot de passe fort reste la
bonne pratique si ce serveur héberge d'autres services ou des utilisateurs non root.

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

Avant tout envoi, `beforeSend` retire du corps et des en-têtes de requête capturés les mots de
passe, jetons (accès, renouvellement, Google/Apple/Turnstile), codes de vérification et
en-têtes `Authorization`/`Cookie` — Sentry ne doit jamais recevoir un secret, même dans le
contexte d'une erreur. Au-delà des exceptions, certains événements de sécurité qui ne sont pas
des bugs applicatifs sont explicitement remontés en `warning` (`captureSecurityEvent`) : CAPTCHA
Turnstile refusé, quota d'API ou d'envoi de code dépassé, trop de tentatives sur un code de
vérification — de quoi repérer un abus dans Sentry sans attendre qu'il devienne une erreur 500.

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

- `POST /api/auth/register` : `{ "email", "password", "fullName", "phone", "cf-turnstile-response"? }` ; le mot de passe doit contenir de 12 à 128 caractères.
- `POST /api/auth/login` : `{ "email", "password", "cf-turnstile-response"? }`.
- `POST /api/auth/google` : `{ "idToken" }` — jeton d'identité Google obtenu côté client (web ou mobile).
- `POST /api/auth/apple` : `{ "identityToken", "fullName"? }` — jeton d'identité Apple ("Sign in with Apple", l'authentification iCloud sur iOS) ; `fullName` n'est fourni par Apple qu'à la toute première connexion, le client doit donc le transmettre à ce moment-là.
- `POST /api/auth/refresh` : `{ "token" }` ; le jeton précédent devient immédiatement invalide.
- `GET /api/auth/me` : en-tête `Authorization: Bearer <accessToken>` ; renvoie aussi `email` et
  `verified` (booléen, dérivé de `verified_at`) pour que le client affiche le statut de
  vérification du compte.

`POST /api/auth/google` et `POST /api/auth/apple` vérifient le jeton reçu contre les clés
publiques du fournisseur (jamais contre ce que le client affirme dans le corps de la requête) —
voir `backend/oidc.js`, testé isolément (`backend/test/oidc.test.js`) sans dépendre de vrais
comptes Google/Apple. Répondent `503` tant que `GOOGLE_CLIENT_IDS`/`APPLE_CLIENT_IDS` (voir
`backend/.env.example`) ne sont pas définies. Un compte existant avec la même adresse e-mail
(déjà vérifiée par le fournisseur) est automatiquement relié plutôt que dupliqué ; sinon un
nouveau compte est créé sans mot de passe.

### CAPTCHA (Cloudflare Turnstile)

`cf-turnstile-response` (le jeton résolu par le widget Turnstile côté client) est vérifié auprès de
Cloudflare sur `/api/auth/register` et `/api/auth/login` — voir `backend/turnstile.js`, testé
isolément (`backend/test/turnstile.test.js`) avec Cloudflare mocké. Sans `TURNSTILE_SECRET_KEY`
défini, la vérification est un no-op qui laisse toujours passer (dev local sans compte
Cloudflare) ; définie, un jeton absent ou invalide est refusé (`403`) et l'événement remonté à
Sentry (voir plus bas). Le site key (public, à poser dans `web/auth.html`) n'est pas une
variable d'environnement backend.

Côté web, `web/auth.html` charge déjà le script Turnstile et affiche le widget dans les deux
formulaires (connexion/inscription) ; remplacez `YOUR_TURNSTILE_SITE_KEY` par la clé de site de
votre tableau de bord Cloudflare avant mise en production. Le champ caché injecté par le widget
(`cf-turnstile-response`) est ramassé automatiquement par `Object.fromEntries(new
FormData(form))` dans `web/auth.js`, sans code JS supplémentaire à écrire. CAPTCHA n'est branché
que côté web : il n'existe pas de SDK officiel Cloudflare Turnstile pour React Native/Expo, donc
l'app mobile n'affiche pas de CAPTCHA — `register`/`login` y fonctionnent simplement sans
`cf-turnstile-response` (champ optionnel).

### Vérification de compte (e-mail, SMS ou WhatsApp au choix du client)

- `GET /api/auth/verification/channels` : `{ email, sms, whatsapp }` — n'annonce un canal que
  s'il est réellement configuré côté backend (voir `backend/.env.example`), jamais un choix qui
  échouerait à l'envoi.
- `POST /api/auth/verification/send` (authentifié) : `{ "channel": "email"|"sms"|"whatsapp" }` —
  envoie un code à 6 chiffres, valable 10 minutes, sur l'e-mail ou le téléphone du compte. Limité
  à 3 envois par compte toutes les 15 minutes (SMS/WhatsApp ont un coût par message).
- `POST /api/auth/verification/confirm` (authentifié) : `{ "code" }` — 5 tentatives maximum par
  code avant qu'un nouveau code soit nécessaire. Marque le compte comme `verified_at` en base.

Côté web, `web/account.html`/`web/account.js` (lien « Mon compte » dans l'en-tête une fois
connecté) affichent le statut de vérification, ne proposent que les canaux réellement
disponibles (`GET /api/auth/verification/channels`), et enchaînent envoi puis saisie du code.
Ces routes étant de simples endpoints JSON, l'app mobile peut s'y brancher de la même façon ;
aucun écran dédié n'y a encore été construit dans ce lot — à faire avant de considérer la
vérification comme disponible sur mobile.

Aucune route existante ne conditionne son accès à `verified_at` : ce parcours de vérification
est disponible mais n'est pas (encore) imposé pour utiliser le site.

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
