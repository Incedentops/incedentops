/* ===== CONFIG ===== */
let BASE_URL = localStorage.getItem('io_base_url') || 'http://localhost:3000';

function api(path, opts = {}) {
  return fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  }).then(r => r.json());
}

/* ===== NAVIGATION ===== */
const SECTIONS = ['overview','incidents','rules','alerts','notifications','apitester','graphql','settings'];
const TITLES = {
  overview: 'Vue d\'ensemble', incidents: 'Incidents', rules: 'Règles d\'alerte',
  alerts: 'Alertes', notifications: 'Notifications', apitester: 'API Tester', graphql: 'GraphQL Explorer', settings: 'Paramètres'
};

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    goSection(el.dataset.section);
  });
});

function goSection(name) {
  SECTIONS.forEach(s => {
    document.getElementById('section-' + s)?.classList.remove('active');
    document.getElementById('nav-' + s)?.classList.remove('active');
  });
  document.getElementById('section-' + name)?.classList.add('active');
  document.getElementById('nav-' + name)?.classList.add('active');
  document.getElementById('page-title').textContent = TITLES[name] || name;
  if (name === 'incidents') loadIncidents();
  else if (name === 'rules') loadRules();
  else if (name === 'alerts') loadAlerts();
  else if (name === 'notifications') loadNotifications();
  else if (name === 'settings') renderEndpoints();
  else if (name === 'apitester') updateCurlPreview();
}

/* ===== HEALTH CHECK ===== */
async function checkHealth() {
  const pill = document.getElementById('health-pill');
  const label = document.getElementById('health-label');
  const dot = document.getElementById('status-dot');
  try {
    const data = await api('/health');
    if (data.status === 'OK') {
      pill.className = 'health-pill ok';
      label.textContent = 'En ligne';
      dot.className = 'status-dot online';
    } else throw new Error();
  } catch {
    pill.className = 'health-pill err';
    label.textContent = 'Hors ligne';
    dot.className = 'status-dot offline';
  }
}

/* ===== TOAST ===== */
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ===== HELPERS ===== */
function toggleForm(id) {
  document.getElementById(id)?.classList.toggle('hidden');
}

function sevClass(s) {
  const m = { CRITICAL:'sev-critical', HIGH:'sev-high', MEDIUM:'sev-medium', LOW:'sev-low' };
  return m[(s||'').toUpperCase()] || 'sev-low';
}
function statusClass(s) {
  const m = { OPEN:'status-open', IN_PROGRESS:'status-in_progress', CLOSED:'status-closed' };
  return m[(s||'').toUpperCase()] || '';
}
function chClass(c) {
  const m = { slack:'ch-slack', email:'ch-email', sms:'ch-sms' };
  return m[(c||'').toLowerCase()] || '';
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return d; }
}
function shortId(id) { return id ? id.substring(0, 8) + '…' : '—'; }

function emptyState(msg = 'Aucun élément trouvé') {
  return `<div class="empty-state">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
    <p>${msg}</p>
  </div>`;
}

/* ===== OVERVIEW ===== */
async function loadOverview() {
  try {
    const [incRes, ruleRes, alertRes, notifRes, statsRes] = await Promise.all([
      api('/api/incidents?status=ALL').catch(() => ({ incidents: [] })),
      api('/api/rules').catch(() => ({ rules: [] })),
      api('/api/alerts').catch(() => ({ alerts: [] })),
      api('/api/notifications').catch(() => ({ notifications: [] })),
      api('/api/notifications/stats').catch(() => ({}))
    ]);

    const incidents = incRes.incidents || [];
    const rules = ruleRes.rules || [];
    const alerts = alertRes.alerts || [];
    const notifs = notifRes.notifications || [];

    document.getElementById('stat-incidents').textContent = incidents.length;
    document.getElementById('stat-rules').textContent = rules.length;
    document.getElementById('stat-alerts').textContent = alerts.length;
    document.getElementById('stat-notifs').textContent = statsRes.total_sent ?? notifs.length;
    document.getElementById('badge-incidents').textContent = incidents.filter(i => i.status !== 'CLOSED').length;
    document.getElementById('badge-rules').textContent = rules.length;
    document.getElementById('badge-alerts').textContent = alerts.length;

    // Recent incidents
    const list = document.getElementById('overview-incidents-list');
    if (!incidents.length) { list.innerHTML = emptyState('Aucun incident'); }
    else {
      list.innerHTML = incidents.slice(0, 5).map(i => `
        <div class="item-entry">
          <div>
            <div class="item-title">${i.title || '—'}</div>
            <div class="item-sub">${fmtDate(i.created_at)}</div>
          </div>
          <span class="severity ${sevClass(i.severity)}">${i.severity || '—'}</span>
          <span class="status-tag ${statusClass(i.status)}">${i.status || '—'}</span>
        </div>`).join('');
    }

    // Notif stats
    const ns = document.getElementById('overview-notif-stats');
    ns.innerHTML = `
      <div class="notif-stat-cell notif-stat-sent"><div class="notif-stat-num">${statsRes.total_sent ?? '—'}</div><div class="notif-stat-lbl">Envoyées</div></div>
      <div class="notif-stat-cell notif-stat-fail"><div class="notif-stat-num">${statsRes.total_failed ?? '—'}</div><div class="notif-stat-lbl">Échouées</div></div>
      <div class="notif-stat-cell"><div class="notif-stat-num" style="color:var(--purple)">${statsRes.slack_count ?? '—'}</div><div class="notif-stat-lbl">Slack</div></div>`;
  } catch (e) { console.error(e); }
}

/* ===== INCIDENTS ===== */
async function loadIncidents() {
  const el = document.getElementById('incidents-list');
  el.innerHTML = '<div class="skeleton-list"></div>';
  const status = document.getElementById('filter-status')?.value || 'ALL';
  try {
    const data = await api(`/api/incidents?status=${status}`);
    const incidents = data.incidents || [];
    document.getElementById('badge-incidents').textContent = incidents.filter(i => i.status !== 'CLOSED').length;
    if (!incidents.length) { el.innerHTML = emptyState('Aucun incident'); return; }
    el.innerHTML = `<table>
      <thead><tr>
        <th>Titre</th><th>Service</th><th>Sévérité</th><th>Statut</th><th>Créé le</th><th>Actions</th>
      </tr></thead>
      <tbody>${incidents.map(i => `
        <tr>
          <td><a href="#" onclick="showIncident('${i.id}')" style="color:var(--accent);text-decoration:none">${i.title || '—'}</a></td>
          <td>${i.service_name || '—'}</td>
          <td><span class="severity ${sevClass(i.severity)}">${i.severity || '—'}</span></td>
          <td><span class="status-tag ${statusClass(i.status)}">${i.status || '—'}</span></td>
          <td>${fmtDate(i.created_at)}</td>
          <td><div class="actions-cell">
            <button class="btn btn-xs btn-ghost" onclick="showIncident('${i.id}')">Détail</button>
            ${i.status !== 'CLOSED' ? `<button class="btn btn-xs btn-danger" onclick="closeIncidentUI('${i.id}')">Fermer</button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch { el.innerHTML = emptyState('Erreur de connexion au service'); }
}

async function createIncident() {
  const title = document.getElementById('inc-title').value.trim();
  const severity = document.getElementById('inc-severity').value;
  const service_name = document.getElementById('inc-service').value.trim();
  const description = document.getElementById('inc-desc').value.trim();
  if (!title) { toast('Le titre est requis', 'error'); return; }
  try {
    const res = await api('/api/incidents', { method: 'POST', body: JSON.stringify({ title, severity, service_name, description }) });
    if (res.success === false) { toast(res.error || 'Erreur création', 'error'); return; }
    toast('Incident créé avec succès', 'success');
    toggleForm('form-create-incident');
    ['inc-title','inc-service','inc-desc'].forEach(id => document.getElementById(id).value = '');
    loadIncidents(); loadOverview();
  } catch { toast('Erreur de connexion', 'error'); }
}

async function closeIncidentUI(id) {
  const resolution = prompt('Résolution (optionnel) :') ?? '';
  try {
    const res = await api(`/api/incidents/${id}/close`, { method: 'POST', body: JSON.stringify({ resolution }) });
    if (res.success === false) { toast(res.error || 'Erreur fermeture', 'error'); return; }
    toast('Incident fermé', 'success');
    loadIncidents(); loadOverview();
  } catch { toast('Erreur de connexion', 'error'); }
}

async function showIncident(id) {
  try {
    const data = await api(`/api/incidents/${id}`);
    if (!data.success) { toast('Incident introuvable', 'error'); return; }
    document.getElementById('modal-title').textContent = data.title || 'Incident';
    document.getElementById('modal-body').innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><label>ID</label><p style="font-family:var(--mono);font-size:11px">${data.id}</p></div>
        <div class="detail-item"><label>Service</label><p>${data.service_name || '—'}</p></div>
        <div class="detail-item"><label>Sévérité</label><p><span class="severity ${sevClass(data.severity)}">${data.severity}</span></p></div>
        <div class="detail-item"><label>Statut</label><p><span class="status-tag ${statusClass(data.status)}">${data.status}</span></p></div>
        <div class="detail-item"><label>Assigné à</label><p>${data.assigned_to || '—'}</p></div>
        <div class="detail-item"><label>Créé le</label><p>${fmtDate(data.created_at)}</p></div>
        <div class="detail-item" style="grid-column:span 2"><label>Description</label><p>${data.description || '—'}</p></div>
        <div class="detail-item" style="grid-column:span 2"><label>Résolution</label><p>${data.resolution || '—'}</p></div>
      </div>
      <div class="modal-update-form">
        <div class="card-title" style="margin-bottom:12px">Modifier l'incident</div>
        <div class="form-grid">
          <div class="form-group"><label>Sévérité</label>
            <select id="edit-severity">
              ${['LOW','MEDIUM','HIGH','CRITICAL'].map(s => `<option ${s===data.severity?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Statut</label>
            <select id="edit-status">
              ${['OPEN','IN_PROGRESS','CLOSED'].map(s => `<option ${s===data.status?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Assigné à</label>
            <input id="edit-assigned" type="text" value="${data.assigned_to || ''}" placeholder="nom@equipe.io" />
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" onclick="updateIncidentUI('${data.id}')">Mettre à jour</button>
          <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
        </div>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  } catch { toast('Erreur de connexion', 'error'); }
}

async function updateIncidentUI(id) {
  const severity = document.getElementById('edit-severity').value;
  const status = document.getElementById('edit-status').value;
  const assigned_to = document.getElementById('edit-assigned').value.trim();
  try {
    const res = await api(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ severity, status, assigned_to }) });
    if (res.success === false) { toast(res.error || 'Erreur mise à jour', 'error'); return; }
    toast('Incident mis à jour', 'success');
    closeModal(); loadIncidents(); loadOverview();
  } catch { toast('Erreur de connexion', 'error'); }
}

/* ===== RULES ===== */
async function loadRules() {
  const el = document.getElementById('rules-list');
  el.innerHTML = '<div class="skeleton-list"></div>';
  try {
    const data = await api('/api/rules');
    const rules = data.rules || [];
    document.getElementById('badge-rules').textContent = rules.length;
    if (!rules.length) { el.innerHTML = emptyState('Aucune règle définie'); return; }
    el.innerHTML = `<table>
      <thead><tr><th>Nom</th><th>Service</th><th>Seuil sévérité</th><th>Canal</th><th>Créé le</th><th>Actions</th></tr></thead>
      <tbody>${rules.map(r => `
        <tr>
          <td>${r.name || '—'}</td>
          <td>${r.service_name || '—'}</td>
          <td><span class="severity ${sevClass(r.severity_threshold)}">${r.severity_threshold || '—'}</span></td>
          <td><span class="channel-tag ${chClass(r.channel)}">${r.channel || '—'}</span></td>
          <td>${fmtDate(r.created_at)}</td>
          <td><button class="btn btn-xs btn-danger" onclick="deleteRuleUI('${r.id}')">Supprimer</button></td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch { el.innerHTML = emptyState('Erreur de connexion au service'); }
}

async function createRule() {
  const name = document.getElementById('rule-name').value.trim();
  const severity_threshold = document.getElementById('rule-threshold').value;
  const service_name = document.getElementById('rule-service').value.trim();
  const channel = document.getElementById('rule-channel').value;
  if (!name) { toast('Le nom est requis', 'error'); return; }
  try {
    const res = await api('/api/rules', { method: 'POST', body: JSON.stringify({ name, severity_threshold, service_name, channel }) });
    if (res.success === false) { toast(res.error || 'Erreur création', 'error'); return; }
    toast('Règle créée', 'success');
    toggleForm('form-create-rule');
    document.getElementById('rule-name').value = '';
    document.getElementById('rule-service').value = '';
    loadRules();
  } catch { toast('Erreur de connexion', 'error'); }
}

async function deleteRuleUI(id) {
  if (!confirm('Supprimer cette règle ?')) return;
  try {
    const res = await api(`/api/rules/${id}`, { method: 'DELETE' });
    if (res.success === false) { toast(res.error || 'Erreur suppression', 'error'); return; }
    toast('Règle supprimée', 'success');
    loadRules(); loadOverview();
  } catch { toast('Erreur de connexion', 'error'); }
}

/* ===== ALERTS ===== */
async function loadAlerts() {
  const el = document.getElementById('alerts-list');
  el.innerHTML = '<div class="skeleton-list"></div>';
  try {
    const data = await api('/api/alerts');
    const alerts = data.alerts || [];
    document.getElementById('badge-alerts').textContent = alerts.length;
    if (!alerts.length) { el.innerHTML = emptyState('Aucune alerte déclenchée'); return; }
    el.innerHTML = `<table>
      <thead><tr><th>Règle</th><th>Incident ID</th><th>Canal</th><th>Déclenchée le</th></tr></thead>
      <tbody>${alerts.map(a => `
        <tr>
          <td>${a.rule_name || '—'}</td>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${shortId(a.incident_id)}</span></td>
          <td><span class="channel-tag ${chClass(a.channel)}">${a.channel || '—'}</span></td>
          <td>${fmtDate(a.triggered_at)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch { el.innerHTML = emptyState('Erreur de connexion au service'); }
}

/* ===== NOTIFICATIONS ===== */
async function loadNotifications() {
  const el = document.getElementById('notifications-list');
  el.innerHTML = '<div class="skeleton-list"></div>';
  const incId = document.getElementById('filter-notif-id')?.value.trim() || '';
  try {
    const data = await api(`/api/notifications${incId ? '?incident_id=' + incId : ''}`);
    const notifs = data.notifications || [];
    if (!notifs.length) { el.innerHTML = emptyState('Aucune notification'); return; }
    el.innerHTML = `<table>
      <thead><tr><th>Canal</th><th>Sévérité</th><th>Règle</th><th>Statut</th><th>Message</th><th>Envoyée le</th></tr></thead>
      <tbody>${notifs.map(n => `
        <tr>
          <td><span class="channel-tag ${chClass(n.channel)}">${n.channel || '—'}</span></td>
          <td><span class="severity ${sevClass(n.severity)}">${n.severity || '—'}</span></td>
          <td>${n.rule_name || '—'}</td>
          <td>${n.status || '—'}</td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.message || '—'}</td>
          <td>${fmtDate(n.sent_at)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch { el.innerHTML = emptyState('Erreur de connexion au service'); }
}

async function sendNotification() {
  const incident_id = document.getElementById('notif-incident-id').value.trim();
  const channel = document.getElementById('notif-channel').value;
  const message = document.getElementById('notif-message').value.trim();
  const severity = document.getElementById('notif-severity').value;
  if (!incident_id || !message) { toast('Incident ID et message requis', 'error'); return; }
  try {
    const res = await api('/api/notifications', { method: 'POST', body: JSON.stringify({ incident_id, channel, message, severity }) });
    if (res.success === false) { toast(res.error || 'Erreur envoi', 'error'); return; }
    toast('Notification envoyée', 'success');
    toggleForm('form-send-notif');
    document.getElementById('notif-incident-id').value = '';
    document.getElementById('notif-message').value = '';
    loadNotifications();
  } catch { toast('Erreur de connexion', 'error'); }
}

/* ===== API TESTER ===== */
let _testerActive = null;

function loadTesterEndpoint(method, path, body, desc) {
  // Mark active button
  document.querySelectorAll('.apitester-ep-btn').forEach(b => b.classList.remove('active'));
  event?.currentTarget?.classList.add('active');

  document.getElementById('tester-method').value = method;
  document.getElementById('tester-url').value = path;
  document.getElementById('tester-body').value = body || '';
  document.getElementById('tester-desc').textContent = desc || path;
  document.getElementById('tester-result').textContent = '// Prêt à envoyer...';
  document.getElementById('tester-result').style.color = 'var(--text3)';
  document.getElementById('tester-status-badge').textContent = '';
  document.getElementById('tester-status-badge').className = 'tester-status-badge';
  _testerActive = { method, path, body, desc };
  updateCurlPreview();
  syncMethodColor();
}

function syncMethodColor() {
  const sel = document.getElementById('tester-method');
  const colors = { GET: 'var(--green)', POST: 'var(--accent)', PATCH: 'var(--orange)', DELETE: 'var(--red)' };
  sel.style.color = colors[sel.value] || 'var(--text)';
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('tester-method');
  if (sel) sel.addEventListener('change', () => { syncMethodColor(); updateCurlPreview(); });
  const urlInput = document.getElementById('tester-url');
  if (urlInput) urlInput.addEventListener('input', updateCurlPreview);
  const bodyInput = document.getElementById('tester-body');
  if (bodyInput) bodyInput.addEventListener('input', updateCurlPreview);
});

async function runTesterRequest() {
  const method  = document.getElementById('tester-method').value;
  const path    = document.getElementById('tester-url').value.trim();
  const bodyRaw = document.getElementById('tester-body').value.trim();
  const resultEl = document.getElementById('tester-result');
  const badge    = document.getElementById('tester-status-badge');

  if (!path) { toast('Entrez un chemin d\'endpoint', 'error'); return; }

  // Validate JSON body if present
  let bodyObj = null;
  if (bodyRaw && method !== 'GET' && method !== 'DELETE') {
    try { bodyObj = JSON.parse(bodyRaw); }
    catch { toast('Corps JSON invalide', 'error'); return; }
  }

  resultEl.style.color = 'var(--text3)';
  resultEl.textContent = '// Envoi en cours...';
  badge.textContent = '';
  badge.className = 'tester-status-badge';

  const start = Date.now();
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (bodyObj !== null) opts.body = JSON.stringify(bodyObj);

    const res = await fetch(BASE_URL + path, opts);
    const elapsed = Date.now() - start;
    let data;
    try { data = await res.json(); } catch { data = { raw: await res.text() }; }

    const isOk = res.status >= 200 && res.status < 300;
    const isWarn = res.status >= 300 && res.status < 500;

    badge.textContent = `${res.status} · ${elapsed}ms`;
    badge.className = 'tester-status-badge ' + (isOk ? 'ok' : isWarn ? 'warn' : 'err');
    resultEl.style.color = isOk ? 'var(--green)' : 'var(--red)';
    resultEl.textContent = JSON.stringify(data, null, 2);
    toast(isOk ? `✓ ${res.status} OK` : `✕ ${res.status} Erreur`, isOk ? 'success' : 'error');
  } catch (e) {
    const elapsed = Date.now() - start;
    badge.textContent = `ERR · ${elapsed}ms`;
    badge.className = 'tester-status-badge err';
    resultEl.style.color = 'var(--red)';
    resultEl.textContent = '// Erreur réseau: ' + e.message + '\n// Vérifiez que le gateway tourne sur ' + BASE_URL;
    toast('Erreur de connexion', 'error');
  }
}

function buildCurlCommand() {
  const method  = document.getElementById('tester-method')?.value || 'GET';
  const path    = document.getElementById('tester-url')?.value?.trim() || '/health';
  const bodyRaw = document.getElementById('tester-body')?.value?.trim() || '';
  const url = BASE_URL + path;

  let cmd = `curl -X ${method} "${url}"`;
  if (bodyRaw && method !== 'GET' && method !== 'DELETE') {
    cmd += ` \\
  -H "Content-Type: application/json" \\
  -d '${bodyRaw.replace(/\n/g, ' ')}'`;
  }
  return cmd;
}

function updateCurlPreview() {
  const el = document.getElementById('tester-curl');
  if (el) el.textContent = buildCurlCommand();
}

function copyTesterCurl() {
  const cmd = buildCurlCommand();
  navigator.clipboard.writeText(cmd).then(() => {
    toast('Commande curl copiée !', 'success');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = cmd;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Commande curl copiée !', 'success');
  });
}

/* ===== GRAPHQL ===== */
const GQL_PRESETS = {
  listIncidents: { q: `{ incidents { id title severity status service_name created_at } }`, v: '{}' },
  listRules: { q: `{ rules { id name severity_threshold service_name channel } }`, v: '{}' },
  listAlerts: { q: `{ alerts { id rule_name incident_id channel triggered_at } }`, v: '{}' },
  stats: { q: `{ notificationStats { total_sent total_failed slack_count email_count sms_count } }`, v: '{}' },
  createIncident: {
    q: `mutation CreateIncident($title: String!, $severity: String!, $service_name: String) {
  createIncident(title: $title, severity: $severity, service_name: $service_name) {
    id title status created_at
  }
}`,
    v: '{\n  "title": "Mon incident test",\n  "severity": "HIGH",\n  "service_name": "api-service"\n}'
  }
};

function setGqlPreset(name) {
  const p = GQL_PRESETS[name];
  if (!p) return;
  document.getElementById('gql-query').value = p.q;
  document.getElementById('gql-vars').value = p.v;
}

async function runGraphQL() {
  const query = document.getElementById('gql-query').value.trim();
  const varsRaw = document.getElementById('gql-vars').value.trim();
  const resultEl = document.getElementById('gql-result');
  if (!query) { toast('Entrez une requête GraphQL', 'error'); return; }
  let variables = {};
  try { if (varsRaw && varsRaw !== '{}') variables = JSON.parse(varsRaw); }
  catch { toast('Variables JSON invalides', 'error'); return; }
  resultEl.style.color = 'var(--text3)';
  resultEl.textContent = '// Exécution...';
  try {
    const res = await fetch(BASE_URL + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    resultEl.style.color = data.errors ? 'var(--red)' : 'var(--green)';
    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    resultEl.style.color = 'var(--red)';
    resultEl.textContent = '// Erreur: ' + e.message;
  }
}

/* ===== SETTINGS ===== */
function saveSettings() {
  const url = document.getElementById('setting-url').value.trim();
  if (!url) { toast('URL invalide', 'error'); return; }
  BASE_URL = url;
  localStorage.setItem('io_base_url', url);
  document.getElementById('status-url').textContent = url.replace('http://','').replace('https://','');
  toast('Configuration enregistrée', 'success');
  checkHealth();
}

function renderEndpoints() {
  const endpoints = [
    { m:'GET',    p:'/health',                     d:'Health check' },
    { m:'GET',    p:'/api/incidents',               d:'Lister incidents' },
    { m:'POST',   p:'/api/incidents',               d:'Créer incident' },
    { m:'GET',    p:'/api/incidents/:id',            d:'Obtenir incident' },
    { m:'PATCH',  p:'/api/incidents/:id',            d:'Modifier incident' },
    { m:'POST',   p:'/api/incidents/:id/close',      d:'Fermer incident' },
    { m:'GET',    p:'/api/rules',                    d:'Lister règles' },
    { m:'POST',   p:'/api/rules',                    d:'Créer règle' },
    { m:'DELETE', p:'/api/rules/:id',                d:'Supprimer règle' },
    { m:'GET',    p:'/api/alerts',                   d:'Lister alertes' },
    { m:'GET',    p:'/api/notifications',            d:'Lister notifications' },
    { m:'GET',    p:'/api/notifications/stats',      d:'Stats notifications' },
    { m:'POST',   p:'/api/notifications',            d:'Envoyer notification' },
    { m:'POST',   p:'/graphql',                      d:'GraphQL endpoint' },
  ];
  const mc = { GET:'m-get', POST:'m-post', PATCH:'m-patch', DELETE:'m-delete' };
  document.getElementById('endpoint-list').innerHTML = endpoints.map(e =>
    `<div class="endpoint-item">
      <span class="endpoint-method ${mc[e.m]||''}">${e.m}</span>
      <span class="endpoint-path">${e.p}</span>
      <span class="endpoint-desc">${e.d}</span>
    </div>`).join('');
}

/* ===== MODAL ===== */
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

/* ===== REFRESH ALL ===== */
function refreshAll() {
  checkHealth();
  loadOverview();
  const active = document.querySelector('.nav-item.active')?.dataset.section;
  if (active && active !== 'overview') goSection(active);
}

/* ===== INIT ===== */
(async function init() {
  document.getElementById('setting-url').value = BASE_URL;
  document.getElementById('status-url').textContent = BASE_URL.replace(/https?:\/\//, '');
  await checkHealth();
  await loadOverview();
  setInterval(checkHealth, 30000);
})();
