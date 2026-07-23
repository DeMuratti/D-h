/* app.fitbit.js — extracted from todo-app.html. Fitbit OAuth, data fetch, readiness scoring + UI. */

// ── FITBIT INTEGRATION ──────────────────────────────────────────

// ▶ PASTE YOUR FITBIT CLIENT ID HERE after registering at dev.fitbit.com
const FITBIT_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const FITBIT_REDIRECT   = window.location.origin + window.location.pathname;
const FITBIT_SCOPE      = 'heartrate sleep profile';

// Fitbit token stored in localStorage
let fitbitToken   = localStorage.getItem('fitbit_token')   || null;
let fitbitExpiry  = parseInt(localStorage.getItem('fitbit_expiry') || '0');
let readinessScore = null; // 0-100, null = not loaded

// ── OAUTH: open Fitbit login popup ───────────────────────────────
function fitbitConnect(){
  if(fitbitToken && Date.now() < fitbitExpiry){
    // Already connected — trigger a refresh instead
    fitbitFetchData(); return;
  }
  const params = new URLSearchParams({
    response_type: 'token',
    client_id:     FITBIT_CLIENT_ID,
    redirect_uri:  FITBIT_REDIRECT,
    scope:         FITBIT_SCOPE,
    expires_in:    '86400'
  });
  const authURL = 'https://www.fitbit.com/oauth2/authorize?' + params.toString();
  // Open in a popup so we can catch the redirect
  const popup = window.open(authURL, 'fitbit-auth',
    'width=500,height=700,scrollbars=yes');
  // Poll for the token in the popup URL
  const poll = setInterval(()=>{
    try {
      const hash = popup.location.hash;
      if(hash && hash.includes('access_token')){
        clearInterval(poll);
        popup.close();
        const p = new URLSearchParams(hash.slice(1));
        fitbitToken  = p.get('access_token');
        const expiresIn = parseInt(p.get('expires_in') || '86400');
        fitbitExpiry = Date.now() + expiresIn * 1000;
        localStorage.setItem('fitbit_token',  fitbitToken);
        localStorage.setItem('fitbit_expiry', String(fitbitExpiry));
        fitbitFetchData();
      }
    } catch(e){ /* cross-origin — popup still on Fitbit domain, keep waiting */ }
    if(popup.closed) clearInterval(poll);
  }, 500);
}

// ── FETCH today's data from Fitbit ───────────────────────────────
async function fitbitFetchData(){
  if(!fitbitToken){ fitbitConnect(); return; }
  const today_str = today(); // YYYY-MM-DD
  const headers   = { Authorization: 'Bearer ' + fitbitToken };

  // Show loading state
  $('readinessPlaceholder').style.display = 'none';
  $('readinessData').style.display = '';
  $('readinessStatusText').textContent = 'Loading…';
  $('readinessScoreNum').textContent   = '…';

  try {
    const [hrvRes, hrRes, sleepRes] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/hrv/date/${today_str}.json`, {headers}),
      fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today_str}/1d.json`, {headers}),
      fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today_str}.json`, {headers})
    ]);

    const [hrvData, hrData, sleepData] = await Promise.all([
      hrvRes.ok  ? hrvRes.json()  : null,
      hrRes.ok   ? hrRes.json()   : null,
      sleepRes.ok? sleepRes.json(): null
    ]);

    // ── Extract values ───────────────────────────────────────────
    // HRV (rmssd) — higher is better; typical range 20–80ms
    const rmssd = hrvData?.hrv?.[0]?.value?.dailyRmssd ?? null;

    // Resting HR — lower is better; typical range 45–80bpm
    const restingHR = hrData?.['activities-heart']?.[0]?.value?.restingHeartRate ?? null;

    // Sleep score — Fitbit provides 0–100 directly
    const sleepScore = sleepData?.summary?.stages
      ? calcSleepScore(sleepData.summary)
      : (sleepData?.sleep?.[0]?.efficiency ?? null);

    // ── Calculate composite readiness score 0–100 ────────────────
    readinessScore = calcReadiness(rmssd, restingHR, sleepScore);

    // Save for task flagging
    localStorage.setItem('fitbit_readiness', String(readinessScore));
    localStorage.setItem('fitbit_readiness_date', today_str);

    renderReadiness(readinessScore, rmssd, restingHR, sleepScore);

  } catch(err) {
    $('readinessStatusText').textContent = 'Could not load data';
    $('readinessMetrics').innerHTML = `<span class="readiness-metric">Check your connection and try again.</span>`;
  }
}

// ── SCORE CALCULATION ────────────────────────────────────────────
function calcSleepScore(summary){
  // Use stage composition: deep + rem = restorative sleep %
  const total = summary.totalMinutesAsleep || 1;
  const deep  = summary.stages?.deep  || 0;
  const rem   = summary.stages?.rem   || 0;
  const restorativePct = (deep + rem) / total;
  // Score: hours slept (max 9h = 100) * restorative ratio
  const hoursScore = Math.min(total / 540, 1) * 100;
  return Math.round(hoursScore * (0.5 + restorativePct * 0.5));
}

function calcReadiness(rmssd, restingHR, sleepScore){
  let score = 0, weight = 0;
  // HRV component (weight: 40%)
  if(rmssd !== null){
    // Map 15ms → 0, 70ms → 100
    const hrv = Math.max(0, Math.min(100, ((rmssd - 15) / 55) * 100));
    score  += hrv * 0.4; weight += 0.4;
  }
  // Resting HR component (weight: 30%) — lower is better
  if(restingHR !== null){
    // Map 85bpm → 0, 40bpm → 100
    const hr = Math.max(0, Math.min(100, ((85 - restingHR) / 45) * 100));
    score  += hr * 0.3; weight += 0.3;
  }
  // Sleep score component (weight: 30%)
  if(sleepScore !== null){
    score  += sleepScore * 0.3; weight += 0.3;
  }
  if(weight === 0) return null;
  return Math.round(score / weight);
}

// ── RENDER READINESS UI ──────────────────────────────────────────
function renderReadiness(score, rmssd, restingHR, sleepScore){
  if(score === null){
    $('readinessStatusText').textContent = 'No data yet today';
    $('readinessScoreNum').textContent = '–';
    return;
  }
  // Ring
  const circumference = 2 * Math.PI * 27; // 169.6
  const offset = circumference * (1 - score / 100);
  const ring = $('readinessRingFill');
  ring.style.strokeDashoffset = offset;
  const color = score >= 70 ? '#4A8A6C' : score >= 45 ? '#C4754A' : '#C44A4A';
  ring.style.stroke = color;
  $('readinessScoreNum').textContent = score;
  $('readinessScoreNum').style.color = color;
  // Status text
  const status = score >= 75 ? 'Ready to perform 💪'
               : score >= 55 ? 'Moderate — pace yourself'
               : score >= 35 ? 'Fatigued — take it easy'
               :               'Rest day recommended';
  $('readinessStatusText').textContent = status;
  $('readinessStatusText').style.color = color;
  // Metric chips
  const metrics = $('readinessMetrics');
  metrics.innerHTML = '';
  if(rmssd !== null) metrics.innerHTML += `<span class="readiness-metric">HRV <strong>${Math.round(rmssd)} ms</strong></span>`;
  if(restingHR !== null) metrics.innerHTML += `<span class="readiness-metric">Resting HR <strong>${restingHR} bpm</strong></span>`;
  if(sleepScore !== null) metrics.innerHTML += `<span class="readiness-metric">Sleep <strong>${sleepScore}/100</strong></span>`;
  // Border tint
  $('readinessStrip').classList.add('connected');
  // Re-render tasks so readiness flags update
  renderMainTasks();
}

// ── READINESS SLIDER IN TASK PANEL ──────────────────────────────
function updateReadinessSlider(){
  const v = parseInt($('taskReadinessMin').value);
  $('taskReadinessMinLabel').textContent = v === 0 ? 'Off' : String(v);
}

// ── CHECK READINESS FOR A TASK ───────────────────────────────────
function getReadinessFlagHTML(task){
  if(!task.readinessMin || task.readinessMin === 0) return '';
  const todayScore = parseInt(localStorage.getItem('fitbit_readiness') || '-1');
  const dataDate   = localStorage.getItem('fitbit_readiness_date');
  if(todayScore < 0 || dataDate !== today()) return ''; // no data
  if(todayScore < task.readinessMin){
    return `<div class="task-readiness-flag warn">⚠ Readiness ${todayScore} / min ${task.readinessMin}</div>`;
  }
  return `<div class="task-readiness-flag ok">✓ Readiness OK (${todayScore})</div>`;
}

// ── RESTORE TOKEN ON LOAD ────────────────────────────────────────
function fitbitRestoreSession(){
  if(fitbitToken && Date.now() < fitbitExpiry){
    $('readinessPlaceholder').style.display = 'none';
    $('readinessData').style.display = '';
    // Try to use cached score first for instant UI, then refresh
    const cached = localStorage.getItem('fitbit_readiness');
    const cachedDate = localStorage.getItem('fitbit_readiness_date');
    if(cached && cachedDate === today()){
      readinessScore = parseInt(cached);
      renderReadiness(readinessScore, null, null, null);
    }
    fitbitFetchData();
  }
}
