Terminal 1 — Relancer Kafka et le laisser tourner

cd C:\Users\kafka\kafka_2.13-4.2.0
bin\windows\kafka-server-start.bat config\server.properties

Terminal 2 — Créer les 3 topics

cd C:\Users\kafka\kafka_2.13-4.2.0

bin\windows\kafka-topics.bat --create --bootstrap-server localhost:9092 --topic incident.created --partitions 1 --replication-factor 1

bin\windows\kafka-topics.bat --create --bootstrap-server localhost:9092 --topic alert.triggered --partitions 1 --replication-factor 1

bin\windows\kafka-topics.bat --create --bootstrap-server localhost:9092 --topic notification.sent --partitions 1 --replication-factor 1

Vérifier :
bin\windows\kafka-topics.bat --list --bootstrap-server localhost:9092


Terminal 3 — Incident Service
cd C:\Users\bechi\incedentops\incident-service
node index.js

Terminal 4 — Alerting Service
cd C:\Users\bechi\incedentops\alerting-service
node index.js

Terminal 5 — Notification Service
cmdcd C:\Users\bechi\incedentops\notification-service
node index.js


Terminal 6 — Gateway 
cd C:\Users\bechi\incedentops\ApiGetway
node index.js