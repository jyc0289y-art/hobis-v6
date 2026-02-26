// --- HOBIS CORE MODULE ---
// Global state, initialization, tab management, fullscreen

let currentMainTab = 'decay', currentSubMode = 'decay_forward';
let currentData = [], myChart = null, nucOptionsHTML = "", logHistory = [];
let customerDB = [], customerHeaders = [], sourceInventory = [], selectedCustomer = null;
let map = null, marker = null;

function isIOS() {
    return ['iPad Simulator','iPhone Simulator','iPod Simulator','iPad','iPhone','iPod'].includes(navigator.platform) ||
           (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function toggleFullScreen() {
    if (isIOS()) { alert("iOS: Use [Share] -> [Add to Home Screen]"); return; }
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e));
    else if (document.exitFullscreen) document.exitFullscreen();
}

window.onload = function() {
    if (typeof GLOBAL_DB === 'undefined') {
        alert("DB Error");
    } else {
        loadDB();
        renderInputs();
        addRouteRow();
        setTimeout(() => {
            if (!map) {
                map = L.map('map').setView([36.5, 127.5], 7);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);
            }
        }, 500);
    }
};

function loadDB() {
    const t = document.getElementById('dbSelector').value;
    currentData = GLOBAL_DB[t] || [];
    document.getElementById('sysStatus').innerText = `${t} ONLINE (${currentData.length})`;
    nucOptionsHTML = `<option value="MANUAL">[ MANUAL INPUT ]</option>`;
    currentData.forEach(n => {
        nucOptionsHTML += `<option value="${n.id}">${n.id}</option>`;
    });
}

function setMainTab(t) {
    currentMainTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if (t === 'logistics') {
        document.getElementById('calcPanel').classList.add('hidden');
        document.getElementById('logisticsLeftPanel').classList.remove('hidden');
        document.getElementById('rightDetailPanel').classList.remove('hidden');
        document.getElementById('rightReportPanel').classList.add('hidden');
        if (map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        document.getElementById('calcPanel').classList.remove('hidden');
        document.getElementById('logisticsLeftPanel').classList.add('hidden');
        document.getElementById('rightDetailPanel').classList.add('hidden');
        document.getElementById('rightReportPanel').classList.remove('hidden');

        document.getElementById('panelTitle').innerText = t === 'decay' ? "DECAY OPS" : "SHIELD OPS";
        if (t === 'decay') {
            document.getElementById('decayModeSwitch').classList.remove('hidden');
            document.getElementById('shieldModeSwitch').classList.add('hidden');
            setSubMode('decay_forward', document.querySelector('#decayModeSwitch .mode-opt'));
        } else {
            document.getElementById('decayModeSwitch').classList.add('hidden');
            document.getElementById('shieldModeSwitch').classList.remove('hidden');
            setSubMode('shield_forward', document.querySelector('#shieldModeSwitch .mode-opt'));
        }
    }
}

function setSubMode(m, e) {
    currentSubMode = m;
    e.parentElement.querySelectorAll('.mode-opt').forEach(o => o.classList.remove('active'));
    e.classList.add('active');
    renderInputs();
    document.getElementById('reportEmpty').classList.remove('hidden');
    document.getElementById('resultBox').classList.add('hidden');
}
