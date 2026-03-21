// --- HOBIS CORE MODULE ---
// Global state, initialization, tab management, fullscreen

const STATE_STORE_KEY = 'hobis_app_state';

let currentMainTab = 'calendar', currentSubMode = 'decay_forward';
let currentData = [], myChart = null, nucOptionsHTML = "", logHistory = [];
let customerDB = [], customerHeaders = [], sourceInventory = [], selectedCustomer = null;
let map = null, marker = null;
let _cf252Initialized = false;
let _cf252SavedState = null;

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
    // GPS init (for log entries)
    logInitGps();

    // V6: Initialize store then restore state
    storeLoad().then(function() {
        evInitApp();
        return logLoadAll();
    }).then(function() {
        return storeGetKey(STATE_STORE_KEY);
    }).then(function(state) {
        const lastTab = (state && state.lastTab) || 'calendar';
        const tabMap = { 'flowcal': 0, 'decay': 1, 'shield': 2, 'cf252': 3, 'logistics': 4, 'order': 5 };
        const idx = tabMap[lastTab === 'calendar' ? 'flowcal' : lastTab];
        const btn = document.querySelectorAll('.tab-btn')[idx !== undefined ? idx : 0];
        if (state && state.cf252State) _cf252SavedState = state.cf252State;
        setMainTab(lastTab, btn);
    });

    if (typeof GLOBAL_DB === 'undefined') {
        console.warn("DB not loaded - calculation modules unavailable");
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

function _saveAppState() {
    const state = {
        lastTab: currentMainTab,
        cf252State: typeof cf252GetState === 'function' ? cf252GetState() : null,
    };
    storeSetKey(STATE_STORE_KEY, state);
}

function setMainTab(t, btn) {
    if (t === 'calendar') t = 'flowcal';
    currentMainTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = btn || (typeof event !== 'undefined' && event && event.target);
    if (activeBtn && activeBtn.classList) activeBtn.classList.add('active');

    _saveAppState();

    // Hide all panels
    document.getElementById('calcPanel').classList.add('hidden');
    document.getElementById('cf252Panel').classList.add('hidden');
    document.getElementById('cf252ReportPanel').classList.add('hidden');
    document.getElementById('logisticsLeftPanel').classList.add('hidden');
    document.getElementById('rightDetailPanel').classList.add('hidden');
    document.getElementById('rightReportPanel').classList.add('hidden');
    document.getElementById('flowCalPanel').classList.add('hidden');
    document.getElementById('flowCalDetailPanel').classList.add('hidden');
    document.getElementById('fcEmptyDetail').classList.add('hidden');
    document.getElementById('logPanel').classList.add('hidden');
    document.getElementById('orderPanel').classList.add('hidden');

    // FC mode: full-width layout for calendar and order
    const ws = document.querySelector('.workspace');
    if (t === 'flowcal') {
        ws.classList.add('fc-mode');
        document.getElementById('flowCalPanel').classList.remove('hidden');
    } else if (t === 'order') {
        ws.classList.add('fc-mode');
    } else {
        ws.classList.remove('fc-mode');
    }

    if (t === 'flowcal') {
        // already handled above
    } else if (t === 'order') {
        ws.classList.add('fc-mode');
        document.getElementById('orderPanel').classList.remove('hidden');
        roInit();
    } else if (t === 'cf252') {
        document.getElementById('logPanel').classList.remove('hidden');
        document.getElementById('cf252Panel').classList.remove('hidden');
        document.getElementById('cf252ReportPanel').classList.remove('hidden');
        // Only render on first visit; DOM preserved across tab switches
        if (!_cf252Initialized) {
            cf252RenderInputs();
            if (_cf252SavedState) {
                cf252RestoreState(_cf252SavedState);
                _cf252SavedState = null;
            }
            _cf252Initialized = true;
        }
    } else if (t === 'logistics') {
        document.getElementById('logPanel').classList.remove('hidden');
        document.getElementById('logisticsLeftPanel').classList.remove('hidden');
        document.getElementById('rightDetailPanel').classList.remove('hidden');
        if (map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        document.getElementById('logPanel').classList.remove('hidden');
        document.getElementById('calcPanel').classList.remove('hidden');
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
