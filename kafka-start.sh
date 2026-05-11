#!/bin/bash
# ============================================================
# Démarrage de Kafka en mode KRaft (sans Zookeeper)
# Kafka 3.x requis — https://kafka.apache.org/downloads
# ============================================================

KAFKA_DIR="${KAFKA_HOME:-./kafka}"

if [ ! -d "$KAFKA_DIR" ]; then
  echo "❌ Kafka non trouvé. Téléchargez Kafka 3.x depuis https://kafka.apache.org/downloads"
  echo "   Puis extrayez l'archive et définissez KAFKA_HOME ou placez le dossier kafka/ ici."
  exit 1
fi

STORAGE="$KAFKA_DIR/kafka-logs"

echo "🚀 Démarrage de Kafka en mode KRaft..."

# Générer un cluster ID unique (si pas encore fait)
if [ ! -f "$STORAGE/meta.properties" ]; then
  echo "📁 Initialisation du stockage Kafka..."
  CLUSTER_ID=$("$KAFKA_DIR/bin/kafka-storage.sh" random-uuid)
  "$KAFKA_DIR/bin/kafka-storage.sh" format -t "$CLUSTER_ID" -c "$KAFKA_DIR/config/kraft/server.properties"
  echo "✅ Stockage initialisé avec Cluster ID: $CLUSTER_ID"
fi

# Créer les topics
create_topics() {
  sleep 5
  echo "📌 Création des topics Kafka..."
  "$KAFKA_DIR/bin/kafka-topics.sh" --create --if-not-exists \
    --bootstrap-server localhost:9092 --topic incident.created --partitions 1 --replication-factor 1
  "$KAFKA_DIR/bin/kafka-topics.sh" --create --if-not-exists \
    --bootstrap-server localhost:9092 --topic alert.triggered --partitions 1 --replication-factor 1
  "$KAFKA_DIR/bin/kafka-topics.sh" --create --if-not-exists \
    --bootstrap-server localhost:9092 --topic notification.sent --partitions 1 --replication-factor 1
  echo "✅ Topics créés: incident.created | alert.triggered | notification.sent"
}

create_topics &

"$KAFKA_DIR/bin/kafka-server-start.sh" "$KAFKA_DIR/config/kraft/server.properties"
