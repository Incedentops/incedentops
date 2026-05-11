# ============================================================
# Script de Test - Projet IncidentOps
# ============================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗"
Write-Host "║     IncidentOps — Test Complet du Projet          ║"
Write-Host "╚════════════════════════════════════════════════════╝"
Write-Host ""

# Étape 1: Libérer les ports
Write-Host "📌 Étape 1: Vérification des ports..."
$ports = @(50053, 3000)

foreach ($port in $ports) {
  $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"}
  if ($process) {
    Write-Host "  ⚠️  Port $port occupé (PID: $($process.OwningProcess)), tentative de libération..."
    Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  } else {
    Write-Host "  ✅ Port $port libre"
  }
}

# Étape 2: Démarrer le service de notifications
Write-Host ""
Write-Host "📌 Étape 2: Démarrage du service de notifications..."
Set-Location notification-service
Start-Process -NoNewWindow -RedirectStandardOutput "..\notification-service.log" -FilePath "npm" -ArgumentList "start" -PassThru
$notifPID = $?
Start-Sleep -Seconds 3
Set-Location ..
Write-Host "  ✅ Service de notifications démarré (PID: $notifPID)"

# Étape 3: Démarrer l'API Gateway
Write-Host ""
Write-Host "📌 Étape 3: Démarrage de l'API Gateway..."
Set-Location ApiGetway
Start-Process -NoNewWindow -RedirectStandardOutput "..\gateway.log" -FilePath "npm" -ArgumentList "start" -PassThru
$gatewayPID = $?
Start-Sleep -Seconds 3
Set-Location ..
Write-Host "  ✅ API Gateway démarrée (PID: $gatewayPID)"

# Étape 4: Tests des endpoints
Write-Host ""
Write-Host "📌 Étape 4: Test des endpoints..."
Write-Host ""

# Test santé
Write-Host "🔍 Test 1: Santé du système (GET /health)"
$health = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction SilentlyContinue
if ($health.StatusCode -eq 200) {
  Write-Host "  ✅ Réponse: $(($health.Content | ConvertFrom-Json).status)"
  $health.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} else {
  Write-Host "  ❌ Erreur: $($health.StatusCode)"
}

Write-Host ""

# Test doc
Write-Host "🔍 Test 2: Documentation (GET /)"
try {
  $doc = Invoke-WebRequest -Uri "http://localhost:3000/" -ErrorAction SilentlyContinue
  if ($doc.StatusCode -eq 200) {
    $docJson = $doc.Content | ConvertFrom-Json
    Write-Host "  ✅ Services disponibles:"
    Write-Host "    - REST API: $($docJson.rest_endpoints.incidents.Keys.Count) endpoints incidents"
    Write-Host "    - GraphQL: $($docJson.graphql)"
  }
} catch {
  Write-Host "  ❌ Erreur: $_"
}

Write-Host ""

# Test notification manuelle
Write-Host "🔍 Test 3: Envoi de notification (POST /api/notifications)"
$payload = @{
  incident_id = "test-001"
  channel = "slack"
  message = "Alerte test : Service de base de données indisponible"
  severity = "CRITICAL"
  rule_name = "db-down-rule"
} | ConvertTo-Json

try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications" `
    -Method POST `
    -ContentType "application/json" `
    -Body $payload `
    -ErrorAction SilentlyContinue
  if ($response.StatusCode -eq 201) {
    Write-Host "  ✅ Notification créée:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
  }
} catch {
  Write-Host "  ❌ Erreur: $($_.Exception.Message)"
}

Write-Host ""

# Test lister les notifications
Write-Host "🔍 Test 4: Lister les notifications (GET /api/notifications)"
try {
  $notifs = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications" `
    -ErrorAction SilentlyContinue
  if ($notifs.StatusCode -eq 200) {
    $data = $notifs.Content | ConvertFrom-Json
    Write-Host "  ✅ Total de notifications: $($data.total)"
    if ($data.total -gt 0) {
      Write-Host "  Aperçu:"
      $data.notifications | Select-Object -First 2 | ConvertTo-Json | Write-Host
    }
  }
} catch {
  Write-Host "  ❌ Erreur: $($_.Exception.Message)"
}

Write-Host ""

# Test statistiques
Write-Host "🔍 Test 5: Statistiques des notifications (GET /api/notifications/stats)"
try {
  $stats = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/stats" `
    -ErrorAction SilentlyContinue
  if ($stats.StatusCode -eq 200) {
    Write-Host "  ✅ Statistiques:"
    $stats.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
  }
} catch {
  Write-Host "  ❌ Erreur: $($_.Exception.Message)"
}

Write-Host ""

# Test plusieurs notifications
Write-Host "🔍 Test 6: Envoi de notifications multiples..."
$channels = @("email", "sms", "slack")
foreach ($channel in $channels) {
  $payload = @{
    incident_id = "test-multi-001"
    channel = $channel
    message = "Notification de test sur canal $channel"
    severity = "INFO"
  } | ConvertTo-Json

  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications" `
      -Method POST `
      -ContentType "application/json" `
      -Body $payload `
      -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 201) {
      Write-Host "  ✅ $channel: notification créée"
    }
  } catch {
    Write-Host "  ❌ $channel: erreur"
  }
}

Write-Host ""

# Vérifier les stats finales
Write-Host "🔍 Test 7: Stats finales"
try {
  $finalStats = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/stats" `
    -ErrorAction SilentlyContinue
  if ($finalStats.StatusCode -eq 200) {
    $statsData = $finalStats.Content | ConvertFrom-Json
    Write-Host "  ✅ Résumé:"
    Write-Host "    - Total envoyés: $($statsData.total_sent)"
    Write-Host "    - Total échoués: $($statsData.total_failed)"
    Write-Host "    - Slack: $($statsData.slack_count)"
    Write-Host "    - Email: $($statsData.email_count)"
    Write-Host "    - SMS: $($statsData.sms_count)"
  }
} catch {
  Write-Host "  ❌ Erreur: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗"
Write-Host "║              ✅ Tests Terminés                    ║"
Write-Host "║                                                    ║"
Write-Host "║  📊 URLs disponibles:                              ║"
Write-Host "║    - Health: http://localhost:3000/health         ║"
Write-Host "║    - Docs:   http://localhost:3000/               ║"
Write-Host "║    - GraphQL: http://localhost:3000/graphql       ║"
Write-Host "║                                                    ║"
Write-Host "║  ⚠️  Note: Les services incidents et alertes      ║"
Write-Host "║     ne sont pas implémentés.                      ║"
Write-Host "╚════════════════════════════════════════════════════╝"
Write-Host ""

Write-Host "Les services sont en cours d'exécution. Appuyez sur Ctrl+C pour arrêter."
Write-Host "Logs disponibles: gateway.log et notification-service.log"
