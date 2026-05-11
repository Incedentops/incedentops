const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'incident-service',
  brokers: ['localhost:9092'],
  retry: { retries: 5, initialRetryTime: 300 }
});

const producer = kafka.producer();
let connected = false;

async function connect() {
  if (connected) return;
  await producer.connect();
  connected = true;
  console.log('[Incident] Kafka producer connecté');
}

async function publishIncidentCreated(incident) {
  await connect();
  await producer.send({
    topic: 'incident.created',
    messages: [{
      key: incident.id,
      value: JSON.stringify({
        incident_id: incident.id,
        title: incident.title,
        severity: incident.severity,
        service_name: incident.service_name,
        created_at: incident.created_at
      })
    }]
  });
  console.log(`[Incident] Événement publié → incident.created (id: ${incident.id})`);
}

async function disconnect() {
  if (connected) {
    await producer.disconnect();
    connected = false;
  }
}

module.exports = { publishIncidentCreated, disconnect };
