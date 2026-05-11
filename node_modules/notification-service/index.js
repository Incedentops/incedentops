const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./db/setup');
const { startKafka } = require('./kafka/index');

const PROTO_PATH = path.join(__dirname, '../proto/notification.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});

const notificationProto = grpc.loadPackageDefinition(packageDef).notification;

let dbInstance = null;

// ─── Handlers gRPC ───────────────────────────────────────────────────────────

async function SendNotification(call, callback) {
  try {
    const { incident_id, channel, message, severity, rule_name } = call.request;
    if (!incident_id || !channel || !message) {
      return callback(null, { success: false, error: 'incident_id, channel et message sont requis' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await dbInstance.notifications.insert({
      id,
      incident_id,
      channel,
      message,
      severity: severity || 'LOW',
      rule_name: rule_name || '',
      status: 'SENT',
      sent_at: now
    });

    console.log(`[Notification] Envoi manuel via gRPC → ${channel} | incident: ${incident_id}`);

    callback(null, { id, incident_id, channel, status: 'SENT', sent_at: now, success: true });
  } catch (err) {
    callback(null, { success: false, error: err.message });
  }
}

async function ListNotifications(call, callback) {
  try {
    const { incident_id } = call.request;
    let query;

    if (incident_id) {
      query = await dbInstance.notifications.find({ selector: { incident_id } }).exec();
    } else {
      query = await dbInstance.notifications.find().exec();
    }

    const notifications = query.map(doc => doc.toJSON());
    callback(null, { notifications, total: notifications.length });
  } catch (err) {
    callback(null, { notifications: [], total: 0 });
  }
}

async function GetStats(call, callback) {
  try {
    const all = await dbInstance.notifications.find().exec();
    const docs = all.map(d => d.toJSON());

    const stats = {
      total_sent: docs.filter(d => d.status === 'SENT').length,
      total_failed: docs.filter(d => d.status === 'FAILED').length,
      slack_count: docs.filter(d => d.channel === 'slack').length,
      email_count: docs.filter(d => d.channel === 'email').length,
      sms_count: docs.filter(d => d.channel === 'sms').length
    };

    callback(null, stats);
  } catch (err) {
    callback(null, { total_sent: 0, total_failed: 0, slack_count: 0, email_count: 0, sms_count: 0 });
  }
}

// ─── Démarrage ────────────────────────────────────────────────────────────────

async function main() {
  dbInstance = await getDatabase();

  try {
    await startKafka(dbInstance);
  } catch (err) {
    console.warn('[Notification] Kafka indisponible:', err.message);
  }

  const server = new grpc.Server();
  server.addService(notificationProto.NotificationService.service, {
    SendNotification: (call, cb) => SendNotification(call, cb),
    ListNotifications: (call, cb) => ListNotifications(call, cb),
    GetStats: (call, cb) => GetStats(call, cb)
  });

  server.bindAsync('0.0.0.0:50053', grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error('[Notification] Erreur:', err); process.exit(1); }
    console.log(`[Notification] Service gRPC démarré sur le port ${port}`);
  });
}

main();
