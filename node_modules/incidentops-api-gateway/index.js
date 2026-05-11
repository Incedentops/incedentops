const express = require('express');
const bodyParser = require('body-parser');
const { ApolloServer, gql } = require('apollo-server-express');
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
  apolloServer.applyMiddleware({ app, path: '/graphql' });

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

  // ─── Documentation des endpoints ───────────────────────────────────────────
  app.get('/', (req, res) => {
    res.json({
      service: 'IncidentOps API Gateway',
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        rest: {
          incidents: 'GET /api/incidents',
          create_incident: 'POST /api/incidents'
        },
        graphql: 'POST /graphql'
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`[Gateway] Serveur démarré sur http://localhost:${PORT}`);
    console.log(`[Gateway] GraphQL disponible sur http://localhost:${PORT}/graphql`);
    console.log(`[Gateway] REST API disponible sur http://localhost:${PORT}/api`);
  });
}

startServer().catch(err => {
  console.error('[Gateway] Erreur démarrage:', err);
  process.exit(1);
});
