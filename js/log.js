// --- HOBIS LOG MODULE (Persistent) ---
// IndexedDB-backed permanent log with GPS + datetime
// Key: 'hobis_logs' in IDB store

const LOG_STORE_KEY = 'hobis_logs';
const LOG_GPS_KEY = 'hobis_gps_enabled';
let _logGpsCache = null;
let _logGpsWatchId = null;
let _logGpsEnabled = false;

// --- GPS Toggle ---
function logGpsToggle(forceState) {
    _logGpsEnabled = forceState !== undefined ? forceState : !_logGpsEnabled;
    storeSetKey(LOG_GPS_KEY, _logGpsEnabled);
    if (_logGpsEnabled) {
        logInitGps();
    } else {
        logStopGps();
    }
    logGpsUpdateUI();
}

function logGpsUpdateUI() {
    const btn = document.getElementById('gpsToggleBtn');
    if (!btn) return;
    btn.textContent = _logGpsEnabled ? 'GPS ON' : 'GPS OFF';
    btn.style.color = _logGpsEnabled ? 'var(--hobis-green)' : 'var(--hobis-warn)';
    btn.style.borderColor = _logGpsEnabled ? 'var(--hobis-green)' : 'var(--hobis-warn)';
}

function logGpsRestore() {
    storeGetKey(LOG_GPS_KEY).then(function(val) {
        _logGpsEnabled = val === true;
        if (_logGpsEnabled) logInitGps();
        logGpsUpdateUI();
    });
}

// --- GPS ---
function logInitGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        pos => { _logGpsCache = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }; },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
    );
    _logGpsWatchId = navigator.geolocation.watchPosition(
        pos => { _logGpsCache = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }; },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000 }
    );
}

function logStopGps() {
    if (_logGpsWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(_logGpsWatchId);
        _logGpsWatchId = null;
    }
    _logGpsCache = null;
}

function logGetGps() {
    if (!_logGpsEnabled) return null;
    return _logGpsCache ? { ...(_logGpsCache) } : null;
}

// --- Log persistence ---
function logLoadAll() {
    return storeGetKey(LOG_STORE_KEY).then(function(data) {
        logHistory = data || [];
        logRenderAll();
        console.log('Logs loaded: ' + logHistory.length + ' entries');
    });
}

function logSaveAll() {
    storeSetKey(LOG_STORE_KEY, logHistory);
}

// --- Add log entry ---
function addToLog(d) {
    const now = new Date();
    d.datetime = now.toISOString();
    d.timestamp = now.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    d.gps = logGetGps();
    d.id = generateId('log_');

    logHistory.push(d);
    logSaveAll();
    logRenderEntry(d, true);
}

// --- Render ---
function logRenderAll() {
    const container = document.getElementById('logContainer');
    if (!container) return;
    if (logHistory.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:10px; color:#555;">No logs.</div>';
        return;
    }
    container.innerHTML = '';
    for (let i = logHistory.length - 1; i >= 0; i--) {
        logRenderEntry(logHistory[i], false);
    }
}

function logRenderEntry(d, prepend) {
    const container = document.getElementById('logContainer');
    if (!container) return;
    const first = container.children[0];
    if (first && (first.textContent.includes('No logs') || first.textContent === 'Ready.')) {
        container.innerHTML = '';
    }

    const div = document.createElement('div');
    div.className = 'log-item';

    const gpsStr = d.gps
        ? `<span class="log-gps" title="정확도: ${d.gps.acc?.toFixed(0) || '?'}m">📍${d.gps.lat.toFixed(5)}, ${d.gps.lng.toFixed(5)}</span>`
        : '<span class="log-gps log-gps-none">📍N/A</span>';

    div.innerHTML = `<span class="log-time">[${d.timestamp}]</span> ${gpsStr} <span class="log-mode">${d.mode}</span> <span class="log-result">${d.resultVal} ${d.resultUnit}</span>`;

    if (prepend) container.prepend(div);
    else container.appendChild(div);
}

// --- Clear (with confirmation) ---
function clearLog() {
    if (logHistory.length > 0 && !confirm(`${logHistory.length}건의 로그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    logHistory = [];
    logSaveAll();
    document.getElementById('logContainer').innerHTML = '<div style="text-align:center; padding:10px; color:#555;">No logs.</div>';
}

// --- CSV Export (with GPS + datetime) ---
function downloadCSV() {
    if (logHistory.length === 0) return alert("Empty");
    let csv = "\uFEFFDatetime,Mode,Result,Unit,GPS_Lat,GPS_Lng,GPS_Acc\n";
    logHistory.forEach(r => {
        const lat = r.gps ? r.gps.lat.toFixed(6) : '';
        const lng = r.gps ? r.gps.lng.toFixed(6) : '';
        const acc = r.gps ? (r.gps.acc?.toFixed(0) || '') : '';
        csv += `${r.datetime || r.timestamp},${r.mode},${r.resultVal},${r.resultUnit},${lat},${lng},${acc}\n`;
    });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    l.download = `HOBIS_LOG_${dateStr}.csv`;
    l.click();
}

function showResult(m, s) {
    document.getElementById('resMain').innerText = m;
    document.getElementById('resSub').innerText = s;
}
