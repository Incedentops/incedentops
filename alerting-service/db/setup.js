const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'alerting.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    severity_threshold TEXT NOT NULL,
    service_name TEXT DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'slack',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    channel TEXT NOT NULL,
    triggered_at TEXT NOT NULL
  );
`);

// Insérer des règles par défaut si la table est vide
const count = db.prepare('SELECT COUNT(*) as c FROM rules').get();
if (count.c === 0) {
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO rules VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Alerte CRITICAL (tous services)', 'CRITICAL', '', 'slack', now);
  db.prepare(`INSERT INTO rules VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Alerte HIGH par email', 'HIGH', '', 'email', now);
  console.log('[Alerting] Règles par défaut créées');
}

module.exports = db;
