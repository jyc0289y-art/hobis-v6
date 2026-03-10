// --- HOBIS V6 STORE MODULE ---
// localStorage-based persistence layer for projects and events

const STORE_KEY = 'hobis_v6';
const STORE_VERSION = '1.0.0';

let _storeData = null;

function generateId(prefix) {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return (prefix || '') + hex;
}

function _storeDefault() {
    return { projects: [], events: [], meta: { version: STORE_VERSION, lastModified: new Date().toISOString() } };
}

function storeLoad() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        _storeData = raw ? JSON.parse(raw) : _storeDefault();
        if (!_storeData.meta) _storeData.meta = { version: STORE_VERSION, lastModified: new Date().toISOString() };
        if (!_storeData.projects) _storeData.projects = [];
        if (!_storeData.events) _storeData.events = [];
    } catch (e) {
        console.error('Store load error:', e);
        _storeData = _storeDefault();
    }
    return _storeData;
}

function storeSave() {
    if (!_storeData) return;
    _storeData.meta.lastModified = new Date().toISOString();
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(_storeData));
    } catch (e) {
        console.error('Store save error:', e);
        alert('localStorage 저장 실패. 용량이 부족할 수 있습니다.');
    }
}

function storeGetData() { return _storeData || storeLoad(); }
function storeGetProjects() { return storeGetData().projects; }
function storeGetEvents() { return storeGetData().events; }

// --- Projects ---
function storeCreateProject(opts) {
    const data = storeGetData();
    const proj = {
        id: generateId('pj_'),
        name: opts.name || 'Untitled',
        color: opts.color || '#00f7ff',
        createdAt: new Date().toISOString()
    };
    data.projects.push(proj);
    storeSave();
    return proj;
}

function storeUpdateProject(id, changes) {
    const data = storeGetData();
    const idx = data.projects.findIndex(p => p.id === id);
    if (idx === -1) return null;
    Object.assign(data.projects[idx], changes);
    storeSave();
    return data.projects[idx];
}

function storeDeleteProject(id) {
    const data = storeGetData();
    const idx = data.projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    data.projects.splice(idx, 1);
    // Clear projectId on orphaned events
    data.events.forEach(ev => { if (ev.projectId === id) ev.projectId = null; });
    storeSave();
    return true;
}

function storeFindProject(id) {
    return storeGetProjects().find(p => p.id === id) || null;
}

// --- Events ---
function storeCreateEvent(opts) {
    const data = storeGetData();
    const ev = {
        id: generateId('ev_'),
        title: opts.title || '',
        description: opts.description || '',
        projectId: opts.projectId || null,
        start: opts.start || '',
        end: opts.end || '',
        location: opts.location || '',
        author: opts.author || '',
        author_position: opts.author_position || '',
        attendees: opts.attendees || [],
        comments: opts.comments || [],
        file_names: opts.file_names || [],
        date_text: opts.date_text || _buildDateText(opts.start, opts.end),
        created_at: opts.created_at || new Date().toISOString(),
        source: 'v6'
    };
    data.events.push(ev);
    storeSave();
    return ev;
}

function storeUpdateEvent(id, changes) {
    const data = storeGetData();
    const idx = data.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    Object.assign(data.events[idx], changes);
    if (changes.start || changes.end) {
        data.events[idx].date_text = _buildDateText(data.events[idx].start, data.events[idx].end);
    }
    storeSave();
    return data.events[idx];
}

function storeDeleteEvent(id) {
    const data = storeGetData();
    const idx = data.events.findIndex(e => e.id === id);
    if (idx === -1) return false;
    data.events.splice(idx, 1);
    storeSave();
    return true;
}

function storeFindEvent(id) {
    return storeGetEvents().find(e => e.id === id) || null;
}

// --- Import Flow JSON ---
function storeImportFlowJson(flowArray) {
    if (!Array.isArray(flowArray)) return { imported: 0 };
    const data = storeGetData();
    const projMap = {};
    // Build existing project name->id map
    data.projects.forEach(p => { projMap[p.name] = p.id; });

    let imported = 0;
    flowArray.forEach(fev => {
        // Create project if needed
        let projectId = null;
        if (fev.project) {
            if (!projMap[fev.project]) {
                const newProj = storeCreateProject({ name: fev.project, color: _autoColor(data.projects.length) });
                projMap[fev.project] = newProj.id;
            }
            projectId = projMap[fev.project];
        }
        // Create event
        const ev = {
            id: generateId('ev_'),
            title: fev.title || '',
            description: fev.description || '',
            projectId: projectId,
            start: fev.start || '',
            end: fev.end || '',
            location: fev.location || '',
            author: fev.author || '',
            author_position: fev.author_position || '',
            attendees: fev.attendees || [],
            comments: fev.comments || [],
            file_names: fev.file_names || [],
            date_text: fev.date_text || _buildDateText(fev.start, fev.end),
            created_at: fev.created_at || new Date().toISOString(),
            source: 'flow',
            flowId: fev.id
        };
        data.events.push(ev);
        imported++;
    });
    // Save import metadata for persistence across refresh
    data.meta.lastImport = {
        filename: null, // will be set by caller (fcHandleFile)
        date: new Date().toISOString(),
        count: imported
    };
    storeSave();
    return { imported };
}

function storeSetImportMeta(filename) {
    const data = storeGetData();
    if (data.meta.lastImport) {
        data.meta.lastImport.filename = filename;
        storeSave();
    }
}

function storeGetImportMeta() {
    const data = storeGetData();
    return data.meta.lastImport || null;
}

// --- Export ---
function storeExportAll() {
    return JSON.stringify(storeGetData(), null, 2);
}

// --- Usage ---
function storeGetUsage() {
    const raw = localStorage.getItem(STORE_KEY) || '';
    const bytes = new Blob([raw]).size;
    const maxBytes = 5 * 1024 * 1024; // ~5MB
    return { bytes, maxBytes, percent: Math.round((bytes / maxBytes) * 100) };
}

// --- Helpers ---
function _buildDateText(start, end) {
    if (!start) return '';
    const s = start.substring(0, 10);
    const e = end ? end.substring(0, 10) : '';
    return e && e !== s ? `${s} ~ ${e}` : s;
}

const _AUTO_COLORS = ['#00f7ff', '#00ff33', '#ffcc00', '#ff3300', '#a064ff', '#ff64c8', '#ff9933', '#33ccff'];
function _autoColor(index) {
    return _AUTO_COLORS[index % _AUTO_COLORS.length];
}
