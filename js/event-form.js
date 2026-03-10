// --- HOBIS V6 EVENT FORM MODULE ---
// Modal form for creating and editing events

let _efEditId = null;

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
                    <label>참석자 (쉼표로 구분)</label>
                    <input type="text" id="efAttendees" value="${isEdit ? (ev.attendees || []).map(a => a.name || a.email || a).join(', ') : ''}" placeholder="홍길동, 김철수...">
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

    // Parse attendees
    const attStr = document.getElementById('efAttendees').value.trim();
    const attendees = attStr ? attStr.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, status: '미정' })) : [];

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
