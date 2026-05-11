const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const opts = {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
};

const incidentPkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/incident.proto'), opts)
).incident;

const alertingPkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/alerting.proto'), opts)
).alerting;

const notificationPkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/notification.proto'), opts)
).notification;

const incidentClient = new incidentPkg.IncidentService(
  'localhost:50051', grpc.credentials.createInsecure()
);

const alertingClient = new alertingPkg.AlertingService(
  'localhost:50052', grpc.credentials.createInsecure()
);

const notificationClient = new notificationPkg.NotificationService(
  'localhost:50053', grpc.credentials.createInsecure()
);

// Promisifier les appels gRPC
function call(client, method, payload = {}) {
  return new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

module.exports = { incidentClient, alertingClient, notificationClient, call };
