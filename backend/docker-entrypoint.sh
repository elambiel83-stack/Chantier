#!/bin/sh
# schema.sql est idempotent et fait office de migration (voir README > Base de données):
# il doit être rejoué à chaque déploiement, pas seulement à la création du volume
# PostgreSQL. On le fait ici pour que le conteneur reste à jour tout seul.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Application de schema.sql (idempotent)..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema.sql
fi

exec "$@"
