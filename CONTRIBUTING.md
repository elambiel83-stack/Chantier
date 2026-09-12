# Contribuer à Chantier

Merci pour votre contribution.

## Workflow recommandé

1. Créez une branche dédiée à votre changement.
2. Faites des changements ciblés et atomiques.
3. Mettez à jour la documentation si le comportement change.
4. Exécutez au minimum les tests backend :
   ```bash
   cd backend
   npm test
   ```
5. Ouvrez une Pull Request avec :
   - un résumé clair du problème ;
   - la description de la solution ;
   - les validations effectuées.

## Convention de qualité

- Évitez les changements non liés au besoin.
- Ne commitez jamais de secrets (`.env`, clés API, tokens).
- Respectez la structure existante (`backend/`, `web/`, `mobile/`).
