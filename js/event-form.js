// --- HOBIS V6 EVENT FORM MODULE ---
// Modal form for creating and editing events

let _efEditId = null;
let _efAttendees = []; // { name, email, status }

function efShowCreate(prefillDate) {
    _efEditId = null;
    _efRenderModal(null, prefillDate);
}

function efShowEdit(eventId) {
    const ev = storeFindEvent(eventId);
    if (!ev) return;
    _efEditId = eventId;
    _efRenderModal(ev);
}

function _efRenderModal(ev, prefillDate) {
    efClose();
    const isEdit = !!ev;

    // Parse start/end for date and time inputs
    let startDate = '', startTime = '', endDate = '', endTime = '';
    if (ev) {
        if (ev.start) { startDate = ev.start.substring(0, 10); startTime = ev.start.length > 10 ? ev.start.substring(11, 16) : ''; }
        if (ev.end) { endDate = ev.end.substring(0, 10); endTime = ev.end.length > 10 ? ev.end.substring(11, 16) : ''; }
    } else if (prefillDate) {
        startDate = prefillDate;
        endDate = prefillDate;
    }

    const overlay = document.createElement('div');
    overlay.className = 'fc-detail-overlay';
    overlay.id = 'efOverlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) efClose(); });

    overlay.innerHTML = `
        <div class="fc-detail-modal" style="max-width:600px;">
            <div class="fc-modal-header">
                <span class="fc-modal-title">${isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</span>
                <button class="fc-modal-close" onclick="efClose()">&times; CLOSE</button>
            </div>
            <div class="fc-modal-body">
                <div class="ef-field">
                    <label>제목 *</label>
                    <input type="text" id="efTitle" value="${isEdit ? fcEsc(ev.title) : ''}" placeholder="일정 제목...">
                </div>
                <div class="ef-field">
                    <label>프로젝트</label>
                    <select id="efProject"></select>
                </div>
                <div class="ef-row">
                    <div class="ef-field">
                        <label>시작일</label>
                        <input type="date" id="efStartDate" value="${startDate}">
                    </div>
                    <div class="ef-field">
                        <label>시작시간</label>
                        <input type="time" id="efStartTime" value="${startTime}">
                    </div>
                </div>
                <div class="ef-row">
                    <div class="ef-field">
                        <label>종료일</label>
                        <input type="date" id="efEndDate" value="${endDate}">
                    </div>
                    <div class="ef-field">
                        <label>종료시간</label>
                        <input type="time" id="efEndTime" value="${endTime}">
                    </div>
                </div>
                <div class="ef-field">
                    <label>장소</label>
                    <input type="text" id="efLocation" value="${isEdit ? fcEsc(ev.location || '') : ''}" placeholder="장소...">
                </div>
                <div class="ef-field">
                    <label>작성자</label>
                    <input type="text" id="efAuthor" value="${isEdit ? fcEsc(ev.author || '') : ''}" placeholder="작성자...">
                </div>
                <div class="ef-field">
                    <label>설명</label>
                    <textarea id="efDesc" rows="4" placeholder="일정 설명...">${isEdit ? fcEsc(ev.description || '') : ''}</textarea>
                </div>
                <div class="ef-field">
                    <label>참석자</label>
                    <div class="ef-att-container" id="efAttContainer"></div>
                    <div class="ef-att-input-row">
                        <input type="text" id="efAttInput" placeholder="이름 입력 후 Enter..." onkeydown="efAttKeydown(event)">
                        <button type="button" class="btn-outline ef-att-add-btn" onclick="efAddAttendee()">+</button>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:16px;">
                    <button class="btn" style="flex:1;" onclick="efDoSave()">
                        ${isEdit ? 'UPDATE' : 'CREATE'}
                    </button>
                    ${isEdit ? `<button class="btn" style="flex:0.4; background:rgba(255,51,0,0.1); border-color:var(--hobis-alert); color:var(--hobis-alert);" onclick="efDoDelete()">DELETE</button>` : ''}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Populate project dropdown
    projRenderDropdown(document.getElementById('efProject'), ev ? ev.projectId : '');

    // Init attendees chip UI
    _efAttendees = isEdit ? (ev.attendees || []).map(a => ({
        name: a.name || '',
        email: a.email || '',
        status: a.status || '미정'
    })) : [];
    efRenderAttChips();

    document.getElementById('efTitle').focus();
}

function efDoSave() {
    const title = document.getElementById('efTitle').value.trim();
    if (!title) { alert('제목을 입력하세요.'); return; }

    const startDate = document.getElementById('efStartDate').value;
    const startTime = document.getElementById('efStartTime').value;
    const endDate = document.getElementById('efEndDate').value;
    const endTime = document.getElementById('efEndTime').value;

    const start = startDate ? (startTime ? `${startDate}T${startTime}` : startDate) : '';
    const end = endDate ? (endTime ? `${endDate}T${endTime}` : endDate) : '';

    // Use chip-based attendees
    const attendees = _efAttendees.slice();

    const data = {
        title,
        projectId: document.getElementById('efProject').value || null,
        start,
        end,
        location: document.getElementById('efLocation').value.trim(),
        author: document.getElementById('efAuthor').value.trim(),
        description: document.getElementById('efDesc').value,
        attendees
    };

    if (_efEditId) {
        storeUpdateEvent(_efEditId, data);
    } else {
        storeCreateEvent(data);
    }

    efClose();
    if (typeof evRefresh === 'function') evRefresh();
}

function efDoDelete() {
    if (!_efEditId) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    storeDeleteEvent(_efEditId);
    efClose();
    fcCloseDetail();
    if (typeof evRefresh === 'function') evRefresh();
}

// --- Attendee chip UI ---
function efRenderAttChips() {
    const container = document.getElementById('efAttContainer');
    if (!container) return;
    if (_efAttendees.length === 0) {
        container.innerHTML = '<span class="ef-att-empty">참석자가 없습니다</span>';
        return;
    }
    container.innerHTML = _efAttendees.map((a, i) => {
        const statusColors = { '참석': 'var(--hobis-green)', '불참': 'var(--hobis-alert)', '미정': 'var(--hobis-warn)' };
        const color = statusColors[a.status] || 'var(--hobis-warn)';
        return '<div class="ef-att-chip" style="border-color:' + color + ';">' +
            '<span class="ef-att-name">' + fcEsc(a.name) + '</span>' +
            (a.email ? '<span class="ef-att-email">' + fcEsc(a.email) + '</span>' : '') +
            '<select class="ef-att-status" onchange="efAttStatus(' + i + ',this.value)" style="color:' + color + ';">' +
                '<option value="미정"' + (a.status === '미정' ? ' selected' : '') + '>미정</option>' +
                '<option value="참석"' + (a.status === '참석' ? ' selected' : '') + '>참석</option>' +
                '<option value="불참"' + (a.status === '불참' ? ' selected' : '') + '>불참</option>' +
            '</select>' +
            '<button class="ef-att-del" onclick="efRemoveAtt(' + i + ')">&times;</button>' +
        '</div>';
    }).join('');
}

function efAttKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        efAddAttendee();
    }
}

function efAddAttendee() {
    const input = document.getElementById('efAttInput');
    if (!input) return;
    const raw = input.value.replace(/,/g, '').trim();
    if (!raw) return;
    // Parse "이름 <email>" format
    const emailMatch = raw.match(/^(.+?)\s*<([^>]+)>$/);
    let name = raw, email = '';
    if (emailMatch) { name = emailMatch[1].trim(); email = emailMatch[2].trim(); }
    _efAttendees.push({ name, email, status: '미정' });
    input.value = '';
    efRenderAttChips();
    input.focus();
}

function efRemoveAtt(index) {
    _efAttendees.splice(index, 1);
    efRenderAttChips();
}

function efAttStatus(index, value) {
    if (_efAttendees[index]) _efAttendees[index].status = value;
    efRenderAttChips();
}

function efClose() {
    const overlay = document.getElementById('efOverlay');
    if (overlay) overlay.remove();
    _efEditId = null;
}

// ESC to close
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('efOverlay')) {
        efClose();
    }
});
