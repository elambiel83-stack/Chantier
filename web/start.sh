#!/bin/bash

# Script de démarrage rapide pour MonChantier
# Le backend sert l'API ET les pages web: une seule origine, donc pas de CORS,
# pas de contenu mixte et rien à configurer côté navigateur.

echo "🚀 Démarrage de MonChantier..."
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "Installez Node.js depuis https://nodejs.org"
    exit 1
fi

# Aller dans le dossier backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
WEB_DIR="$SCRIPT_DIR"

# Installer les dépendances si nécessaire
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances...${NC}"
    cd "$BACKEND_DIR"
    npm install
fi

# Démarrer le backend en arrière-plan (API + site sur le même port)
echo -e "${BLUE}🔧 Démarrage du site et de l'API sur http://localhost:3000${NC}"
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

# Attendre que le backend réponde vraiment (et pas seulement que le processus existe)
for attempt in $(seq 1 15); do
    if curl -sf http://localhost:3000/api/health > /dev/null; then
        break
    fi
    sleep 1
done

if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Démarré (PID: $BACKEND_PID)${NC}"
    curl -s http://localhost:3000/api/health
    echo ""
else
    echo -e "${RED}❌ Le serveur ne répond pas sur http://localhost:3000/api/health${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}✅ MonChantier est prêt !${NC}"
echo ""
echo "📍 Site      : http://localhost:3000/"
echo "📍 API       : http://localhost:3000/api"
echo "📍 État      : http://localhost:3000/api/health"
echo ""
echo "💡 N'ouvrez pas les pages depuis un autre serveur (python -m http.server, Live Server...) :"
echo "   le navigateur les servirait depuis une autre origine et les appels à l'API échoueraient"
echo "   avec « Failed to fetch »."
echo ""
echo "🧪 Pour tester l'API, ouvrez :"
echo "   http://localhost:3000/test-api.html"
echo ""
echo "🛑 Pour arrêter le backend :"
echo "   kill $BACKEND_PID"
echo ""

# Garder le script actif
echo "Appuyez sur Ctrl+C pour arrêter le backend..."
wait $BACKEND_PID
