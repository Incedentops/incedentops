const { createRxDatabase, addRxPlugin } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');
const { RxDBDevModePlugin } = require('rxdb/plugins/dev-mode');

// Désactiver le mode dev en production
// addRxPlugin(RxDBDevModePlugin);

const notificationSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    incident_id: { type: 'string' },
    channel: { type: 'string' },
    message: { type: 'string' },
    severity: { type: 'string' },
    rule_name: { type: 'string' },
    status: { type: 'string' },
    sent_at: { type: 'string' }
  },
  required: ['id', 'incident_id', 'channel', 'status', 'sent_at']
};

let db = null;

async function getDatabase() {
  if (db) return db;

  db = await createRxDatabase({
    name: 'notificationdb',
    storage: getRxStorageMemory(),
    ignoreDuplicate: true
  });

  await db.addCollections({
    notifications: { schema: notificationSchema }
  });

  console.log('[Notification] RxDB (NoSQL) initialisée en mémoire');
  return db;
}

module.exports = { getDatabase };
