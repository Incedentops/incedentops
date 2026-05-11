const express = require('express');
const router = express.Router();
const { incidentClient, alertingClient, notificationClient, call } = require('../grpc-clients');

// ─── INCIDENTS ────────────────────────────────────────────────────────────────

// POST /api/incidents — Créer un incident
router.post('/incidents', async (req, res) => {
  try {
    const result = await call(incidentClient, 'CreateIncident', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (err) {
    res.status(503).json({ error: 'Incident Service indisponible', details: err.message });
  }
});

// GET /api/incidents — Lister les incidents
router.get('/incidents', async (req, res) => {
  try {
    const { status } = req.query;
    const result = await call(incidentClient, 'ListIncidents', { status: status || 'ALL' });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Incident Service indisponible', details: err.message });
  }
});

// GET /api/incidents/:id — Obtenir un incident
router.get('/incidents/:id', async (req, res) => {
  try {
    const result = await call(incidentClient, 'GetIncident', { id: req.params.id });
    if (!result.success) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Incident Service indisponible', details: err.message });
  }
});

// PATCH /api/incidents/:id — Modifier un incident
router.patch('/incidents/:id', async (req, res) => {
  try {
    const result = await call(incidentClient, 'UpdateIncident', { id: req.params.id, ...req.body });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Incident Service indisponible', details: err.message });
  }
});

// POST /api/incidents/:id/close — Fermer un incident
router.post('/incidents/:id/close', async (req, res) => {
  try {
    const result = await call(incidentClient, 'CloseIncident', { id: req.params.id, ...req.body });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Incident Service indisponible', details: err.message });
  }
});

// ─── ALERTING ─────────────────────────────────────────────────────────────────

// GET /api/rules — Lister les règles
router.get('/rules', async (req, res) => {
  try {
    const result = await call(alertingClient, 'ListRules', {});
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Alerting Service indisponible', details: err.message });
  }
});

// POST /api/rules — Créer une règle
router.post('/rules', async (req, res) => {
  try {
    const result = await call(alertingClient, 'CreateRule', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (err) {
    res.status(503).json({ error: 'Alerting Service indisponible', details: err.message });
  }
});

// DELETE /api/rules/:id — Supprimer une règle
router.delete('/rules/:id', async (req, res) => {
  try {
    const result = await call(alertingClient, 'DeleteRule', { id: req.params.id });
    if (!result.success) return res.status(404).json({ error: result.error });
    res.json({ message: 'Règle supprimée', success: true });
  } catch (err) {
    res.status(503).json({ error: 'Alerting Service indisponible', details: err.message });
  }
});

// GET /api/alerts — Lister les alertes déclenchées
router.get('/alerts', async (req, res) => {
  try {
    const result = await call(alertingClient, 'ListAlerts', {});
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Alerting Service indisponible', details: err.message });
  }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

// GET /api/notifications — Lister les notifications
router.get('/notifications', async (req, res) => {
  try {
    const { incident_id } = req.query;
    const result = await call(notificationClient, 'ListNotifications', { incident_id: incident_id || '' });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Notification Service indisponible', details: err.message });
  }
});

// GET /api/notifications/stats — Statistiques
router.get('/notifications/stats', async (req, res) => {
  try {
    const result = await call(notificationClient, 'GetStats', {});
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: 'Notification Service indisponible', details: err.message });
  }
});

// POST /api/notifications — Envoyer une notification manuelle
router.post('/notifications', async (req, res) => {
  try {
    const result = await call(notificationClient, 'SendNotification', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (err) {
    res.status(503).json({ error: 'Notification Service indisponible', details: err.message });
  }
});

module.exports = router;
