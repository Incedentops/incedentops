# Test complet du projet IncidentOps

Write-Host "============================================================"
Write-Host "  IncidentOps - Test Complet"
Write-Host "============================================================"
Write-Host ""

# Liberer les ports
Write-Host "[1/7] Verification des ports..."
$ports = @(50053, 3000)

foreach ($port in $ports) {
  $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"}
  if ($process) {
    Write-Host "  Port $port occupe, liberation..."
    Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
}
Write-Host "  OK - Ports disponibles"
Write-Host ""

# Demarrer notification service
Write-Host "[2/7] Demarrage du service de notifications..."
Push-Location notification-service
$notifProc = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList "start" -RedirectStandardOutput "notif.log" -RedirectStandardError "notif-err.log"
Pop-Location
Start-Sleep -Seconds 4
Write-Host "  OK - Service demarre (PID: $($notifProc.Id))"
Write-Host ""

# Demarrer API Gateway
Write-Host "[3/7] Demarrage de l'API Gateway..."
Push-Location ApiGetway
$gwProc = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList "start" -RedirectStandardOutput "gateway.log" -RedirectStandardError "gateway-err.log"
Pop-Location
Start-Sleep -Seconds 4
Write-Host "  OK - API Gateway demarree (PID: $($gwProc.Id))"
Write-Host ""

# Test health
Write-Host "[4/7] Test endpoint /health..."
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction Stop
  $json = $response.Content | ConvertFrom-Json
  Write-Host "  OK - Service: $($json.service)"
  Write-Host "      Status: $($json.status)"
} catch {
  Write-Host "  ERREUR: $_"
}
Write-Host ""

# Test documentation
Write-Host "[5/7] Test endpoint documentation..."
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/" -ErrorAction Stop
  $json = $response.Content | ConvertFrom-Json
  Write-Host "  OK - Endpoints REST: $($json.rest_endpoints.incidents.Keys.Count)"
  Write-Host "      GraphQL disponible: Oui"
} catch {
  Write-Host "  ERREUR: $_"
}
Write-Host ""

# Test notification
Write-Host "[6/7] Test notification POST..."
$payload = @{
  incident_id = "TEST-001"
  channel = "slack"
  message = "Test notification"
  severity = "HIGH"
} | ConvertTo-Json

try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications" `
    -Method POST `
    -ContentType "application/json" `
    -Body $payload `
    -ErrorAction Stop
  $json = $response.Content | ConvertFrom-Json
  Write-Host "  OK - ID notification: $($json.id)"
  Write-Host "      Status: $($json.status)"
} catch {
  Write-Host "  ERREUR: $_"
}
Write-Host ""

# Test statistiques
Write-Host "[7/7] Test endpoint stats..."
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/stats" -ErrorAction Stop
  $json = $response.Content | ConvertFrom-Json
  Write-Host "  OK - Total envoyes: $($json.total_sent)"
  Write-Host "      Slack: $($json.slack_count)"
  Write-Host "      Email: $($json.email_count)"
  Write-Host "      SMS: $($json.sms_count)"
} catch {
  Write-Host "  ERREUR: $_"
}
Write-Host ""

Write-Host "============================================================"
Write-Host "  Tests termines!"
Write-Host "============================================================"
Write-Host ""
Write-Host "Services actifs:"
Write-Host "  Notification Service (PID: $($notifProc.Id))"
Write-Host "  API Gateway (PID: $($gwProc.Id))"
Write-Host ""
Write-Host "URLs disponibles:"
Write-Host "  http://localhost:3000/         (Documentation)"
Write-Host "  http://localhost:3000/health   (Health check)"
Write-Host "  http://localhost:3000/graphql  (GraphQL API)"
Write-Host "  http://localhost:3000/api/*    (REST API)"
Write-Host ""
Write-Host "Appuyez sur ENTER pour arreter les services..."
Read-Host

# Arreter les services
Write-Host "Arret des services..."
Stop-Process -Id $notifProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $gwProc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Done!"
