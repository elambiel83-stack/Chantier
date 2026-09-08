# Contexte de build: la racine du dépôt (voir docker-compose.yml), pas backend/ — le
# serveur sert web/ en statique depuis '../web' relatif à backend/ (voir server.js),
# donc l'image doit reproduire cette disposition de dossiers.

# Étage de build: python3/make/g++ ne servent qu'à compiler d'éventuels modules natifs
# (argon2...) si aucun binaire précompilé ne correspond à cette plateforme (musl/Alpine).
# Absents de l'image finale.
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
# psql: rejoue schema.sql à chaque démarrage (voir docker-entrypoint.sh). schema.sql est
# idempotent et conçu pour ça — voir la note du README sur les migrations manuelles.
RUN apk add --no-cache postgresql-client

WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY web/ /app/web

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
