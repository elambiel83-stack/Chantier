# Matrice RBAC — Chantier.online

Le serveur est l'autorité. Masquer un bouton dans l'interface ne constitue jamais un contrôle d'accès.

| Rôle | Périmètre naturel |
|---|---|
| admin | Administration globale, utilisateurs, catalogue plateforme, conformité, opérations et comptabilité |
| accountant | Comptabilité et rapports financiers uniquement |
| site_manager | Opérations de chantier/commandes autorisées, sans administration globale |
| supplier | Profil partenaire et ressources appartenant à son vendor_id |
| carrier | Profil transporteur, ressources appartenant à son vendor_id et missions de transport qui le concernent |
| driver | Missions/livraisons qui lui sont explicitement affectées |
| support | Tickets et suivi client autorisés, sans catalogue, conformité ni comptabilité |
| customer | Ses propres commandes, devis, paiements, imports et tickets |
| vendor | Rôle historique conservé pendant la migration des partenaires |
| staff | Rôle historique conservé pendant la migration des agents |

## Règles
- Toute route sensible combine authentification, rôle autorisé et, lorsque nécessaire, filtre de propriété/affectation.
- Un rôle annoncé dans le JWT n'écrase jamais le rôle actif enregistré en base.
- `supplier` et `carrier` restent rattachés à un `vendor_id`; ils n'obtiennent pas les données d'un autre partenaire.
- `driver` n'est pas un administrateur opérationnel : son accès doit rester limité aux missions affectées.
- Les anciens rôles `vendor` et `staff` restent compatibles afin d'éviter une migration destructive immédiate.
- Les droits d'administration du catalogue de la PR #22 restent exclusivement `admin`.

## Migration
Les comptes historiques doivent être reclassés progressivement de `vendor` vers `supplier` ou `carrier`, et de `staff` vers `site_manager`, `driver` ou `support`, après vérification de leur fonction réelle.
