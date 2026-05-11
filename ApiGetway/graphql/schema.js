const { incidentClient, alertingClient, notificationClient, call } = require('../grpc-clients');

const typeDefs = `#graphql
  type Incident {
    id: String
    title: String
    description: String
    severity: String
    status: String
    service_name: String
    assigned_to: String
    resolution: String
    created_at: String
    updated_at: String
  }

  type Rule {
    id: String
    name: String
    severity_threshold: String
    service_name: String
    channel: String
    created_at: String
  }

  type Alert {
    id: String
    incident_id: String
    rule_name: String
    channel: String
    triggered_at: String
  }

  type Notification {
    id: String
    incident_id: String
    channel: String
    message: String
    severity: String
    rule_name: String
    status: String
    sent_at: String
  }

  type NotificationStats {
    total_sent: Int
    total_failed: Int
    slack_count: Int
    email_count: Int
    sms_count: Int
  }

  type Dashboard {
    incident: Incident
    alerts: [Alert]
    notifications: [Notification]
  }

  type Query {
    # Incidents
    incidents(status: String): [Incident]
    incident(id: String!): Incident

    # Règles et alertes
    rules: [Rule]
    alerts: [Alert]

    # Notifications
    notifications(incident_id: String): [Notification]
    notificationStats: NotificationStats

    # Vue unifiée d'un incident avec ses alertes et notifications
    incidentDashboard(id: String!): Dashboard
  }

  type Mutation {
    createIncident(
      title: String!
      description: String
      severity: String!
      service_name: String
    ): Incident

    closeIncident(id: String!, resolution: String): Incident

    updateIncident(
      id: String!
      severity: String
      status: String
      assigned_to: String
    ): Incident

    createRule(
      name: String!
      severity_threshold: String!
      service_name: String
      channel: String!
    ): Rule

    deleteRule(id: String!): Boolean

    sendNotification(
      incident_id: String!
      channel: String!
      message: String!
      severity: String
    ): Notification
  }
`;

const resolvers = {
  Query: {
    incidents: async (_, { status }) => {
      const res = await call(incidentClient, 'ListIncidents', { status: status || 'ALL' });
      return res.incidents || [];
    },
    incident: async (_, { id }) => {
      const res = await call(incidentClient, 'GetIncident', { id });
      return res.success ? res : null;
    },
    rules: async () => {
      const res = await call(alertingClient, 'ListRules', {});
      return res.rules || [];
    },
    alerts: async () => {
      const res = await call(alertingClient, 'ListAlerts', {});
      return res.alerts || [];
    },
    notifications: async (_, { incident_id }) => {
      const res = await call(notificationClient, 'ListNotifications', { incident_id: incident_id || '' });
      return res.notifications || [];
    },
    notificationStats: async () => {
      return await call(notificationClient, 'GetStats', {});
    },
    incidentDashboard: async (_, { id }) => {
      const [incidentRes, alertsRes, notifRes] = await Promise.all([
        call(incidentClient, 'GetIncident', { id }),
        call(alertingClient, 'ListAlerts', {}),
        call(notificationClient, 'ListNotifications', { incident_id: id })
      ]);

      return {
        incident: incidentRes.success ? incidentRes : null,
        alerts: (alertsRes.alerts || []).filter(a => a.incident_id === id),
        notifications: notifRes.notifications || []
      };
    }
  },

  Mutation: {
    createIncident: async (_, args) => {
      const res = await call(incidentClient, 'CreateIncident', args);
      return res.success ? res : null;
    },
    closeIncident: async (_, { id, resolution }) => {
      const res = await call(incidentClient, 'CloseIncident', { id, resolution: resolution || '' });
      return res.success ? res : null;
    },
    updateIncident: async (_, args) => {
      const res = await call(incidentClient, 'UpdateIncident', args);
      return res.success ? res : null;
    },
    createRule: async (_, args) => {
      const res = await call(alertingClient, 'CreateRule', args);
      return res.success ? res : null;
    },
    deleteRule: async (_, { id }) => {
      const res = await call(alertingClient, 'DeleteRule', { id });
      return res.success;
    },
    sendNotification: async (_, args) => {
      const res = await call(notificationClient, 'SendNotification', args);
      return res.success ? res : null;
    }
  }
};

module.exports = { typeDefs, resolvers };
