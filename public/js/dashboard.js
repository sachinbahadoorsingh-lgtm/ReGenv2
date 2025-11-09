import { setStatus, renderTable, copyTableToClipboard } from './ui.js';
import { apiPost, ensureCtxOrRedirect } from './geotab-client.js';

const ctx = ensureCtxOrRedirect();
const statusEl = document.getElementById('status');
const reportSelect = document.getElementById('reportSelect');
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const dataTable = document.getElementById('dataTable');
const logoutBtn = document.getElementById('logoutBtn');
const chartTitle = document.getElementById('chartTitle');
const chartCanvas = document.getElementById('reportChart');

let chart;

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('geotab_ctx');
  location.href = '/index.html';
});

(function setDefaultDates(){
  const from = new Date(); from.setMonth(from.getMonth()-1); from.setDate(1);
  const to = new Date(); to.setDate(0);
  document.getElementById('fromDate').value = from.toISOString().slice(0,10);
  document.getElementById('toDate').value = to.toISOString().slice(0,10);
})();

copyBtn.addEventListener('click', () => copyTableToClipboard(dataTable));

runBtn.addEventListener('click', async () => {
  const key = reportSelect.value;
  const fromDate = new Date(document.getElementById('fromDate').value + 'T00:00:00Z').toISOString();
  const toDate = new Date(document.getElementById('toDate').value + 'T23:59:59Z').toISOString();

  try {
    setStatus(statusEl, 'Fetching…');
    const [devices, rules, exceptions, trips] = await fetchInputs(key, fromDate, toDate);

    const devNameById = {};
    (devices || []).forEach(d => devNameById[d.id] = d.name || d.serialNumber || d.id);

    let headers = [];
    let rows = [];
    let chartCfg = { type: 'bar', labels: [], seriesLabel: '', data: [] };

    switch (key) {
      case 'speeding': {
        const id = findRuleId(rules, ['speeding']);
        ({ headers, rows, chartCfg } = countByRulePerVehicle(exceptions, id, devNameById, 'Speeding'));
        break;
      }
      case 'seatbelt': {
        const id = findRuleId(rules, ['seatbelt','seat belt']);
        ({ headers, rows, chartCfg } = countByRulePerVehicle(exceptions, id, devNameById, 'Seatbelt'));
        break;
      }
      case 'harsh_braking': {
        const id = findRuleId(rules, ['harsh braking','hard brake','harsh brake']);
        ({ headers, rows, chartCfg } = countByRulePerVehicle(exceptions, id, devNameById, 'Harsh Braking'));
        break;
      }
      case 'harsh_cornering': {
        const id = findRuleId(rules, ['harsh corner','harsh turn']);
        ({ headers, rows, chartCfg } = countByRulePerVehicle(exceptions, id, devNameById, 'Harsh Cornering'));
        break;
      }
      case 'harsh_acceleration': {
        const id = findRuleId(rules, ['harsh accel','harsh acceleration','hard accel']);
        ({ headers, rows, chartCfg } = countByRulePerVehicle(exceptions, id, devNameById, 'Harsh Acceleration'));
        break;
      }
      case 'general_events': {
        ({ headers, rows, chartCfg } = countAllEventsPerVehicle(exceptions, devNameById));
        break;
      }
      case 'events_by_type': {
        ({ headers, rows, chartCfg } = countEventsByType(exceptions));
        break;
      }
      case 'safety_scorecard': {
        ({ headers, rows, chartCfg } = safetyScorecard(exceptions, devNameById));
        break;
      }
      case 'distance': {
        ({ headers, rows, chartCfg } = distancePerVehicle(trips, devNameById));
        break;
      }
      case 'idle': {
        ({ headers, rows, chartCfg } = idleDriveDistance(trips, devNameById));
        break;
      }
      case 'utilization': {
        ({ headers, rows, chartCfg } = utilizationDays(trips, devNameById));
        break;
      }
    }

    chartTitle.textContent = prettyTitle(key);
    renderTable(dataTable, headers, rows);
    renderChart(chartCfg.labels, chartCfg.data, chartCfg.seriesLabel);

    setStatus(statusEl, `Done. ${rows.length} rows.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(statusEl, err.message, 'err');
  }
});

function prettyTitle(key) {
  const map = {
    speeding: 'Speeding',
    seatbelt: 'Seatbelt',
    harsh_braking: 'Harsh Braking',
    harsh_cornering: 'Harsh Cornering',
    harsh_acceleration: 'Harsh Acceleration',
    general_events: 'General Events per Vehicle',
    events_by_type: 'Events by Type',
    safety_scorecard: 'Safety Scorecard',
    distance: 'Distance per Vehicle',
    idle: 'Idle / Drive Time / Distance',
    utilization: 'Utilization (Days Driven)'
  };
  return map[key] || key;
}

async function fetchInputs(key, fromDate, toDate) {
  const needsExceptions = ['speeding','seatbelt','harsh_braking','harsh_cornering','harsh_acceleration','general_events','events_by_type','safety_scorecard'].includes(key);
  const needsTrips = ['distance','idle','utilization'].includes(key);

  const devicesP = apiPost('/api/devices', { ctx, limit: 100000 });
  const rulesP   = needsExceptions ? apiPost('/api/rules', { ctx, limit: 100000 }) : Promise.resolve(null);
  const excP     = needsExceptions ? apiPost('/api/exceptions', { ctx, fromDate, toDate, limit: 100000 }) : Promise.resolve(null);
  const tripsP   = needsTrips ? apiPost('/api/trips', { ctx, fromDate, toDate, limit: 100000 }) : Promise.resolve(null);

  const [devices, rules, exceptions, trips] = await Promise.all([devicesP, rulesP, excP, tripsP]);
  return [devices || [], rules || [], exceptions || [], trips || []];
}

function findRuleId(rules, needles) {
  const find = (name) => (name||'').toLowerCase();
  for (const r of rules) {
    const n = find(r.name);
    if (needles.some(nd => n.includes(nd))) return r.id;
  }
  return null;
}

function countByRulePerVehicle(events, ruleId, nameById, label) {
  if (!ruleId) return { headers:['Vehicle', `${label} Count`], rows:[], chartCfg:{type:'bar',labels:[],seriesLabel:label,data:[]} };
  const counts = {};
  events.forEach(e => {
    if (e.rule && e.rule.id === ruleId && e.device && e.device.id) {
      const id = e.device.id;
      counts[id] = (counts[id] || 0) + 1;
    }
  });
  const rows = Object.keys(nameById).map(id => [nameById[id], counts[id] || 0]).sort((a,b)=>b[1]-a[1]);
  return {
    headers: ['Vehicle', `${label} Count`],
    rows,
    chartCfg: { type:'bar', labels: rows.map(r=>r[0]), seriesLabel: label, data: rows.map(r=>r[1]) }
  };
}

function countAllEventsPerVehicle(events, nameById) {
  const counts = {};
  events.forEach(e => {
    const id = e.device && e.device.id;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  const rows = Object.keys(nameById).map(id => [nameById[id], counts[id] || 0]).sort((a,b)=>b[1]-a[1]);
  return {
    headers: ['Vehicle','Event Count'],
    rows,
    chartCfg: { type:'bar', labels: rows.map(r=>r[0]), seriesLabel:'Events', data: rows.map(r=>r[1]) }
  };
}

function countEventsByType(events) {
  const byRule = {};
  events.forEach(e => {
    const name = (e.rule && e.rule.name) ? e.rule.name : 'Unknown';
    byRule[name] = (byRule[name] || 0) + 1;
  });
  const pairs = Object.entries(byRule).sort((a,b)=>b[1]-a[1]);
  const rows = pairs.map(([k,v]) => [k, v]);
  return {
    headers: ['Rule','Event Count'],
    rows,
    chartCfg: { type:'bar', labels: rows.map(r=>r[0]), seriesLabel:'Events', data: rows.map(r=>r[1]) }
  };
}

function safetyScorecard(events, nameById) {
  const counts = {};
  events.forEach(e => {
    const id = e.device && e.device.id;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  const rows0 = Object.keys(nameById).map(id => [nameById[id], counts[id] || 0]).sort((a,b)=>b[1]-a[1]);
  const rows = rows0.map((r,i)=> [i+1, r[0], r[1]]);
  return {
    headers: ['Rank','Vehicle','Total Events'],
    rows,
    chartCfg: { type:'bar', labels: rows0.map(r=>r[0]), seriesLabel:'Events', data: rows0.map(r=>r[1]) }
  };
}

function distancePerVehicle(trips, nameById) {
  const byDev = {};
  trips.forEach(t => {
    const id = t.device && t.device.id; if (!id) return;
    let km = 0;
    if (typeof t.distance === 'number') km = t.distance / 1000;
    else if (typeof t.stopOdometer==='number' && typeof t.startOdometer==='number') km = (t.stopOdometer - t.startOdometer)/1000;
    byDev[id] = (byDev[id] || 0) + km;
  });
  const rows = Object.keys(nameById).map(id => [nameById[id], +(byDev[id] || 0).toFixed(2)]).sort((a,b)=>b[1]-a[1]);
  return {
    headers:['Vehicle','Distance (km)'],
    rows,
    chartCfg:{ type:'bar', labels: rows.map(r=>r[0]), seriesLabel:'Distance (km)', data: rows.map(r=>r[1]) }
  };
}

function idleDriveDistance(trips, nameById) {
  const byDev = {};
  trips.forEach(t => {
    const id = t.device && t.device.id; if (!id) return;
    const idleH = (t.idleDuration || 0)/3600;
    const driveH = (t.driveDuration || 0)/3600;
    let km = 0;
    if (typeof t.distance === 'number') km = t.distance / 1000;
    else if (typeof t.stopOdometer==='number' && typeof t.startOdometer==='number') km = (t.stopOdometer - t.startOdometer)/1000;
    if (!byDev[id]) byDev[id] = { idle:0, drive:0, km:0 };
    byDev[id].idle += idleH;
    byDev[id].drive += driveH;
    byDev[id].km += km;
  });
  const rows = Object.keys(nameById).map(id => [
    nameById[id],
    +((byDev[id]?.idle || 0).toFixed(2)),
    +((byDev[id]?.drive || 0).toFixed(2)),
    +((byDev[id]?.km || 0).toFixed(2)),
  ]).sort((a,b)=>b[3]-a[3]);
  return {
    headers:['Vehicle','Idle (h)','Drive (h)','Distance (km)'],
    rows,
    chartCfg:{ type:'bar', labels: rows.map(r=>r[0]), seriesLabel:'Distance (km)', data: rows.map(r=>r[3]) }
  };
}

function utilizationDays(trips, nameById) {
  const tz = 'UTC';
  const byDev = {};
  trips.forEach(t => {
    const id = t.device && t.device.id; if (!id) return;
    const d = new Date(t.start).toLocaleDateString('en-CA', { timeZone: tz });
    if (!byDev[id]) byDev[id] = {};
    byDev[id][d] = true;
  });
  const rows = Object.keys(nameById).map(id => [nameById[id], Object.keys(byDev[id] || {}).length]).sort((a,b)=>b[1]-a[1]);
  return {
    headers:['Vehicle','Days Driven'],
    rows,
    chartCfg:{ type:'bar', labels: rows.map(r=>r[0]), seriesLabel:'Days Driven', data: rows.map(r=>r[1]) }
  };
}

function renderChart(labels, data, seriesLabel) {
  if (chart) chart.destroy();
  chart = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: seriesLabel,
        data
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { ticks: { color: '#e7e9f3' } },
        y: { ticks: { color: '#e7e9f3' } }
      }
    }
  });
}
