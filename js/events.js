// --- HOBIS V6 EVENTS MODULE ---
// Refactored from flow-calendar.js: calendar + search + detail with CRUD support

let fcData = [];
let fcProjects = [];
let fcProjectMap = {};
let fcCurrentTab = 'search';
let fcCalYear, fcCalMonth;
let fcSelectedId = null;
let fcLastResults = [];
let fcShowPage = 1;
const FC_PAGE_SIZE = 100;

const FC_FILTER_FIELDS = [
    { value: 'title', label: 'TITLE' },
    { value: 'description', label: 'BODY' },
    { value: 'project', label: 'PROJECT' },
    { value: 'author', label: 'AUTHOR' },
    { value: 'attendees', label: 'ATTENDEE' },
    { value: 'comments', label: 'COMMENT' },
    { value: 'location', label: 'LOCATION' },
    { value: 'date_text', label: 'DATE' },
    { value: 'file_names', label: 'FILE' },
    { value: 'all', label: 'ALL FIELDS' },
];

// --- INITIALIZATION ---
function evInitApp() {
    fcData = storeGetEvents();
    evBuildProjectMap();

    const now = new Date();
    fcCalYear = now.getFullYear();
    fcCalMonth = now.getMonth();

    // Show workspace
    const workspace = document.getElementById('fcWorkspace');
    if (workspace) workspace.style.display = 'flex';

    // Update stats
    evUpdateStats();

    // Init search
    const filterRows = document.getElementById('fcFilterRows');
    if (filterRows && filterRows.children.length === 0) fcAddFilter();
    fcDoSearch();
    fcRenderCalendar();
}

function evBuildProjectMap() {
    fcProjectMap = {};
    const projects = storeGetProjects();
    projects.forEach((p, i) => {
        fcProjectMap[p.id] = { index: i, color: p.color, name: p.name };
    });
    fcProjects = projects.map(p => p.name);
}

function evRefresh() {
    fcData = storeGetEvents();
    evBuildProjectMap();
    evUpdateStats();
    fcDoSearch();
    fcRenderCalendar();
}

function evUpdateStats() {
    const commentCount = fcData.filter(e => e.comments && e.comments.length).length;
    const statsEl = document.getElementById('fcStats');
    if (statsEl) {
        const projects = storeGetProjects();
        statsEl.textContent = fcData.length + ' EVENTS | ' + projects.length + ' PROJECTS | ' + commentCount + ' WITH COMMENTS';
        statsEl.style.color = 'var(--hobis-green)';
    }
    const usage = storeGetUsage();
    const storageEl = document.getElementById('v6StorageBar');
    if (storageEl) {
        storageEl.style.width = usage.percent + '%';
        storageEl.parentElement.title = 'localStorage: ' + (usage.bytes / 1024).toFixed(1) + 'KB / ' + (usage.maxBytes / 1024 / 1024).toFixed(0) + 'MB (' + usage.percent + '%)';
    }
}

// --- FILE LOADING (Flow JSON Import) ---
function fcHandleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('fcFileStatus').textContent = 'LOADING...';
    document.getElementById('fcFileStatus').style.color = 'var(--hobis-warn)';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (Array.isArray(parsed)) {
                const result = storeImportFlowJson(parsed);
                document.getElementById('fcFileStatus').textContent = 'IMPORTED: ' + result.imported + ' EVENTS';
                document.getElementById('fcFileStatus').style.color = 'var(--hobis-green)';
                evRefresh();
            } else if (parsed.meta && parsed.meta.version) {
                if (confirm('v6 데이터 파일입니다. 현재 데이터를 교체하시겠습니까?\n(' + (parsed.events ? parsed.events.length : 0) + '개 일정, ' + (parsed.projects ? parsed.projects.length : 0) + '개 프로젝트)')) {
                    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
                    storeLoad();
                    evRefresh();
                    document.getElementById('fcFileStatus').textContent = 'LOADED: ' + parsed.events.length + ' EVENTS';
                    document.getElementById('fcFileStatus').style.color = 'var(--hobis-green)';
                }
            } else {
                document.getElementById('fcFileStatus').textContent = 'UNKNOWN FORMAT';
                document.getElementById('fcFileStatus').style.color = 'var(--hobis-alert)';
            }
        } catch(err) {
            document.getElementById('fcFileStatus').textContent = 'PARSE ERROR: ' + err.message;
            document.getElementById('fcFileStatus').style.color = 'var(--hobis-alert)';
        }
    };
    reader.readAsText(file);
}

// --- SUB-TAB SWITCHING ---
function fcSetSubTab(tab) {
    fcCurrentTab = tab;
    document.querySelectorAll('#fcSubTabs .mode-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('fcSearchView').classList.toggle('hidden', tab !== 'search');
    document.getElementById('fcCalendarView').classList.toggle('hidden', tab !== 'calendar');
}

// --- SEARCH ---
function fcAddFilter() {
    const row = document.createElement('div');
    row.className = 'fc-filter-row';
    row.innerHTML =
        '<select class="fc-field-select" onchange="this.nextElementSibling.focus()">' +
            FC_FILTER_FIELDS.map(f => '<option value="' + f.value + '">' + f.label + '</option>').join('') +
        '</select>' +
        '<input type="text" class="fc-search-input" placeholder="Enter query..." onkeydown="if(event.key===\'Enter\')fcDoSearch()">' +
        '<button class="fc-filter-del" onclick="this.parentElement.remove()">&times;</button>';
    document.getElementById('fcFilterRows').appendChild(row);
    row.querySelector('input').focus();
}

function fcResetFilters() {
    document.getElementById('fcFilterRows').innerHTML = '';
    fcAddFilter();
    fcDoSearch();
}

function fcDoSearch() {
    const rows = document.querySelectorAll('#fcFilterRows .fc-filter-row');
    const filters = [];
    rows.forEach(row => {
        const field = row.querySelector('select').value;
        const query = row.querySelector('input').value.trim().toLowerCase();
        if (query) filters.push({ field, query });
    });

    let results = fcData;
    if (filters.length > 0) {
        results = fcData.filter(ev => {
            return filters.every(f => {
                const q = f.query;
                const projName = ev.projectId ? projGetName(ev.projectId) : (ev.project || '');
                if (f.field === 'all') return JSON.stringify(ev).toLowerCase().includes(q);
                if (f.field === 'project') return projName.toLowerCase().includes(q);
                if (f.field === 'attendees') return (ev.attendees||[]).some(a => (a.name||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q));
                if (f.field === 'comments') return (ev.comments||[]).some(c => (c.content||'').toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q));
                if (f.field === 'file_names') return (ev.file_names||[]).some(fn => fn.toLowerCase().includes(q));
                return ((ev[f.field] || '') + '').toLowerCase().includes(q);
            });
        });
    }

    const sortEl = document.getElementById('fcSortSelect');
    const sort = sortEl ? sortEl.value : 'date-desc';
    results = [...results].sort((a, b) => {
        if (sort === 'date-desc') return (b.start || '').localeCompare(a.start || '');
        if (sort === 'date-asc') return (a.start || '').localeCompare(b.start || '');
        if (sort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
        if (sort === 'project-asc') {
            const pa = a.projectId ? projGetName(a.projectId) : (a.project || '');
            const pb = b.projectId ? projGetName(b.projectId) : (b.project || '');
            return pa.localeCompare(pb) || (b.start || '').localeCompare(a.start || '');
        }
        return 0;
    });

    fcLastResults = results;
    fcShowPage = 1;
    document.getElementById('fcResultCount').textContent = 'RESULTS: ' + results.length;
    fcRenderEventList(results.slice(0, FC_PAGE_SIZE));
    if (results.length > FC_PAGE_SIZE) {
        document.getElementById('fcResultCount').textContent += ' (SHOWING ' + FC_PAGE_SIZE + ')';
        fcAddLoadMore(results, FC_PAGE_SIZE);
    }
}

function fcAddLoadMore(results, pageSize) {
    const container = document.getElementById('fcEventList');
    const remaining = results.length - pageSize * fcShowPage;
    if (remaining > 0) {
        const btn = document.createElement('div');
        btn.className = 'fc-load-more';
        btn.textContent = 'LOAD MORE (' + remaining + ' REMAINING)';
        btn.onclick = () => {
            fcShowPage++;
            const start = (fcShowPage - 1) * pageSize;
            const chunk = results.slice(start, start + pageSize);
            btn.remove();
            const frag = document.createDocumentFragment();
            chunk.forEach(ev => {
                const div = document.createElement('div');
                div.innerHTML = fcMakeEventHtml(ev);
                frag.appendChild(div.firstElementChild);
            });
            container.appendChild(frag);
            if (results.length > fcShowPage * pageSize) fcAddLoadMore(results, pageSize);
        };
        container.appendChild(btn);
    }
}

function _evGetProjectDisplay(ev) {
    if (ev.projectId) {
        const name = projGetName(ev.projectId);
        const color = projGetColor(ev.projectId);
        const bg = _hexToBg(color);
        return { name: name || '(deleted)', color, bg };
    }
    if (ev.project) {
        return { name: ev.project, color: '#5f7481', bg: 'rgba(95,116,129,0.15)' };
    }
    return { name: '', color: '#5f7481', bg: 'rgba(95,116,129,0.15)' };
}

function _hexToBg(hex) {
    if (!hex || hex.charAt(0) !== '#') return 'rgba(95,116,129,0.15)';
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',0.15)';
}

function fcMakeEventHtml(ev) {
    const cCount = (ev.comments||[]).length;
    const aCount = (ev.attendees||[]).length;
    const descSnippet = ev.description ? ev.description.substring(0, 80).replace(/\n/g, ' ') : '';
    const pd = _evGetProjectDisplay(ev);
    const dateText = ev.date_text || _buildDateText(ev.start, ev.end);
    return '<div class="fc-event-item ' + (fcSelectedId === ev.id ? 'fc-selected' : '') + '" data-id="' + ev.id + '" onclick="fcShowDetail(\'' + ev.id + '\')">' +
        '<div class="fc-ev-title">' + fcEsc(ev.title) + '</div>' +
        (descSnippet ? '<div class="fc-ev-desc">' + fcEsc(descSnippet) + (ev.description.length > 80 ? '...' : '') + '</div>' : '') +
        '<div class="fc-ev-meta">' +
            (pd.name ? '<span class="fc-badge" style="background:' + pd.bg + ';color:' + pd.color + ';">' + fcEsc(pd.name) + '</span>' : '') +
            (ev.author ? '<span class="fc-badge fc-badge-author">' + fcEsc(ev.author) + '</span>' : '') +
            '<span>' + fcEsc(dateText) + '</span>' +
            (cCount ? '<span style="color:var(--hobis-cyan);">MSG:' + cCount + '</span>' : '') +
            (aCount ? '<span style="color:var(--hobis-green);">ATT:' + aCount + '</span>' : '') +
            ((ev.file_names||[]).length ? '<span style="color:var(--hobis-warn);">FILE:' + ev.file_names.length + '</span>' : '') +
        '</div>' +
    '</div>';
}

function fcRenderEventList(events) {
    const list = document.getElementById('fcEventList');
    if (!list) return;
    if (events.length === 0) {
        list.innerHTML = '<div class="v6-empty-state">일정이 없습니다. <span onclick="efShowCreate()" style="color:var(--hobis-cyan);cursor:pointer;text-decoration:underline;">새 일정 만들기</span></div>';
    } else {
        list.innerHTML = events.map(ev => fcMakeEventHtml(ev)).join('');
    }
}

// --- DETAIL ---
function fcIsDesktop() {
    return window.innerWidth >= 1024;
}

function fcBuildDetailHtml(ev) {
    const pd = _evGetProjectDisplay(ev);
    const dateText = ev.date_text || _buildDateText(ev.start, ev.end);
    let html = '<div class="fc-detail-meta">' +
        '<div class="fc-dm-item"><span class="fc-dm-label">PROJECT</span><span class="fc-dm-value" style="color:' + pd.color + ';">' + (fcEsc(pd.name) || '-') + '</span></div>' +
        '<div class="fc-dm-item"><span class="fc-dm-label">AUTHOR</span><span class="fc-dm-value">' + fcEsc(ev.author) + ' ' + (ev.author_position ? fcEsc(ev.author_position) : '') + '</span></div>' +
        '<div class="fc-dm-item"><span class="fc-dm-label">SCHEDULE</span><span class="fc-dm-value">' + fcEsc(dateText) + '</span></div>' +
        '<div class="fc-dm-item"><span class="fc-dm-label">CREATED</span><span class="fc-dm-value">' + fcEsc(ev.created_at) + '</span></div>' +
        (ev.location ? '<div class="fc-dm-item fc-dm-wide"><span class="fc-dm-label">LOCATION</span><span class="fc-dm-value">' + fcEsc(ev.location) + '</span></div>' : '') +
    '</div>';

    if (ev.description) {
        const dHtml = fcEsc(ev.description).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--hobis-cyan);">$1</a>');
        html += '<div class="fc-detail-section"><div class="fc-ds-title">CONTENT</div><div class="fc-ds-body">' + dHtml + '</div></div>';
    }

    if ((ev.attendees||[]).length) {
        html += '<div class="fc-detail-section"><div class="fc-ds-title">ATTENDEES (' + ev.attendees.length + ')</div><div class="fc-attendees">';
        ev.attendees.forEach(a => {
            let chipColor = 'var(--hobis-cyan)';
            let chipBg = 'rgba(0,247,255,0.1)';
            if (a.status === '불참') { chipColor = 'var(--hobis-alert)'; chipBg = 'rgba(255,51,0,0.1)'; }
            else if (a.status === '미정') { chipColor = 'var(--hobis-warn)'; chipBg = 'rgba(255,204,0,0.1)'; }
            html += '<span class="fc-att-chip" style="color:' + chipColor + ';background:' + chipBg + ';" title="' + fcEsc(a.email || '') + '">' + fcEsc(a.name || '') + (a.status ? ' (' + a.status + ')' : '') + '</span>';
        });
        html += '</div></div>';
    }

    if ((ev.file_names||[]).length) {
        html += '<div class="fc-detail-section"><div class="fc-ds-title">FILES</div><div class="fc-ds-body">' + ev.file_names.map(f => '<span style="color:var(--hobis-warn);">FILE:</span> ' + fcEsc(f)).join('<br>') + '</div></div>';
    }

    if ((ev.comments||[]).length) {
        html += '<div class="fc-detail-section"><div class="fc-ds-title">MESSAGES (' + ev.comments.length + ')</div>';
        ev.comments.forEach(c => {
            html += '<div class="fc-comment">' +
                '<span class="fc-comment-author">' + fcEsc(c.author||'') + '</span>' +
                (c.author_position ? '<span class="fc-comment-pos">' + fcEsc(c.author_position) + '</span>' : '') +
                '<span class="fc-comment-date">' + fcEsc(c.date||'') + '</span>' +
                '<div class="fc-comment-body">' + fcEsc(c.content||'') + '</div>' +
            '</div>';
        });
        html += '</div>';
    }
    return html;
}

function fcShowDetail(id) {
    fcSelectedId = id;
    const ev = storeFindEvent(id) || fcData.find(e => e.id === id);
    if (!ev) return;

    const bodyHtml = fcBuildDetailHtml(ev);
    const actionBtns = '<div style="display:flex; gap:8px; margin-top:16px; border-top:1px dashed var(--hobis-border); padding-top:12px;">' +
        '<button class="btn-outline" style="color:var(--hobis-cyan); border-color:var(--hobis-cyan);" onclick="efShowEdit(\'' + ev.id + '\')">EDIT</button>' +
        '<button class="btn-outline" style="color:var(--hobis-alert); border-color:var(--hobis-alert);" onclick="if(confirm(\'이 일정을 삭제하시겠습니까?\')){storeDeleteEvent(\'' + ev.id + '\');fcCloseDetail();evRefresh();}">DELETE</button>' +
    '</div>';

    if (fcIsDesktop()) {
        fcCloseDetail();
        const overlay = document.createElement('div');
        overlay.className = 'fc-detail-overlay';
        overlay.id = 'fcOverlay';
        overlay.innerHTML = '<div class="fc-detail-modal">' +
            '<div class="fc-modal-header">' +
                '<span class="fc-modal-title">EVENT DETAIL</span>' +
                '<button class="fc-modal-close" onclick="fcCloseDetail()">&times; CLOSE</button>' +
            '</div>' +
            '<div class="fc-modal-body">' +
                '<div style="font-weight:bold; font-size:1.0rem; color:var(--hobis-cyan); margin-bottom:12px;">' + fcEsc(ev.title) + '</div>' +
                bodyHtml +
                actionBtns +
            '</div>' +
        '</div>';
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) fcCloseDetail();
        });
        document.body.appendChild(overlay);
    } else {
        fcCloseDetail();
        const inline = document.createElement('div');
        inline.className = 'fc-inline-detail';
        inline.id = 'fcInlineDetail';
        inline.innerHTML = '<div class="fc-modal-header">' +
            '<span class="fc-modal-title">EVENT DETAIL</span>' +
            '<button class="fc-modal-close" onclick="fcCloseDetail()">&times; CLOSE</button>' +
        '</div>' +
        '<div class="fc-modal-body">' +
            '<div style="font-weight:bold; font-size:1.0rem; color:var(--hobis-cyan); margin-bottom:12px;">' + fcEsc(ev.title) + '</div>' +
            bodyHtml +
            actionBtns +
        '</div>';
        const activeView = fcCurrentTab === 'calendar'
            ? document.getElementById('fcCalendarView')
            : document.getElementById('fcSearchView');
        if (activeView && activeView.parentNode) {
            activeView.parentNode.insertBefore(inline, activeView.nextSibling);
            setTimeout(() => inline.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }

    document.querySelectorAll('.fc-event-item').forEach(el => {
        el.classList.toggle('fc-selected', el.dataset.id == id);
    });
}

function fcCloseDetail() {
    const overlay = document.getElementById('fcOverlay');
    if (overlay) overlay.remove();
    const inline = document.getElementById('fcInlineDetail');
    if (inline) inline.remove();
    const legacyPanel = document.getElementById('flowCalDetailPanel');
    if (legacyPanel) legacyPanel.classList.add('hidden');
    const emptyPanel = document.getElementById('fcEmptyDetail');
    if (emptyPanel) emptyPanel.classList.add('hidden');
    fcSelectedId = null;
    document.querySelectorAll('.fc-event-item').forEach(el => el.classList.remove('fc-selected'));
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && fcSelectedId !== null && !document.getElementById('efOverlay') && !document.getElementById('projOverlay')) {
        fcCloseDetail();
    }
});

// --- CALENDAR ---
function fcRenderCalendar() {
    const calTitle = document.getElementById('fcCalTitle');
    if (!calTitle) return;
    calTitle.textContent = fcCalYear + '.' + String(fcCalMonth+1).padStart(2,'0');
    const grid = document.getElementById('fcCalGrid');

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    let html = days.map((d, i) => '<div class="fc-cal-dh' + (i===0?' fc-sun':'') + (i===6?' fc-sat':'') + '">' + d + '</div>').join('');

    const firstDay = new Date(fcCalYear, fcCalMonth, 1);
    const lastDay = new Date(fcCalYear, fcCalMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    const eventsByDay = {};
    fcData.forEach(ev => {
        if (!ev.start) return;
        const m = ev.start.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return;
        const startD = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        let endStr = ev.end || ev.start;
        const em = endStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const endD = em ? new Date(parseInt(em[1]), parseInt(em[2])-1, parseInt(em[3])) : new Date(startD);
        if (endD <= startD) endD.setDate(endD.getDate() + 1);
        for (let d = new Date(startD); d < endD; d.setDate(d.getDate()+1)) {
            if (d.getFullYear() === fcCalYear && d.getMonth() === fcCalMonth) {
                const day = d.getDate();
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(ev);
            }
        }
    });

    const prevLast = new Date(fcCalYear, fcCalMonth, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
        html += '<div class="fc-cal-cell fc-other"><span class="fc-day-num">' + (prevLast - i) + '</span></div>';
    }

    for (let d = 1; d <= totalDays; d++) {
        const dateStr = fcCalYear + '-' + String(fcCalMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        const dow = (startPad + d - 1) % 7;
        let cls = 'fc-cal-cell';
        if (dateStr === todayStr) cls += ' fc-today';
        if (dow === 0) cls += ' fc-sun';
        if (dow === 6) cls += ' fc-sat';

        const dayEvs = eventsByDay[d] || [];
        const maxShow = 3;
        let evHtml = '';
        dayEvs.slice(0, maxShow).forEach(ev => {
            const pd = _evGetProjectDisplay(ev);
            evHtml += '<div class="fc-cal-ev" style="background:' + pd.bg + ';color:' + pd.color + ';" onclick="event.stopPropagation();fcShowDetail(\'' + ev.id + '\')" title="' + fcEsc(ev.title) + '">' + fcEsc(ev.title) + '</div>';
        });
        if (dayEvs.length > maxShow) {
            evHtml += '<div class="fc-cal-more" onclick="event.stopPropagation();fcShowDayEvents(' + d + ')">+' + (dayEvs.length - maxShow) + ' MORE</div>';
        }

        html += '<div class="' + cls + '" onclick="efShowCreate(\'' + dateStr + '\')"><span class="fc-day-num">' + d + '</span>' + evHtml + '</div>';
    }

    const totalCells = startPad + totalDays;
    const rem = (7 - totalCells % 7) % 7;
    for (let i = 1; i <= rem; i++) {
        html += '<div class="fc-cal-cell fc-other"><span class="fc-day-num">' + i + '</span></div>';
    }

    grid.innerHTML = html;
}

function fcCalNav(dir) {
    fcCalMonth += dir;
    if (fcCalMonth < 0) { fcCalMonth = 11; fcCalYear--; }
    if (fcCalMonth > 11) { fcCalMonth = 0; fcCalYear++; }
    fcRenderCalendar();
}

function fcCalToday() {
    const now = new Date();
    fcCalYear = now.getFullYear();
    fcCalMonth = now.getMonth();
    fcRenderCalendar();
}

function fcShowDayEvents(day) {
    const dayEvents = fcData.filter(ev => {
        if (!ev.start) return false;
        const m = ev.start.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return false;
        const startD = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        let endStr = ev.end || ev.start;
        const em = endStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const endD = em ? new Date(parseInt(em[1]), parseInt(em[2])-1, parseInt(em[3])) : new Date(startD);
        if (endD <= startD) endD.setDate(endD.getDate() + 1);
        const target = new Date(fcCalYear, fcCalMonth, day);
        return target >= startD && target < endD;
    });
    fcSetSubTab('search');
    document.getElementById('fcResultCount').textContent = fcCalYear + '.' + String(fcCalMonth+1).padStart(2,'0') + '.' + String(day).padStart(2,'0') + ': ' + dayEvents.length + ' EVENTS';
    fcRenderEventList(dayEvents);
}

// Utility
function fcEsc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
