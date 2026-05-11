const express = require('express');
const bodyParser = require('body-parser');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { typeDefs, resolvers } = require('./graphql/schema');
const restRoutes = require('./rest/routes');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// ─── REST ─────────────────────────────────────────────────────────────────────
app.use('/api', restRoutes);

// ─── GraphQL ──────────────────────────────────────────────────────────────────
async function startServer() {
  const apolloServer = new ApolloServer({ typeDefs, resolvers });
  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }) => ({ req })
  }));

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      service: 'IncidentOps API Gateway',
      timestamp: new Date().toISOString(),
      endpoints: {
        rest: 'http://localhost:3000/api',
        graphql: 'http://localhost:3000/graphql'
      }
    });
  });

  // ─── Documentation des endpoints ──────────────────────────────────────────
  app.get('/', (req, res) => {
    res.json({
      name: 'IncidentOps API Gateway',
      version: '1.0.0',
      rest_endpoints: {
        incidents: {
          'POST   /api/incidents': 'Créer un incident',
          'GET    /api/incidents': 'Lister les incidents (?status=OPEN|CLOSED|ALL)',
          'GET    /api/incidents/:id': 'Obtenir un incident',
          'PATCH  /api/incidents/:id': 'Modifier un incident',
          'POST   /api/incidents/:id/close': 'Fermer un incident'
        },
        alerting: {
          'GET    /api/rules': 'Lister les règles d\'alerte',
          'POST   /api/rules': 'Créer une règle d\'alerte',
          'DELETE /api/rules/:id': 'Supprimer une règle',
          'GET    /api/alerts': 'Lister les alertes déclenchées'
        },
        notifications: {
          'GET    /api/notifications': 'Lister les notifications (?incident_id=...)',
          'GET    /api/notifications/stats': 'Statistiques de notifications',
          'POST   /api/notifications': 'Envoyer une notification manuelle'
        }
      },
      graphql: 'http://localhost:3000/graphql',
      graphql_examples: {
        query_dashboard: `{
  incidentDashboard(id: "your-incident-id") {
    incident { id title severity status service_name }
    alerts { rule_name channel triggered_at }
    notifications { channel status sent_at }
  }
}`,
        mutation_create: `mutation {
  createIncident(
    title: "DB down"
    severity: "CRITICAL"
    service_name: "auth-service"
    description: "Base de données principale inaccessible"
  ) {
    id title severity status created_at
  }
}`
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║   IncidentOps API Gateway démarré           ║`);
    console.log(`║   REST    → http://localhost:${PORT}/api       ║`);
    console.log(`║   GraphQL → http://localhost:${PORT}/graphql   ║`);
    console.log(`║   Docs    → http://localhost:${PORT}/          ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
  });
}

startServer().catch(err => {
  console.error('[Gateway] Erreur démarrage:', err);
  process.exit(1);
});
