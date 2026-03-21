// --- HOBIS V6 STORE MODULE ---
// IndexedDB-based persistence layer for projects and events
// Falls back to localStorage if IndexedDB is unavailable

const STORE_KEY = 'hobis_v6';
const STORE_VERSION = '1.0.0';
const IDB_NAME = 'hobis_v6_db';
const IDB_VERSION = 1;
const IDB_STORE = 'data';

let _storeData = null;
let _idb = null;

function generateId(prefix) {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return (prefix || '') + hex;
}

function _storeDefault() {
    return { projects: [], events: [], meta: { version: STORE_VERSION, lastModified: new Date().toISOString() } };
}

// --- IndexedDB ---
function _openIDB() {
    return new Promise(function(resolve, reject) {
        if (_idb) { resolve(_idb); return; }
        var req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = function(e) {
            _idb = e.target.result;
            resolve(_idb);
        };
        req.onerror = function(e) {
            console.warn('IndexedDB open error:', e.target.error);
            reject(e.target.error);
        };
    });
}

function _idbGet(db) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req = store.get(STORE_KEY);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function() { reject(req.error); };
    });
}

function _idbPut(db, data) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        var store = tx.objectStore(IDB_STORE);
        var req = store.put(data, STORE_KEY);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
    });
}

// --- Load (async, returns Promise) ---
function storeLoad() {
    return _openIDB().then(function(db) {
        return _idbGet(db).then(function(data) {
            if (data) {
                _storeData = data;
                _validateStoreData();
                console.log('Store loaded from IndexedDB (' + _storeData.events.length + ' events)');
                return _storeData;
            }
            // No data in IDB — try migrating from localStorage
            return _migrateFromLocalStorage();
        });
    }).catch(function(err) {
        console.warn('IndexedDB unavailable, falling back to localStorage:', err);
        _idb = null;
        return _loadFromLocalStorage();
    });
}

function _migrateFromLocalStorage() {
    try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            _storeData = JSON.parse(raw);
            _validateStoreData();
            console.log('Migrating ' + _storeData.events.length + ' events from localStorage to IndexedDB...');
            // Save to IDB, then clear localStorage
            return _idbPut(_idb, _storeData).then(function() {
                localStorage.removeItem(STORE_KEY);
                console.log('Migration complete. localStorage cleared.');
                return _storeData;
            });
        }
    } catch (e) {
        console.error('localStorage migration error:', e);
    }
    _storeData = _storeDefault();
    return Promise.resolve(_storeData);
}

function _loadFromLocalStorage() {
    try {
        var raw = localStorage.getItem(STORE_KEY);
        _storeData = raw ? JSON.parse(raw) : _storeDefault();
    } catch (e) {
        console.error('Store load error:', e);
        _storeData = _storeDefault();
    }
    _validateStoreData();
    return _storeData;
}

function _validateStoreData() {
    if (!_storeData.meta) _storeData.meta = { version: STORE_VERSION, lastModified: new Date().toISOString() };
    if (!_storeData.projects) _storeData.projects = [];
    if (!_storeData.events) _storeData.events = [];
}

// --- Save (fire-and-forget async) ---
function storeSave() {
    if (!_storeData) return;
    _storeData.meta.lastModified = new Date().toISOString();
    if (_idb) {
        _idbPut(_idb, _storeData).catch(function(err) {
            console.error('IndexedDB save error:', err);
        });
    } else {
        // Fallback: localStorage
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(_storeData));
        } catch (e) {
            console.error('Store save error:', e);
            alert('localStorage 저장 실패. 용량이 부족할 수 있습니다.');
        }
    }
}

// --- Generic key-value helpers (for logs, state, etc.) ---
function storeSetKey(key, value) {
    if (_idb) {
        const tx = _idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
    } else {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error('storeSetKey error:', e); }
    }
}

function storeGetKey(key) {
    return _openIDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = function() { resolve(req.result || null); };
            req.onerror = function() { reject(req.error); };
        });
    }).catch(function() {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    });
}

function storeGetData() { return _storeData || _storeDefault(); }
function storeGetProjects() { return storeGetData().projects; }
function storeGetEvents() { return storeGetData().events; }

// --- Projects ---
function storeCreateProject(opts) {
    var data = storeGetData();
    var proj = {
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
    var data = storeGetData();
    var idx = data.projects.findIndex(function(p) { return p.id === id; });
    if (idx === -1) return null;
    Object.assign(data.projects[idx], changes);
    storeSave();
    return data.projects[idx];
}

function storeDeleteProject(id) {
    var data = storeGetData();
    var idx = data.projects.findIndex(function(p) { return p.id === id; });
    if (idx === -1) return false;
    data.projects.splice(idx, 1);
    data.events.forEach(function(ev) { if (ev.projectId === id) ev.projectId = null; });
    storeSave();
    return true;
}

function storeFindProject(id) {
    return storeGetProjects().find(function(p) { return p.id === id; }) || null;
}

// --- Events ---
function storeCreateEvent(opts) {
    var data = storeGetData();
    var ev = {
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
    var data = storeGetData();
    var idx = data.events.findIndex(function(e) { return e.id === id; });
    if (idx === -1) return null;
    Object.assign(data.events[idx], changes);
    if (changes.start || changes.end) {
        data.events[idx].date_text = _buildDateText(data.events[idx].start, data.events[idx].end);
    }
    storeSave();
    return data.events[idx];
}

function storeDeleteEvent(id) {
    var data = storeGetData();
    var idx = data.events.findIndex(function(e) { return e.id === id; });
    if (idx === -1) return false;
    data.events.splice(idx, 1);
    storeSave();
    return true;
}

function storeFindEvent(id) {
    return storeGetEvents().find(function(e) { return e.id === id; }) || null;
}

// --- Import Flow JSON (with deduplication) ---
function storeImportFlowJson(flowArray) {
    if (!Array.isArray(flowArray)) return { imported: 0, skipped: 0 };
    var data = storeGetData();
    var projMap = {};
    data.projects.forEach(function(p) { projMap[p.name] = p.id; });

    // Build existing flowId set for dedup
    var existingFlowIds = {};
    data.events.forEach(function(ev) {
        if (ev.flowId) existingFlowIds[ev.flowId] = true;
    });

    var imported = 0;
    var skipped = 0;
    // Also build title+start index for events without flowId
    var existingTitleStart = {};
    data.events.forEach(function(ev) {
        if (!ev.flowId && ev.title && ev.start) {
            existingTitleStart[ev.title + '|' + ev.start] = true;
        }
    });

    flowArray.forEach(function(fev) {
        // Skip duplicates by flowId
        if (fev.id && existingFlowIds[fev.id]) {
            skipped++;
            return;
        }
        // For events without flowId, dedup by title+start
        if (!fev.id && fev.title && fev.start) {
            var key = fev.title + '|' + fev.start;
            if (existingTitleStart[key]) { skipped++; return; }
            existingTitleStart[key] = true;
        }

        var projectId = null;
        if (fev.project) {
            if (!projMap[fev.project]) {
                // Create project inline (avoid storeSave per project)
                var newProj = {
                    id: generateId('pj_'),
                    name: fev.project,
                    color: _autoColor(data.projects.length),
                    createdAt: new Date().toISOString()
                };
                data.projects.push(newProj);
                projMap[fev.project] = newProj.id;
            }
            projectId = projMap[fev.project];
        }
        var ev = {
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
        if (fev.id) existingFlowIds[fev.id] = true;
        imported++;
    });
    data.meta.lastImport = {
        filename: null,
        date: new Date().toISOString(),
        count: imported,
        skipped: skipped
    };
    storeSave();
    return { imported: imported, skipped: skipped };
}

function storeSetImportMeta(filename) {
    var data = storeGetData();
    if (data.meta.lastImport) {
        data.meta.lastImport.filename = filename;
        storeSave();
    }
}

function storeGetImportMeta() {
    var data = storeGetData();
    return data.meta.lastImport || null;
}

// --- Comments ---
function storeAddComment(eventId, comment) {
    var ev = storeFindEvent(eventId);
    if (!ev) return null;
    if (!ev.comments) ev.comments = [];
    comment.id = generateId('cm_');
    comment.date = comment.date || new Date().toISOString();
    ev.comments.push(comment);
    storeSave();
    return comment;
}

function storeUpdateComment(eventId, commentId, changes) {
    var ev = storeFindEvent(eventId);
    if (!ev || !ev.comments) return null;
    var c = ev.comments.find(function(c) { return c.id === commentId; });
    if (!c) return null;
    Object.assign(c, changes);
    storeSave();
    return c;
}

function storeDeleteComment(eventId, commentId) {
    var ev = storeFindEvent(eventId);
    if (!ev || !ev.comments) return false;
    var idx = ev.comments.findIndex(function(c) { return c.id === commentId; });
    if (idx === -1) return false;
    ev.comments.splice(idx, 1);
    storeSave();
    return true;
}

// --- Dedup cleanup (for fixing already-duplicated data) ---
function storeDedup() {
    var data = storeGetData();
    var seen = {};
    var kept = [];
    var removed = 0;
    data.events.forEach(function(ev) {
        // For flow-imported events, dedup by flowId
        if (ev.flowId) {
            if (seen[ev.flowId]) { removed++; return; }
            seen[ev.flowId] = true;
        }
        // For v6-created events, keep all (they have unique IDs)
        kept.push(ev);
    });
    data.events = kept;

    // Dedup projects by name
    var projSeen = {};
    var projKept = [];
    var projRemoved = 0;
    data.projects.forEach(function(p) {
        if (projSeen[p.name]) { projRemoved++; return; }
        projSeen[p.name] = true;
        projKept.push(p);
    });
    // Remap events to surviving project IDs
    if (projRemoved > 0) {
        var nameToId = {};
        projKept.forEach(function(p) { nameToId[p.name] = p.id; });
        data.events.forEach(function(ev) {
            if (ev.projectId) {
                var proj = data.projects.find(function(p) { return p.id === ev.projectId; });
                if (proj && nameToId[proj.name] && nameToId[proj.name] !== ev.projectId) {
                    ev.projectId = nameToId[proj.name];
                }
            }
        });
        data.projects = projKept;
    }

    storeSave();
    return { eventsRemoved: removed, projectsRemoved: projRemoved, eventsKept: kept.length, projectsKept: projKept.length };
}

// --- Replace entire data (for v6 format import) ---
function storeReplaceData(newData) {
    _storeData = newData;
    _validateStoreData();
    storeSave();
    return _storeData;
}

// --- Export ---
function storeExportAll() {
    return JSON.stringify(storeGetData(), null, 2);
}

// --- Usage ---
function storeGetUsage() {
    // Estimate from in-memory data (works for both IDB and localStorage)
    var raw = JSON.stringify(_storeData || {});
    var bytes = new Blob([raw]).size;
    var maxBytes = _idb ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for IDB, 5MB for localStorage
    return { bytes: bytes, maxBytes: maxBytes, percent: Math.round((bytes / maxBytes) * 100), backend: _idb ? 'IndexedDB' : 'localStorage' };
}

// --- Helpers ---
function _buildDateText(start, end) {
    if (!start) return '';
    var s = start.substring(0, 10);
    var e = end ? end.substring(0, 10) : '';
    return e && e !== s ? (s + ' ~ ' + e) : s;
}

var _AUTO_COLORS = ['#00f7ff', '#00ff33', '#ffcc00', '#ff3300', '#a064ff', '#ff64c8', '#ff9933', '#33ccff'];
function _autoColor(index) {
    return _AUTO_COLORS[index % _AUTO_COLORS.length];
}
