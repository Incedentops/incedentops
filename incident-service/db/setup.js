const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'incidents.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'LOW',
    status TEXT NOT NULL DEFAULT 'OPEN',
    service_name TEXT,
    assigned_to TEXT DEFAULT '',
    resolution TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_confirmations (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    confirmed_at TEXT NOT NULL
  );
`);

module.exports = db;
