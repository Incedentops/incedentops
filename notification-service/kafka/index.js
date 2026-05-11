const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: ['localhost:9092'],
  retry: { retries: 5, initialRetryTime: 300 }
});

const consumer = kafka.consumer({ groupId: 'notification-group' });
const producer = kafka.producer();

function simulateSend(channel, message, severity) {
  const icons = { slack: '💬', email: '📧', sms: '📱' };
  const icon = icons[channel] || '📨';
  console.log(`\n${icon} [Notification SIMULÉE] Canal: ${channel.toUpperCase()}`);
  console.log(`   Sévérité: ${severity}`);
  console.log(`   Message: ${message}\n`);
}

async function startKafka(dbInstance) {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'alert.triggered', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        console.log(`[Notification] alert.triggered reçu: incident ${data.incident_id} | canal: ${data.channel}`);

        const msg = `🚨 INCIDENT DÉTECTÉ\nID: ${data.incident_id}\nTitre: ${data.title}\nSévérité: ${data.severity}\nService: ${data.service_name}\nRègle: ${data.rule_name}`;

        // Simuler l'envoi
        simulateSend(data.channel, msg, data.severity);

        // Enregistrer dans RxDB
        const id = uuidv4();
        const now = new Date().toISOString();

        await dbInstance.notifications.insert({
          id,
          incident_id: data.incident_id,
          channel: data.channel,
          message: msg,
          severity: data.severity,
          rule_name: data.rule_name || '',
          status: 'SENT',
          sent_at: now
        });

        // Confirmer via notification.sent
        await producer.send({
          topic: 'notification.sent',
          messages: [{
            key: data.incident_id,
            value: JSON.stringify({
              notification_id: id,
              incident_id: data.incident_id,
              channel: data.channel,
              sent_at: now
            })
          }]
        });

        console.log(`[Notification] Confirmation publiée → notification.sent`);
      } catch (err) {
        console.error('[Notification] Erreur traitement alert.triggered:', err.message);
      }
    }
  });

  console.log('[Notification] Kafka consumer/producer démarrés');
}

module.exports = { startKafka };
