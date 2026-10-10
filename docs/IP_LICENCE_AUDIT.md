# Audit préliminaire des licences — Chantier.online
Date : 11 octobre 2026. Responsable déclaré du projet : LWAMBA LAMBI ERICK.
## Constat vérifié sur main
- Aucun fichier LICENSE/NOTICE/COPYRIGHT détecté dans l'arbre du dépôt (154 entrées).
- backend/package.json et web/package.json : champ "license": "ISC", champ "author" vide.
- mobile/package.json : pas de champ license ; "private": true concerne la publication npm, pas la confidentialité GitHub.
- Bibliothèques directes backend : @sentry/node, argon2, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken, jwks-rsa, pg, zod ; développement : @electric-sql/pglite, jsdom, nodemon.
- Mobile : Expo, React/React Native, React Navigation et modules Expo, entre autres.
- Frontend : Tailwind via CDN ; Google Tag Manager / Google Ads référencé sur main.
## Conclusions
**Non clarifié définitivement.** La mention ISC dans les manifestes est une indication de licence, à confronter à l'historique, à l'identité des ayants droit et aux éventuelles licences effectivement accordées. Ne pas effacer, modifier rétroactivement ou remplacer les licences existantes sans cette analyse. La propriété du code original ne couvre pas les dépendances tierces.
## Travaux obligatoires
1. Générer un SBOM sur chaque dossier (backend, mobile, web) à partir des lockfiles, relever licence et copyright de chaque paquet/version et les dépendances transitives.
2. Contrôler les licences et conditions des services, CDN, images, icônes et polices ; consigner notices et obligations de redistribution.
3. Reconstituer les auteurs réels et contrats pour chaque contribution significative ; distinguer comptes/agents IA et auteurs humains.
4. Établir le périmètre de code détenu personnellement par le fondateur et le périmètre soumis à autorisations/cessions.
5. Choisir une politique de licence **prospective** pour les nouvelles contributions et versions, après validation juridique.
6. Vérifier la visibilité GitHub : dépôt **public** lors du contrôle du 11/10/2026 ; privatisation à effectuer via Settings par un administrateur.
## Décision
Aucun changement de licence n'est appliqué dans ce commit. Statut : **audit initial terminé, clearance finale BLOQUÉE**.
