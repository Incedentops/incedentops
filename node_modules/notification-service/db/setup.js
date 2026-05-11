const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');

const notificationSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          { type: 'string', maxLength: 36 },
    incident_id: { type: 'string' },
    channel:     { type: 'string' },
    message:     { type: 'string' },
    severity:    { type: 'string' },
    rule_name:   { type: 'string' },
    status:      { type: 'string' },
    sent_at:     { type: 'string' }
  },
  required: ['id', 'incident_id', 'channel', 'status', 'sent_at']
};

async function getDatabase() {
  const db = await createRxDatabase({
    name: 'notificationdb_' + Date.now(),
    storage: getRxStorageMemory(),
  });

  await db.addCollections({
    notifications: { schema: notificationSchema }
  });

  console.log('[Notification] RxDB initialisée en mémoire');
  return db;
}

module.exports = { getDatabase };