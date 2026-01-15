#!/bin/bash

# Script de démarrage rapide pour MonChantier
# Ce script démarre le backend et ouvre le frontend

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

# Démarrer le backend en arrière-plan
echo -e "${BLUE}🔧 Démarrage du backend sur http://localhost:3000${NC}"
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

# Attendre que le backend soit prêt
sleep 2

# Vérifier si le backend est démarré
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Backend démarré (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Erreur lors du démarrage du backend${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ MonChantier est prêt !${NC}"
echo ""
echo "📍 Backend API : http://localhost:3000/api"
echo "📍 Frontend : Utilisez un serveur web pour ouvrir web/index.html"
echo ""
echo "💡 Pour démarrer le frontend :"
echo "   cd $WEB_DIR"
echo "   python3 -m http.server 8080"
echo ""
echo "🧪 Pour tester l'API, ouvrez :"
echo "   http://localhost:8080/test-api.html"
echo ""
echo "🛑 Pour arrêter le backend :"
echo "   kill $BACKEND_PID"
echo ""

# Garder le script actif
echo "Appuyez sur Ctrl+C pour arrêter le backend..."
wait $BACKEND_PID
