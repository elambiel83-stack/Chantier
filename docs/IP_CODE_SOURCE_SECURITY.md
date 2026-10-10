# Procédure de protection du code source — Chantier.online

Responsable déclaré : **LWAMBA LAMBI ERICK**. Cette procédure est un plan de contrôle ; les actions non confirmées ne sont pas réputées effectuées.

1. Passer `elambiel83-stack/Chantier` en **Private** depuis GitHub Settings > General > Danger Zone. Vérifier ensuite la visibilité via l'API.
2. Vérifier que l'application GitHub connectée à ChatGPT reste autorisée à accéder au dépôt privé ; si nécessaire, sélectionner explicitement ce dépôt dans les permissions de l'application. Aucun mot de passe ou token à communiquer dans une conversation.
3. Réviser collaborateurs et applications autorisés ; principe du moindre privilège, accès temporaires, MFA.
4. Protéger `main` : PR avant fusion, vérifications CI, interdiction de force-push/suppression, règles selon le plan GitHub.
5. Auditer les secrets dans l'ensemble des branches, tags, historique et logs. Révoquer et remplacer toute clé compromise ; privatiser le dépôt n'efface pas les copies antérieures.
6. Inventorier les dépendances et leurs licences (voir `IP_LICENCE_AUDIT.md`), puis décider des licences futures **sans retrait rétroactif de droits acquis**.
7. Sauvegarder dans un coffre privé l'historique Git daté, les documents originaux, les preuves de création et la déclaration de paternité **signée**.
8. Ne jamais déposer signature manuscrite, pièce d'identité, contrats personnels ou secrets dans le dépôt.

## Déclaration à signer hors GitHub
Le fondateur doit signer personnellement le PDF `Declaration_Paternite_LWAMBA_LAMBI_ERICK_Chantier.pdf` fourni séparément. Le document non signé sur GitHub ne vaut pas signature. Conserver la copie signée et son empreinte SHA-256 dans un dossier privé. Une authentification et un avis juridique en RDC peuvent renforcer sa valeur probante.

## Statut
Au contrôle du 11/10/2026, visibilité API : **public**. Accès du connecteur : **admin**. Signature : **non réalisée par l'assistant**. Protections GitHub et audit complet des secrets : **non vérifiés**.
