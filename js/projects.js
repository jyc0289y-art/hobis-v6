// --- HOBIS V6 PROJECT MODULE ---
// Project CRUD UI: list, color picker, create/edit/delete

const V6_PROJECT_COLORS = [
    { name: 'Cyan',    hex: '#00f7ff', bg: 'rgba(0,247,255,0.15)' },
    { name: 'Green',   hex: '#00ff33', bg: 'rgba(0,255,51,0.15)' },
    { name: 'Yellow',  hex: '#ffcc00', bg: 'rgba(255,204,0,0.15)' },
    { name: 'Red',     hex: '#ff3300', bg: 'rgba(255,51,0,0.15)' },
    { name: 'Purple',  hex: '#a064ff', bg: 'rgba(160,100,255,0.15)' },
    { name: 'Pink',    hex: '#ff64c8', bg: 'rgba(255,100,200,0.15)' },
    { name: 'Orange',  hex: '#ff9933', bg: 'rgba(255,153,51,0.15)' },
    { name: 'Sky',     hex: '#33ccff', bg: 'rgba(51,204,255,0.15)' },
];

function projGetColor(projectId) {
    const p = storeFindProject(projectId);
    return p ? p.color : '#5f7481';
}

function projGetName(projectId) {
    const p = storeFindProject(projectId);
    return p ? p.name : '';
}

function projGetColorObj(hex) {
    return V6_PROJECT_COLORS.find(c => c.hex === hex) || { hex, bg: _hexToBg(hex) };
}

function _hexToBg(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},0.15)`;
}

function projRenderDropdown(selectEl, selectedId) {
    const projects = storeGetProjects();
    let html = '<option value="">-- 프로젝트 선택 --</option>';
    projects.forEach(p => {
        html += `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${fcEsc(p.name)}</option>`;
    });
    selectEl.innerHTML = html;
}

function projShowModal(editId) {
    projCloseModal();
    const proj = editId ? storeFindProject(editId) : null;
    const isEdit = !!proj;

    const overlay = document.createElement('div');
    overlay.className = 'fc-detail-overlay';
    overlay.id = 'projOverlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) projCloseModal(); });

    const selectedColor = proj ? proj.color : V6_PROJECT_COLORS[0].hex;

    overlay.innerHTML = `
        <div class="fc-detail-modal" style="max-width:450px;">
            <div class="fc-modal-header">
                <span class="fc-modal-title">${isEdit ? 'EDIT PROJECT' : 'NEW PROJECT'}</span>
                <button class="fc-modal-close" onclick="projCloseModal()">&times; CLOSE</button>
            </div>
            <div class="fc-modal-body">
                <div class="ef-field">
                    <label>프로젝트명</label>
                    <input type="text" id="projNameInput" value="${isEdit ? fcEsc(proj.name) : ''}" placeholder="프로젝트 이름 입력..." style="width:100%;">
                </div>
                <div class="ef-field" style="margin-top:12px;">
                    <label>색상</label>
                    <div class="proj-color-grid" id="projColorGrid">
                        ${V6_PROJECT_COLORS.map(c => `
                            <div class="proj-color-chip ${c.hex === selectedColor ? 'proj-color-active' : ''}"
                                 style="background:${c.bg}; border-color:${c.hex}; color:${c.hex};"
                                 data-hex="${c.hex}" onclick="projSelectColor(this)">●</div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="projColorInput" value="${selectedColor}">
                </div>
                <div style="display:flex; gap:8px; margin-top:16px;">
                    <button class="btn" style="flex:1;" onclick="projDoSave('${editId || ''}')">${isEdit ? 'UPDATE' : 'CREATE'}</button>
                    ${isEdit ? `<button class="btn" style="flex:0.5; background:rgba(255,51,0,0.1); border-color:var(--hobis-alert); color:var(--hobis-alert);" onclick="projDoDelete('${editId}')">DELETE</button>` : ''}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('projNameInput').focus();
}

function projSelectColor(el) {
    document.querySelectorAll('.proj-color-chip').forEach(c => c.classList.remove('proj-color-active'));
    el.classList.add('proj-color-active');
    document.getElementById('projColorInput').value = el.dataset.hex;
}

function projDoSave(editId) {
    const name = document.getElementById('projNameInput').value.trim();
    if (!name) { alert('프로젝트명을 입력하세요.'); return; }
    const color = document.getElementById('projColorInput').value;

    if (editId) {
        storeUpdateProject(editId, { name, color });
    } else {
        storeCreateProject({ name, color });
    }
    projCloseModal();
    if (typeof evRefresh === 'function') evRefresh();
}

function projDoDelete(id) {
    const eventCount = storeGetEvents().filter(e => e.projectId === id).length;
    const msg = eventCount > 0
        ? `이 프로젝트에 ${eventCount}개의 일정이 있습니다. 삭제하시겠습니까?\n(일정은 유지되며, 프로젝트 연결만 해제됩니다)`
        : '이 프로젝트를 삭제하시겠습니까?';
    if (!confirm(msg)) return;
    storeDeleteProject(id);
    projCloseModal();
    if (typeof evRefresh === 'function') evRefresh();
}

function projCloseModal() {
    const overlay = document.getElementById('projOverlay');
    if (overlay) overlay.remove();
}

// ESC to close
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('projOverlay')) {
        projCloseModal();
    }
});
