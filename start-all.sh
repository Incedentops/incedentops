#!/bin/bash
# ============================================================
# Démarrage de tous les microservices IncidentOps
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         IncidentOps — Démarrage des services     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

echo "🚀 Lancement des microservices avec concurrently..."
echo ""

npx concurrently \
  --names "GATEWAY,INCIDENT,ALERTING,NOTIF" \
  --prefix-colors "yellow,cyan,magenta,green" \
  --kill-others-on-fail \
  "node gateway/index.js" \
  "node incident-service/index.js" \
  "node alerting-service/index.js" \
  "node notification-service/index.js"
