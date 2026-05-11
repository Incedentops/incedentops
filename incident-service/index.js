const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/setup');
const { publishIncidentCreated } = require('./kafka/producer');
const { startConsumer } = require('./kafka/consumer');

const PROTO_PATH = path.join(__dirname, '../proto/incident.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const incidentProto = grpc.loadPackageDefinition(packageDef).incident;

// ─── Handlers gRPC ───────────────────────────────────────────────────────────

function CreateIncident(call, callback) {
  try {
    const { title, description, severity, service_name } = call.request;

    if (!title || !severity) {
      return callback(null, { success: false, error: 'title et severity sont requis' });
    }

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity.toUpperCase())) {
      return callback(null, { success: false, error: `severity invalide. Valeurs: ${validSeverities.join(', ')}` });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO incidents (id, title, description, severity, status, service_name, assigned_to, resolution, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'OPEN', ?, '', '', ?, ?)
    `);
    stmt.run(id, title, description || '', severity.toUpperCase(), service_name || '', now, now);

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);

    // Publier sur Kafka de manière asynchrone
    publishIncidentCreated(incident).catch(err =>
      console.error('[Incident] Échec publication Kafka:', err.message)
    );

    console.log(`[Incident] Incident créé: ${id} | ${severity} | ${service_name}`);
    callback(null, { ...incident, success: true });
  } catch (err) {
    console.error('[Incident] CreateIncident error:', err.message);
    callback(null, { success: false, error: err.message });
  }
}

function GetIncident(call, callback) {
  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(call.request.id);
    if (!incident) return callback(null, { success: false, error: 'Incident non trouvé' });
    callback(null, { ...incident, success: true });
  } catch (err) {
    callback(null, { success: false, error: err.message });
  }
}

function ListIncidents(call, callback) {
  try {
    const { status } = call.request;
    let incidents;
    if (!status || status === 'ALL') {
      incidents = db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all();
    } else {
      incidents = db.prepare('SELECT * FROM incidents WHERE status = ? ORDER BY created_at DESC').all(status.toUpperCase());
    }
    callback(null, { incidents, total: incidents.length });
  } catch (err) {
    callback(null, { incidents: [], total: 0 });
  }
}

function UpdateIncident(call, callback) {
  try {
    const { id, severity, status, assigned_to } = call.request;
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    if (!incident) return callback(null, { success: false, error: 'Incident non trouvé' });

    const newSeverity = severity || incident.severity;
    const newStatus = status || incident.status;
    const newAssigned = assigned_to || incident.assigned_to;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE incidents SET severity = ?, status = ?, assigned_to = ?, updated_at = ? WHERE id = ?
    `).run(newSeverity, newStatus, newAssigned, now, id);

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    callback(null, { ...updated, success: true });
  } catch (err) {
    callback(null, { success: false, error: err.message });
  }
}

function CloseIncident(call, callback) {
  try {
    const { id, resolution } = call.request;
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    if (!incident) return callback(null, { success: false, error: 'Incident non trouvé' });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE incidents SET status = 'CLOSED', resolution = ?, updated_at = ? WHERE id = ?
    `).run(resolution || '', now, id);

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    console.log(`[Incident] Incident fermé: ${id}`);
    callback(null, { ...updated, success: true });
  } catch (err) {
    callback(null, { success: false, error: err.message });
  }
}

// ─── Démarrage du serveur gRPC ────────────────────────────────────────────────

async function main() {
  // Démarrer le consumer Kafka (optionnel si Kafka pas encore dispo)
  try {
    await startConsumer();
  } catch (err) {
    console.warn('[Incident] Consumer Kafka non démarré (Kafka indisponible?):', err.message);
  }

  const server = new grpc.Server();
  server.addService(incidentProto.IncidentService.service, {
    CreateIncident,
    GetIncident,
    ListIncidents,
    UpdateIncident,
    CloseIncident
  });

  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('[Incident] Erreur démarrage:', err);
      process.exit(1);
    }
    console.log(`[Incident] Service gRPC démarré sur le port ${port}`);
  });
}

main();
