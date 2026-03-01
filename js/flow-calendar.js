// --- HOBIS FLOW CALENDAR MODULE ---
// Flow event viewer with search, calendar, and detail panel
// Designed to match HOBIS cyberpunk aesthetic

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

// Project colors for calendar chips (cyberpunk palette)
const FC_PROJ_COLORS = [
    { bg: 'rgba(0,247,255,0.15)', color: '#00f7ff' },
    { bg: 'rgba(0,255,51,0.15)', color: '#00ff33' },
    { bg: 'rgba(255,204,0,0.15)', color: '#ffcc00' },
    { bg: 'rgba(255,51,0,0.15)', color: '#ff3300' },
    { bg: 'rgba(160,100,255,0.15)', color: '#a064ff' },
    { bg: 'rgba(255,100,200,0.15)', color: '#ff64c8' },
];

// --- FILE LOADING ---
function fcHandleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('fcFileStatus').textContent = 'LOADING...';
    document.getElementById('fcFileStatus').style.color = 'var(--hobis-warn)';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            fcData = JSON.parse(e.target.result);
            fcInitApp();
            document.getElementById('fcFileStatus').textContent = `LOADED: ${fcData.length} EVENTS`;
            document.getElementById('fcFileStatus').style.color = 'var(--hobis-green)';
        } catch(err) {
            document.getElementById('fcFileStatus').textContent = 'PARSE ERROR: ' + err.message;
            document.getElementById('fcFileStatus').style.color = 'var(--hobis-alert)';
        }
    };
    reader.readAsText(file);
}

function fcInitApp() {
    // Build project list
    const projSet = new Set();
    fcData.forEach(ev => { if (ev.project) projSet.add(ev.project); });
    fcProjects = [...projSet].sort();
    fcProjects.forEach((p, i) => { fcProjectMap[p] = i % FC_PROJ_COLORS.length; });

    // Stats
    const commentCount = fcData.filter(e => e.comments && e.comments.length).length;
    document.getElementById('fcStats').textContent =
        `${fcData.length} EVENTS | ${fcProjects.length} PROJECTS | ${commentCount} WITH COMMENTS`;
    document.getElementById('fcStats').style.color = 'var(--hobis-green)';

    // Show workspace, hide loader
    document.getElementById('fcLoaderBox').style.display = 'none';
    document.getElementById('fcWorkspace').style.display = 'flex';

    // Init search
    fcAddFilter();
    fcDoSearch();

    // Init calendar
    const now = new Date();
    fcCalYear = now.getFullYear();
    fcCalMonth = now.getMonth();
    fcRenderCalendar();
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
    row.innerHTML = `
        <select class="fc-field-select" onchange="this.nextElementSibling.focus()">
            ${FC_FILTER_FIELDS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
        </select>
        <input type="text" class="fc-search-input" placeholder="Enter query..." onkeydown="if(event.key==='Enter')fcDoSearch()">
        <button class="fc-filter-del" onclick="this.parentElement.remove()">&times;</button>
    `;
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
                if (f.field === 'all') return JSON.stringify(ev).toLowerCase().includes(q);
                if (f.field === 'attendees') return (ev.attendees||[]).some(a => (a.name||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q));
                if (f.field === 'comments') return (ev.comments||[]).some(c => (c.content||'').toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q));
                if (f.field === 'file_names') return (ev.file_names||[]).some(fn => fn.toLowerCase().includes(q));
                return ((ev[f.field] || '') + '').toLowerCase().includes(q);
            });
        });
    }

    // Sort
    const sort = document.getElementById('fcSortSelect').value;
    results = [...results].sort((a, b) => {
        if (sort === 'date-desc') return (b.start || '').localeCompare(a.start || '');
        if (sort === 'date-asc') return (a.start || '').localeCompare(b.start || '');
        if (sort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
        if (sort === 'project-asc') return (a.project || '').localeCompare(b.project || '') || (b.start || '').localeCompare(a.start || '');
        return 0;
    });

    fcLastResults = results;
    fcShowPage = 1;
    document.getElementById('fcResultCount').textContent = `RESULTS: ${results.length}`;
    fcRenderEventList(results.slice(0, FC_PAGE_SIZE));
    if (results.length > FC_PAGE_SIZE) {
        document.getElementById('fcResultCount').textContent += ` (SHOWING ${FC_PAGE_SIZE})`;
        fcAddLoadMore(results, FC_PAGE_SIZE);
    }
}

function fcAddLoadMore(results, pageSize) {
    const container = document.getElementById('fcEventList');
    const remaining = results.length - pageSize * fcShowPage;
    if (remaining > 0) {
        const btn = document.createElement('div');
        btn.className = 'fc-load-more';
        btn.textContent = `LOAD MORE (${remaining} REMAINING)`;
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

function fcMakeEventHtml(ev) {
    const cCount = (ev.comments||[]).length;
    const aCount = (ev.attendees||[]).length;
    const descSnippet = ev.description ? ev.description.substring(0, 80).replace(/\n/g, ' ') : '';
    const pIdx = fcProjectMap[ev.project] !== undefined ? fcProjectMap[ev.project] : 0;
    const pc = FC_PROJ_COLORS[pIdx];
    return `
        <div class="fc-event-item ${fcSelectedId === ev.id ? 'fc-selected' : ''}" data-id="${ev.id}" onclick="fcShowDetail(${ev.id})">
            <div class="fc-ev-title">${fcEsc(ev.title)}</div>
            ${descSnippet ? `<div class="fc-ev-desc">${fcEsc(descSnippet)}${ev.description.length > 80 ? '...' : ''}</div>` : ''}
            <div class="fc-ev-meta">
                <span class="fc-badge" style="background:${pc.bg};color:${pc.color};">${fcEsc(ev.project)}</span>
                <span class="fc-badge fc-badge-author">${fcEsc(ev.author)}</span>
                <span>${fcEsc(ev.date_text)}</span>
                ${cCount ? `<span style="color:var(--hobis-cyan);">MSG:${cCount}</span>` : ''}
                ${aCount ? `<span style="color:var(--hobis-green);">ATT:${aCount}</span>` : ''}
                ${(ev.file_names||[]).length ? `<span style="color:var(--hobis-warn);">FILE:${ev.file_names.length}</span>` : ''}
            </div>
        </div>
    `;
}

function fcRenderEventList(events) {
    document.getElementById('fcEventList').innerHTML = events.map(ev => fcMakeEventHtml(ev)).join('');
}

// --- DETAIL ---
function fcShowDetail(id) {
    fcSelectedId = id;
    const ev = fcData[id];
    if (!ev) return;

    document.getElementById('fcDetailTitle').textContent = ev.title;
    let html = `
        <div class="fc-detail-meta">
            <div class="fc-dm-item"><span class="fc-dm-label">PROJECT</span><span class="fc-dm-value" style="color:var(--hobis-cyan);">${fcEsc(ev.project)}</span></div>
            <div class="fc-dm-item"><span class="fc-dm-label">AUTHOR</span><span class="fc-dm-value">${fcEsc(ev.author)} ${ev.author_position ? fcEsc(ev.author_position) : ''}</span></div>
            <div class="fc-dm-item"><span class="fc-dm-label">SCHEDULE</span><span class="fc-dm-value">${fcEsc(ev.date_text)}</span></div>
            <div class="fc-dm-item"><span class="fc-dm-label">CREATED</span><span class="fc-dm-value">${fcEsc(ev.created_at)}</span></div>
            ${ev.location ? `<div class="fc-dm-item fc-dm-wide"><span class="fc-dm-label">LOCATION</span><span class="fc-dm-value">${fcEsc(ev.location)}</span></div>` : ''}
        </div>
    `;

    if (ev.description) {
        const dHtml = fcEsc(ev.description).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--hobis-cyan);">$1</a>');
        html += `<div class="fc-detail-section"><div class="fc-ds-title">CONTENT</div><div class="fc-ds-body">${dHtml}</div></div>`;
    }

    if ((ev.attendees||[]).length) {
        html += `<div class="fc-detail-section"><div class="fc-ds-title">ATTENDEES (${ev.attendees.length})</div><div class="fc-attendees">
            ${ev.attendees.map(a => {
                let chipColor = 'var(--hobis-cyan)';
                let chipBg = 'rgba(0,247,255,0.1)';
                if (a.status === '불참') { chipColor = 'var(--hobis-alert)'; chipBg = 'rgba(255,51,0,0.1)'; }
                else if (a.status === '미정') { chipColor = 'var(--hobis-warn)'; chipBg = 'rgba(255,204,0,0.1)'; }
                return `<span class="fc-att-chip" style="color:${chipColor};background:${chipBg};" title="${fcEsc(a.email)}">${fcEsc(a.name)} (${a.status})</span>`;
            }).join('')}
        </div></div>`;
    }

    if ((ev.file_names||[]).length) {
        html += `<div class="fc-detail-section"><div class="fc-ds-title">FILES</div><div class="fc-ds-body">${ev.file_names.map(f => '<span style="color:var(--hobis-warn);">FILE:</span> ' + fcEsc(f)).join('<br>')}</div></div>`;
    }

    if ((ev.comments||[]).length) {
        html += `<div class="fc-detail-section"><div class="fc-ds-title">MESSAGES (${ev.comments.length})</div>`;
        ev.comments.forEach(c => {
            html += `<div class="fc-comment">
                <span class="fc-comment-author">${fcEsc(c.author||'')}</span>
                ${c.author_position ? `<span class="fc-comment-pos">${fcEsc(c.author_position)}</span>` : ''}
                <span class="fc-comment-date">${fcEsc(c.date||'')}</span>
                <div class="fc-comment-body">${fcEsc(c.content||'')}</div>
            </div>`;
        });
        html += `</div>`;
    }

    document.getElementById('fcDetailBody').innerHTML = html;
    document.getElementById('flowCalDetailPanel').classList.remove('hidden');
    document.getElementById('fcEmptyDetail').classList.add('hidden');

    // Highlight
    document.querySelectorAll('.fc-event-item').forEach(el => {
        el.classList.toggle('fc-selected', el.dataset.id == id);
    });
}

function fcCloseDetail() {
    document.getElementById('flowCalDetailPanel').classList.add('hidden');
    document.getElementById('fcEmptyDetail').classList.remove('hidden');
    fcSelectedId = null;
    document.querySelectorAll('.fc-event-item').forEach(el => el.classList.remove('fc-selected'));
}

// --- CALENDAR ---
function fcRenderCalendar() {
    document.getElementById('fcCalTitle').textContent = `${fcCalYear}.${String(fcCalMonth+1).padStart(2,'0')}`;
    const grid = document.getElementById('fcCalGrid');

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    let html = days.map((d, i) => `<div class="fc-cal-dh${i===0?' fc-sun':''}${i===6?' fc-sat':''}">${d}</div>`).join('');

    const firstDay = new Date(fcCalYear, fcCalMonth, 1);
    const lastDay = new Date(fcCalYear, fcCalMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Build event map
    const eventsByDay = {};
    fcData.forEach(ev => {
        if (!ev.start) return;
        const m = ev.start.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return;
        const startD = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        let endStr = ev.end || ev.start;
        const em = endStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const endD = em ? new Date(parseInt(em[1]), parseInt(em[2])-1, parseInt(em[3])) : new Date(startD);
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate()+1)) {
            if (d.getFullYear() === fcCalYear && d.getMonth() === fcCalMonth) {
                const day = d.getDate();
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(ev);
            }
        }
    });

    // Prev month padding
    const prevLast = new Date(fcCalYear, fcCalMonth, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
        html += `<div class="fc-cal-cell fc-other"><span class="fc-day-num">${prevLast - i}</span></div>`;
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${fcCalYear}-${String(fcCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow = (startPad + d - 1) % 7;
        let cls = 'fc-cal-cell';
        if (dateStr === todayStr) cls += ' fc-today';
        if (dow === 0) cls += ' fc-sun';
        if (dow === 6) cls += ' fc-sat';

        const dayEvs = eventsByDay[d] || [];
        const maxShow = 3;
        let evHtml = '';
        dayEvs.slice(0, maxShow).forEach(ev => {
            const pIdx = fcProjectMap[ev.project] !== undefined ? fcProjectMap[ev.project] : 0;
            const pc = FC_PROJ_COLORS[pIdx];
            evHtml += `<div class="fc-cal-ev" style="background:${pc.bg};color:${pc.color};" onclick="event.stopPropagation();fcShowDetail(${ev.id})" title="${fcEsc(ev.title)}">${fcEsc(ev.title)}</div>`;
        });
        if (dayEvs.length > maxShow) {
            evHtml += `<div class="fc-cal-more" onclick="event.stopPropagation();fcShowDayEvents(${d})">+${dayEvs.length - maxShow} MORE</div>`;
        }

        html += `<div class="${cls}"><span class="fc-day-num">${d}</span>${evHtml}</div>`;
    }

    // Next month padding
    const totalCells = startPad + totalDays;
    const rem = (7 - totalCells % 7) % 7;
    for (let i = 1; i <= rem; i++) {
        html += `<div class="fc-cal-cell fc-other"><span class="fc-day-num">${i}</span></div>`;
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
        const endD = em ? new Date(parseInt(em[1]), parseInt(em[2])-1, parseInt(em[3])) : startD;
        const target = new Date(fcCalYear, fcCalMonth, day);
        return target >= startD && target <= endD;
    });
    fcSetSubTab('search');
    document.getElementById('fcResultCount').textContent = `${fcCalYear}.${String(fcCalMonth+1).padStart(2,'0')}.${String(day).padStart(2,'0')}: ${dayEvents.length} EVENTS`;
    fcRenderEventList(dayEvents);
}

// Utility
function fcEsc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
