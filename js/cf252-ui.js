// --- HOBIS Cf-252 UI MODULE ---
// Cf-252 선량평가 계산기 UI 렌더링 및 이벤트 핸들링

let cf252CurrentMode = 'dose'; // 'dose' | 'shield_inv' | 'activation'

function cf252SetMode(mode, el) {
    if (cf252CurrentMode === mode) return;
    cf252CurrentMode = mode;
    el.parentElement.querySelectorAll('.mode-opt').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    // DOM 보존: 모드별 컨테이너를 show/hide
    const doseWrap = document.getElementById('cf252DoseWrap');
    const shieldInvWrap = document.getElementById('cf252ShieldInvWrap');
    const actWrap = document.getElementById('cf252ActWrap');
    const doseResult = document.getElementById('cf252DoseResultWrap');
    const shieldInvResult = document.getElementById('cf252ShieldInvResultWrap');
    const actResult = document.getElementById('cf252ActResultWrap');
    if (doseWrap) doseWrap.classList.toggle('hidden', mode !== 'dose');
    if (shieldInvWrap) shieldInvWrap.classList.toggle('hidden', mode !== 'shield_inv');
    if (actWrap) actWrap.classList.toggle('hidden', mode !== 'activation');
    if (doseResult) doseResult.classList.toggle('hidden', mode !== 'dose');
    if (shieldInvResult) shieldInvResult.classList.toggle('hidden', mode !== 'shield_inv');
    if (actResult) actResult.classList.toggle('hidden', mode !== 'activation');
    _saveAppState();
}

function cf252ClearResult() {
    const reportBox = document.getElementById('cf252ResultBox');
    if (reportBox) reportBox.classList.add('hidden');
    const empty = document.getElementById('cf252ReportEmpty');
    if (empty) empty.classList.remove('hidden');
}

function cf252RenderInputs() {
    const area = document.getElementById('cf252InputArea');
    if (!area) return;

    // 양쪽 모드를 동시에 렌더 — show/hide로 DOM 보존
    area.innerHTML = `
        <div id="cf252DoseWrap" class="${cf252CurrentMode !== 'dose' ? 'hidden' : ''}">
            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>PRESET</span>
                </div>
                <select id="cf252Preset" onchange="cf252LoadPreset()" style="margin-bottom:10px;">
                    <option value="">-- 직접 입력 --</option>
                    ${CF252.PRESETS.filter(p => p.mode === 'storage').map(p =>
                        `<option value="${p.id}">${p.name}</option>`
                    ).join('')}
                </select>
                <div id="cf252PresetRef" class="cf252-preset-ref" style="display:none;"></div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>SOURCES</span>
                    <button class="btn-outline" onclick="cf252AddSource()">+ ADD</button>
                </div>
                <div id="cf252SourceList"></div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>SHIELDING LAYERS</span>
                    <button class="btn-outline" onclick="cf252AddShield()">+ ADD</button>
                </div>
                <div id="cf252ShieldList"></div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>EVALUATION CRITERIA</span>
                </div>
                <select id="cf252Criteria">
                    <option value="MANAGED_INNER">관리구역 내부 (≤ 25 μSv/h)</option>
                    <option value="MANAGED_OUTER">관리구역 외부 (≤ 10 μSv/h)</option>
                    <option value="PUBLIC">일반인 경계 (≤ 1 μSv/h)</option>
                    <option value="CONTAINER_SURFACE">운반물 표면 (≤ 2 mSv/h)</option>
                    <option value="CONTAINER_1M">운반물 1m (≤ 0.1 mSv/h)</option>
                </select>
            </div>
        </div>

        <div id="cf252ShieldInvWrap" class="${cf252CurrentMode !== 'shield_inv' ? 'hidden' : ''}">
            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>SOURCE</span>
                </div>
                <div class="grid-row">
                    <div>
                        <label>방사능량</label>
                        <div class="input-group">
                            <input type="number" id="cf252InvAct" value="2700" step="0.1">
                            <span class="input-suffix">mCi</span>
                        </div>
                    </div>
                    <div>
                        <label>거리</label>
                        <div class="input-group">
                            <input type="number" id="cf252InvDist" value="130" step="1">
                            <span class="input-suffix">cm</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>TARGET</span>
                </div>
                <div class="grid-row">
                    <div>
                        <label>목표 선량률</label>
                        <div class="input-group">
                            <input type="number" id="cf252InvTarget" value="10" step="0.1">
                            <span class="input-suffix">μSv/h</span>
                        </div>
                    </div>
                    <div>
                        <label>차폐재</label>
                        <select id="cf252InvMat">
                            <option value="Concrete">콘크리트</option>
                            <option value="Pb">납 (Pb)</option>
                            <option value="PE">폴리에틸렌 (PE)</option>
                            <option value="Water">물</option>
                            <option value="Paraffin">파라핀</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <label>기준 선택</label>
                    <select id="cf252InvLimit" onchange="cf252InvLimitChanged()">
                        <option value="">-- 직접 입력 --</option>
                        <option value="MANAGED_INNER">관리구역 내부 (≤ 25 μSv/h)</option>
                        <option value="MANAGED_OUTER" selected>관리구역 외부 (≤ 10 μSv/h)</option>
                        <option value="PUBLIC">일반인 경계 (≤ 1 μSv/h)</option>
                        <option value="CONTAINER_SURFACE">운반물 표면 (≤ 2000 μSv/h)</option>
                        <option value="CONTAINER_1M">운반물 1m (≤ 100 μSv/h)</option>
                    </select>
                </div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>EXISTING SHIELDING (optional)</span>
                    <button class="btn-outline" onclick="cf252AddInvShield()">+ ADD</button>
                </div>
                <div id="cf252InvShieldList"></div>
            </div>

            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>ALL MATERIALS (비교)</span>
                </div>
                <label style="font-size:0.75rem; color:#8fa3b0;">
                    <input type="checkbox" id="cf252InvAllMats" checked> 모든 차폐재에 대해 동시 계산
                </label>
            </div>
        </div>

        <div id="cf252ActWrap" class="${cf252CurrentMode !== 'activation' ? 'hidden' : ''}">
            <div class="cf252-section">
                <div class="header" style="border:none; margin:0;">
                    <span>PRESET</span>
                </div>
                <select id="cf252ActPreset" onchange="cf252LoadPreset()" style="margin-bottom:10px;">
                    <option value="">-- 직접 입력 --</option>
                    ${CF252.PRESETS.filter(p => p.mode === 'activation').map(p =>
                        `<option value="${p.id}">${p.name} (${p.description})</option>`
                    ).join('')}
                </select>
            </div>

            <div class="cf252-section">
                <div class="grid-row">
                    <div>
                        <label>선원 방사능량</label>
                        <div class="input-group">
                            <input type="number" id="cf252ActSrc" value="54" step="0.1">
                            <span class="input-suffix">mCi</span>
                        </div>
                    </div>
                    <div>
                        <label>조사거리</label>
                        <div class="input-group">
                            <input type="number" id="cf252ActDist" value="1" step="0.1">
                            <span class="input-suffix">cm</span>
                        </div>
                    </div>
                </div>
                <div class="grid-row">
                    <div>
                        <label>조사시간</label>
                        <div class="input-group">
                            <input type="number" id="cf252ActTime" value="1" step="0.1">
                            <span class="input-suffix">분</span>
                        </div>
                    </div>
                    <div>
                        <label>냉각시간</label>
                        <div class="input-group">
                            <input type="number" id="cf252ActCool" value="0" step="0.1">
                            <span class="input-suffix">분</span>
                        </div>
                    </div>
                </div>
                <div class="grid-row">
                    <div>
                        <label>선량률 평가거리</label>
                        <div class="input-group">
                            <input type="number" id="cf252ActEvalDist" value="100" step="1">
                            <span class="input-suffix">cm</span>
                        </div>
                    </div>
                    <div>
                        <label>Al 체적 (집게)</label>
                        <div class="input-group">
                            <input type="number" id="cf252AlVolume" value="10" step="0.1">
                            <span class="input-suffix">cm³</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    cf252AddSource();
    cf252AddShield();

    // 리포트 영역도 모드별 wrap 생성
    const reportBox = document.getElementById('cf252ResultBox');
    if (reportBox && !document.getElementById('cf252DoseResultWrap')) {
        reportBox.innerHTML = `
            <div id="cf252DoseResultWrap"></div>
            <div id="cf252ShieldInvResultWrap" class="hidden"></div>
            <div id="cf252ActResultWrap" class="hidden"></div>`;
    }
}

function cf252AddSource() {
    const list = document.getElementById('cf252SourceList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'list-item cf252-source-row';
    div.innerHTML = `
        <div class="del-btn" onclick="this.parentElement.remove()">×</div>
        <div class="grid-row" style="margin:0; gap:5px;">
            <div style="flex:1">
                <label style="font-size:0.7rem;">방사능량 (mCi)</label>
                <input type="number" class="cf252-src-act" value="51" step="0.1">
            </div>
            <div style="flex:1">
                <label style="font-size:0.7rem;">거리 (cm)</label>
                <input type="number" class="cf252-src-dist" value="100" step="1">
            </div>
            <div style="flex:0.8">
                <label style="font-size:0.7rem;">용기</label>
                <select class="cf252-src-container">
                    <option value="">없음</option>
                    <option value="STC-100">STC-100</option>
                    <option value="UKTIB-313">УКТIIB-313</option>
                </select>
            </div>
        </div>`;
    list.appendChild(div);
}

function cf252AddShield() {
    const list = document.getElementById('cf252ShieldList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'list-item cf252-shield-row';
    div.innerHTML = `
        <div class="del-btn" onclick="this.parentElement.remove()">×</div>
        <div class="grid-row" style="margin:0; gap:5px;">
            <div style="flex:1">
                <label style="font-size:0.7rem;">차폐재</label>
                <select class="cf252-shield-mat">
                    <option value="Pb">납 (Pb)</option>
                    <option value="Concrete">콘크리트</option>
                    <option value="PE">폴리에틸렌 (PE)</option>
                    <option value="Water">물</option>
                    <option value="Paraffin">파라핀</option>
                </select>
            </div>
            <div style="flex:1">
                <label style="font-size:0.7rem;">두께 (cm)</label>
                <input type="number" class="cf252-shield-thick" value="0" step="0.1">
            </div>
        </div>`;
    list.appendChild(div);
}

function cf252LoadPreset() {
    const sel = cf252CurrentMode === 'dose'
        ? document.getElementById('cf252Preset')
        : document.getElementById('cf252ActPreset');
    if (!sel || !sel.value) return;
    const preset = CF252.PRESETS.find(p => p.id === sel.value);
    if (!preset) return;

    // 보고서 참조 표시
    const refEl = document.getElementById('cf252PresetRef');
    if (refEl && preset.reportRef) {
        refEl.textContent = '📋 ' + preset.reportRef;
        refEl.style.display = 'block';
    } else if (refEl) {
        refEl.style.display = 'none';
    }

    if (preset.mode === 'storage') {
        // 선원 목록 재구성
        const srcList = document.getElementById('cf252SourceList');
        srcList.innerHTML = '';
        preset.sources.forEach(src => {
            cf252AddSource();
            const rows = srcList.querySelectorAll('.cf252-source-row');
            const last = rows[rows.length - 1];
            last.querySelector('.cf252-src-act').value = src.activity_mCi;
            last.querySelector('.cf252-src-dist').value = src.distance_cm;
            if (src.container) last.querySelector('.cf252-src-container').value = src.container;
        });

        // 차폐 목록 재구성
        const shieldList = document.getElementById('cf252ShieldList');
        shieldList.innerHTML = '';
        const allShields = [...preset.shielding, ...preset.extraShielding];
        if (allShields.length === 0) {
            cf252AddShield();
        } else {
            allShields.forEach(s => {
                cf252AddShield();
                const rows = shieldList.querySelectorAll('.cf252-shield-row');
                const last = rows[rows.length - 1];
                last.querySelector('.cf252-shield-mat').value = s.material;
                last.querySelector('.cf252-shield-thick').value = s.thickness_cm;
            });
        }
    } else if (preset.mode === 'activation') {
        document.getElementById('cf252ActSrc').value = preset.activity_mCi;
        document.getElementById('cf252ActTime').value = preset.irradiation_time_min;
        document.getElementById('cf252ActDist').value = preset.irradiation_distance_cm;
        document.getElementById('cf252ActCool').value = preset.cooling_time_min;
        document.getElementById('cf252ActEvalDist').value = preset.eval_distance_cm;
    }
}

function cf252Calculate() {
    if (cf252CurrentMode === 'dose') {
        cf252CalcDose();
    } else if (cf252CurrentMode === 'shield_inv') {
        cf252CalcShieldInv();
    } else {
        cf252CalcActivation();
    }
    _saveAppState();
}

// --- 상태 저장/복원 (새로고침 간 유지) ---

function cf252GetState() {
    const state = { mode: cf252CurrentMode };

    // Dose 모드 입력
    const sources = [];
    document.querySelectorAll('.cf252-source-row').forEach(row => {
        sources.push({
            act: row.querySelector('.cf252-src-act').value,
            dist: row.querySelector('.cf252-src-dist').value,
            container: row.querySelector('.cf252-src-container').value
        });
    });
    const shields = [];
    document.querySelectorAll('.cf252-shield-row').forEach(row => {
        shields.push({
            mat: row.querySelector('.cf252-shield-mat').value,
            thick: row.querySelector('.cf252-shield-thick').value
        });
    });
    const criteriaEl = document.getElementById('cf252Criteria');
    const presetEl = document.getElementById('cf252Preset');
    state.dose = {
        sources: sources,
        shields: shields,
        criteria: criteriaEl ? criteriaEl.value : 'MANAGED_INNER',
        preset: presetEl ? presetEl.value : ''
    };

    // Shield Inverse 입력
    const invShields = [];
    document.querySelectorAll('.cf252-inv-shield-row').forEach(row => {
        invShields.push({
            mat: row.querySelector('.cf252-inv-shield-mat').value,
            thick: row.querySelector('.cf252-inv-shield-thick').value
        });
    });
    state.shieldInv = {
        act: (document.getElementById('cf252InvAct') || {}).value || '2700',
        dist: (document.getElementById('cf252InvDist') || {}).value || '130',
        target: (document.getElementById('cf252InvTarget') || {}).value || '10',
        mat: (document.getElementById('cf252InvMat') || {}).value || 'Concrete',
        limit: (document.getElementById('cf252InvLimit') || {}).value || 'MANAGED_OUTER',
        allMats: (document.getElementById('cf252InvAllMats') || {}).checked !== false,
        shields: invShields,
    };

    // Activation 모드 입력
    const actPresetEl = document.getElementById('cf252ActPreset');
    state.activation = {
        src: (document.getElementById('cf252ActSrc') || {}).value || '54',
        dist: (document.getElementById('cf252ActDist') || {}).value || '5',
        time: (document.getElementById('cf252ActTime') || {}).value || '1',
        cool: (document.getElementById('cf252ActCool') || {}).value || '0',
        evalDist: (document.getElementById('cf252ActEvalDist') || {}).value || '100',
        alVol: (document.getElementById('cf252AlVolume') || {}).value || '10',
        preset: actPresetEl ? actPresetEl.value : ''
    };

    // 결과 HTML 보존
    const doseResultWrap = document.getElementById('cf252DoseResultWrap');
    const shieldInvResultWrap = document.getElementById('cf252ShieldInvResultWrap');
    const actResultWrap = document.getElementById('cf252ActResultWrap');
    state.doseResultHTML = doseResultWrap ? doseResultWrap.innerHTML : '';
    state.shieldInvResultHTML = shieldInvResultWrap ? shieldInvResultWrap.innerHTML : '';
    state.actResultHTML = actResultWrap ? actResultWrap.innerHTML : '';
    state.hasResult = !document.getElementById('cf252ResultBox').classList.contains('hidden');

    return state;
}

function cf252RestoreState(state) {
    if (!state) return;

    // 모드 복원
    cf252CurrentMode = state.mode || 'dose';
    const modeOpts = document.querySelectorAll('#cf252Panel .mode-opt');
    modeOpts.forEach(o => {
        o.classList.remove('active');
        const txt = o.textContent.trim();
        if ((state.mode === 'dose' && txt.includes('선량')) ||
            (state.mode === 'shield_inv' && txt.includes('차폐역산')) ||
            (state.mode === 'activation' && txt.includes('방사화'))) {
            o.classList.add('active');
        }
    });

    // Wrap 토글
    const doseWrap = document.getElementById('cf252DoseWrap');
    const shieldInvWrap = document.getElementById('cf252ShieldInvWrap');
    const actWrap = document.getElementById('cf252ActWrap');
    if (doseWrap) doseWrap.classList.toggle('hidden', state.mode !== 'dose');
    if (shieldInvWrap) shieldInvWrap.classList.toggle('hidden', state.mode !== 'shield_inv');
    if (actWrap) actWrap.classList.toggle('hidden', state.mode !== 'activation');

    // Dose 입력 복원
    if (state.dose) {
        const srcList = document.getElementById('cf252SourceList');
        if (srcList && state.dose.sources.length > 0) {
            srcList.innerHTML = '';
            state.dose.sources.forEach(s => {
                cf252AddSource();
                const rows = srcList.querySelectorAll('.cf252-source-row');
                const last = rows[rows.length - 1];
                last.querySelector('.cf252-src-act').value = s.act;
                last.querySelector('.cf252-src-dist').value = s.dist;
                if (s.container) last.querySelector('.cf252-src-container').value = s.container;
            });
        }
        const shieldList = document.getElementById('cf252ShieldList');
        if (shieldList && state.dose.shields.length > 0) {
            shieldList.innerHTML = '';
            state.dose.shields.forEach(s => {
                cf252AddShield();
                const rows = shieldList.querySelectorAll('.cf252-shield-row');
                const last = rows[rows.length - 1];
                last.querySelector('.cf252-shield-mat').value = s.mat;
                last.querySelector('.cf252-shield-thick').value = s.thick;
            });
        }
        const criteriaEl = document.getElementById('cf252Criteria');
        if (criteriaEl && state.dose.criteria) criteriaEl.value = state.dose.criteria;
        const presetEl = document.getElementById('cf252Preset');
        if (presetEl && state.dose.preset) presetEl.value = state.dose.preset;
    }

    // Shield Inverse 입력 복원
    if (state.shieldInv) {
        const si = state.shieldInv;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('cf252InvAct', si.act);
        setVal('cf252InvDist', si.dist);
        setVal('cf252InvTarget', si.target);
        setVal('cf252InvMat', si.mat);
        setVal('cf252InvLimit', si.limit);
        const allMatsEl = document.getElementById('cf252InvAllMats');
        if (allMatsEl) allMatsEl.checked = si.allMats !== false;
        const invShieldList = document.getElementById('cf252InvShieldList');
        if (invShieldList && si.shields && si.shields.length > 0) {
            invShieldList.innerHTML = '';
            si.shields.forEach(s => {
                cf252AddInvShield();
                const rows = invShieldList.querySelectorAll('.cf252-inv-shield-row');
                const last = rows[rows.length - 1];
                last.querySelector('.cf252-inv-shield-mat').value = s.mat;
                last.querySelector('.cf252-inv-shield-thick').value = s.thick;
            });
        }
    }

    // Activation 입력 복원
    if (state.activation) {
        const a = state.activation;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('cf252ActSrc', a.src);
        setVal('cf252ActDist', a.dist);
        setVal('cf252ActTime', a.time);
        setVal('cf252ActCool', a.cool);
        setVal('cf252ActEvalDist', a.evalDist);
        setVal('cf252AlVolume', a.alVol);
        const actPresetEl = document.getElementById('cf252ActPreset');
        if (actPresetEl && a.preset) actPresetEl.value = a.preset;
    }

    // 결과 HTML 복원
    if (state.hasResult) {
        const doseResultWrap = document.getElementById('cf252DoseResultWrap');
        const shieldInvResultWrap = document.getElementById('cf252ShieldInvResultWrap');
        const actResultWrap = document.getElementById('cf252ActResultWrap');
        if (doseResultWrap && state.doseResultHTML) doseResultWrap.innerHTML = state.doseResultHTML;
        if (shieldInvResultWrap && state.shieldInvResultHTML) shieldInvResultWrap.innerHTML = state.shieldInvResultHTML;
        if (actResultWrap && state.actResultHTML) actResultWrap.innerHTML = state.actResultHTML;
        // 결과 표시
        document.getElementById('cf252ReportEmpty').classList.add('hidden');
        document.getElementById('cf252ResultBox').classList.remove('hidden');
        // 모드별 결과 wrap 토글
        if (doseResultWrap) doseResultWrap.classList.toggle('hidden', state.mode !== 'dose');
        if (shieldInvResultWrap) shieldInvResultWrap.classList.toggle('hidden', state.mode !== 'shield_inv');
        if (actResultWrap) actResultWrap.classList.toggle('hidden', state.mode !== 'activation');
    }
}

function cf252CalcDose() {
    // 선원 수집
    const sources = [];
    document.querySelectorAll('.cf252-source-row').forEach(row => {
        const act = parseFloat(row.querySelector('.cf252-src-act').value) || 0;
        const dist = parseFloat(row.querySelector('.cf252-src-dist').value) || 100;
        const container = row.querySelector('.cf252-src-container').value || null;
        if (act > 0) sources.push({ activity_mCi: act, distance_cm: dist, container: container });
    });

    if (sources.length === 0) return;

    // 추가 차폐 수집
    const extraShielding = [];
    document.querySelectorAll('.cf252-shield-row').forEach(row => {
        const mat = row.querySelector('.cf252-shield-mat').value;
        const thick = parseFloat(row.querySelector('.cf252-shield-thick').value) || 0;
        if (thick > 0) extraShielding.push({ material: mat, thickness_cm: thick });
    });

    const result = cf252MultiSourceDoseRate(sources, extraShielding);

    // 판정 기준
    const criteriaKey = document.getElementById('cf252Criteria').value;
    const limit = CF252.LIMITS[criteriaKey];
    const pass = result.total_uSvh <= limit.value;

    // 결과 표시
    cf252ShowDoseResult(result, limit, pass);

    // 감쇄 곡선 차트 — 첫 번째 차폐층 기준
    if (extraShielding.length > 0) {
        const chartMat = extraShielding[0].material;
        const maxThk = extraShielding[0].thickness_cm * 2 || 50;
        const totalAct = sources.reduce((s, x) => s + x.activity_mCi, 0);
        const avgDist = sources.reduce((s, x) => s + x.distance_cm, 0) / sources.length;
        cf252DrawAttenuationChart(totalAct, avgDist, chartMat, [], maxThk, limit.value);
    } else {
        cf252HideChart();
    }

    // 로그
    addToLog({
        mode: "CF252_DOSE",
        timestamp: new Date().toLocaleString(),
        totalInputVal: sources.map(s => s.activity_mCi + 'mCi').join('+'),
        inputUnit: "mCi",
        resultVal: result.total_uSvh.toExponential(3),
        resultUnit: "μSv/h"
    });
}

function cf252CalcActivation() {
    const src = parseFloat(document.getElementById('cf252ActSrc').value) || 0;
    const time_min = parseFloat(document.getElementById('cf252ActTime').value) || 1;
    const dist = parseFloat(document.getElementById('cf252ActDist').value) || 5;
    const cool_min = parseFloat(document.getElementById('cf252ActCool').value) || 0;
    const evalDist = parseFloat(document.getElementById('cf252ActEvalDist').value) || 100;

    if (src <= 0) return;

    const result = cf252ActivationCalc(
        src,
        time_min * 60,
        dist,
        cool_min * 60,
        evalDist
    );

    cf252ShowActivationResult(result);
    cf252HideChart();

    addToLog({
        mode: "CF252_ACTIVATION",
        timestamp: new Date().toLocaleString(),
        totalInputVal: src + 'mCi',
        inputUnit: "mCi",
        resultVal: result.doseRate_uSvh.toExponential(3),
        resultUnit: "μSv/h"
    });
}

function cf252ShowDoseResult(result, limit, pass) {
    document.getElementById('cf252ReportEmpty').classList.add('hidden');
    const box = document.getElementById('cf252ResultBox');
    box.classList.remove('hidden');
    // 모드별 결과 wrap 토글
    const dw = document.getElementById('cf252DoseResultWrap');
    const aw = document.getElementById('cf252ActResultWrap');
    if (dw) dw.classList.remove('hidden');
    if (aw) aw.classList.add('hidden');

    const passClass = pass ? 'cf252-pass' : 'cf252-fail';
    const passText = pass ? 'PASS' : 'FAIL';
    const passIcon = pass ? '✓' : '✗';

    let detailHTML = '';
    result.details.forEach(d => {
        detailHTML += `
            <tr>
                <td>#${d.index}</td>
                <td>${d.activity_mCi} mCi</td>
                <td>${d.distance_cm} cm</td>
                <td>${d.container || '-'}</td>
                <td>${cf252Fmt(d.gamma_mSvh * 1000)}</td>
                <td>${cf252Fmt(d.neutron_mSvh * 1000)}</td>
                <td>${cf252Fmt(d.total_mSvh * 1000)}</td>
            </tr>`;
    });

    const doseWrap = document.getElementById('cf252DoseResultWrap') || box;
    doseWrap.innerHTML = `
        <div class="cf252-result-header ${passClass}">
            <span class="cf252-verdict">${passIcon} ${passText}</span>
            <span class="cf252-verdict-label">${limit.label}</span>
        </div>

        <div class="cf252-result-main">
            <div class="cf252-result-row">
                <span class="cf252-result-label">감마선 선량률</span>
                <span class="cf252-result-value">${cf252Fmt(result.gamma_uSvh)} μSv/h</span>
                <span class="cf252-result-sub">(${result.gamma_mSvh.toExponential(3)} mSv/h)</span>
            </div>
            <div class="cf252-result-row">
                <span class="cf252-result-label">중성자 선량률</span>
                <span class="cf252-result-value">${cf252Fmt(result.neutron_uSvh)} μSv/h</span>
                <span class="cf252-result-sub">(${result.neutron_mSvh.toExponential(3)} mSv/h)</span>
            </div>
            <div class="cf252-result-row cf252-result-total">
                <span class="cf252-result-label">총 선량률</span>
                <span class="cf252-result-value">${cf252Fmt(result.total_uSvh)} μSv/h</span>
                <span class="cf252-result-sub">(${result.total_mSvh.toExponential(3)} mSv/h)</span>
            </div>
        </div>

        <div class="cf252-detail-section">
            <div class="header" style="border:none; font-size:0.85rem;">BREAKDOWN BY SOURCE</div>
            <div style="overflow-x:auto;">
                <table class="cf252-detail-table">
                    <thead>
                        <tr>
                            <th>#</th><th>방사능</th><th>거리</th><th>용기</th>
                            <th>γ (μSv/h)</th><th>n (μSv/h)</th><th>합계</th>
                        </tr>
                    </thead>
                    <tbody>${detailHTML}</tbody>
                </table>
            </div>
        </div>

        <div class="cf252-compliance-section">
            <div class="header" style="border:none; font-size:0.85rem;">COMPLIANCE CHECK</div>
            ${cf252ComplianceHTML(result.total_uSvh)}
        </div>

        ${(function() {
            const sel = document.getElementById('cf252Preset');
            if (!sel || !sel.value) return '';
            const p = CF252.PRESETS.find(x => x.id === sel.value);
            if (!p || !p.reportRef) return '';
            return '<div class="cf252-ref-section"><div class="header" style="border:none; font-size:0.85rem;">REPORT REFERENCE</div><div class="spec-report"><div class="spec-row"><span class="spec-val" style="color:var(--hobis-cyan);">' + p.reportRef + '</span></div></div></div>';
        })()}

        <div class="cf252-diagram-section" id="cf252DiagramSection">
            <div class="header" style="border:none; font-size:0.85rem;">SHIELDING DIAGRAM
                <button class="btn-outline cf252-expand-btn" onclick="(function(){ const inp = cf252GetCurrentInputs(); cf252OpenOverlay(inp.sources, inp.shielding, inp.criteriaKey); })()">⤢ EXPAND</button>
            </div>
            <div class="cf252-diagram-thumb" onclick="(function(){ const inp = cf252GetCurrentInputs(); cf252OpenOverlay(inp.sources, inp.shielding, inp.criteriaKey); })()" title="클릭하여 인터랙티브 뷰 열기">
                ${(function() {
                    const inp = cf252GetCurrentInputs();
                    return cf252GenerateSchematicSVG(inp.sources, inp.shielding, { width: 600, height: 200, compact: true });
                })()}
            </div>
        </div>

        <div class="cf252-3d-section" style="cursor:pointer;" onclick="cf252Open3DOverlay()">
            <div class="header" style="border:none; font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
                <span>3D HOT CELL STRUCTURE</span>
                <button class="btn-outline" onclick="event.stopPropagation(); cf252Open3DOverlay()" style="font-size:0.7rem; padding:2px 8px;">&#x2922; EXPAND</button>
            </div>
            <div style="height:180px; background:#0d1117; border-radius:4px; border:1px solid var(--hobis-border); position:relative; overflow:hidden;">
                <iframe src="cf252-hotcell-3d.html" style="width:200%; height:200%; transform:scale(0.5); transform-origin:top left; border:none; pointer-events:none;" loading="lazy"></iframe>
                <div style="position:absolute;inset:0;background:linear-gradient(transparent 60%, rgba(13,17,23,0.7));pointer-events:none;"></div>
            </div>
            <div style="text-align:center; font-size:0.7rem; color:#5f7481; padding:4px;">클릭하여 인터랙티브 3D 뷰어 열기</div>
        </div>

        <div class="cf252-constants-section">
            <div class="header" style="border:none; font-size:0.85rem;">APPLIED CONSTANTS</div>
            <div class="spec-report">
                <div class="spec-row"><span class="spec-key">Γ_γ (감마)</span><span class="spec-val">${CF252.GAMMA_CONST_MSV.toFixed(3)} mSv·cm²/(mCi·h)</span></div>
                <div class="spec-row"><span class="spec-key">Γ_n (중성자)</span><span class="spec-val">${CF252.NEUTRON_CONST_MSV.toFixed(3)} mSv·cm²/(mCi·h)</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Pb</span><span class="spec-val">${CF252.HVL_GAMMA.Pb} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Conc</span><span class="spec-val">${CF252.HVL_GAMMA.Concrete} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Water</span><span class="spec-val">${CF252.HVL_GAMMA.Water} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Paraffin</span><span class="spec-val">${CF252.HVL_GAMMA.Paraffin} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n PE</span><span class="spec-val">${CF252.HVL_NEUTRON.PE} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Pb</span><span class="spec-val">${CF252.HVL_NEUTRON.Pb} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Conc</span><span class="spec-val">${CF252.HVL_NEUTRON.Concrete} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Water</span><span class="spec-val">${CF252.HVL_NEUTRON.Water} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Paraffin</span><span class="spec-val">${CF252.HVL_NEUTRON.Paraffin} cm</span></div>
            </div>
        </div>`;
}

function cf252ShowActivationResult(r) {
    document.getElementById('cf252ReportEmpty').classList.add('hidden');
    const box = document.getElementById('cf252ResultBox');
    box.classList.remove('hidden');
    // 모드별 결과 wrap 토글
    const dw = document.getElementById('cf252DoseResultWrap');
    const aw = document.getElementById('cf252ActResultWrap');
    if (dw) dw.classList.add('hidden');
    if (aw) aw.classList.remove('hidden');

    const pass = r.doseRate_uSvh <= 1;
    const passClass = pass ? 'cf252-pass' : 'cf252-fail';
    const passText = pass ? 'PASS' : 'FAIL';
    const passIcon = pass ? '✓' : '✗';

    const actWrap = document.getElementById('cf252ActResultWrap') || box;
    actWrap.innerHTML = `
        <div class="cf252-result-header ${passClass}">
            <span class="cf252-verdict">${passIcon} ${passText}</span>
            <span class="cf252-verdict-label">일반인 경계 기준 (≤ 1 μSv/h)</span>
        </div>

        <div class="cf252-result-main">
            <div class="cf252-result-row">
                <span class="cf252-result-label">Al-28 생성 방사능</span>
                <span class="cf252-result-value">${r.cooled_activity_Bq.toExponential(3)} Bq</span>
                <span class="cf252-result-sub">(${(r.cooled_activity_Bq / 1000).toExponential(3)} kBq)</span>
            </div>
            <div class="cf252-result-row cf252-result-total">
                <span class="cf252-result-label">Al-28 선량률 @${r.eval_dist_cm}cm</span>
                <span class="cf252-result-value">${cf252Fmt(r.doseRate_uSvh)} μSv/h</span>
                <span class="cf252-result-sub">(${r.doseRate_mSvh.toExponential(3)} mSv/h)</span>
            </div>
        </div>

        <div class="cf252-detail-section">
            <div class="header" style="border:none; font-size:0.85rem;">CALCULATION DETAIL</div>
            <div class="spec-report">
                <div class="spec-row"><span class="spec-key">선원 방사능</span><span class="spec-val">${r.source_mCi} mCi</span></div>
                <div class="spec-row"><span class="spec-key">조사거리</span><span class="spec-val">${r.irrad_dist_cm} cm</span></div>
                <div class="spec-row"><span class="spec-key">조사시간</span><span class="spec-val">${(r.irrad_time_s / 60).toFixed(1)} 분 (${r.irrad_time_s} s)</span></div>
                <div class="spec-row"><span class="spec-key">냉각시간</span><span class="spec-val">${(r.cooling_time_s / 60).toFixed(1)} 분</span></div>
                <div class="spec-row"><span class="spec-key">중성자 선속밀도 (Φ)</span><span class="spec-val">${r.phi_neutrons_cm2s.toExponential(3)} n/(cm²·s)</span></div>
                <div class="spec-row"><span class="spec-key">N_target (Al-27 원자수)</span><span class="spec-val">${r.N_target.toExponential(3)}</span></div>
                <div class="spec-row"><span class="spec-key">σ (반응단면적)</span><span class="spec-val">${CF252.AL27_CROSS_SECTION.toExponential(1)} cm²</span></div>
                <div class="spec-row"><span class="spec-key">생성 직후 방사화량</span><span class="spec-val">${r.activity_Bq.toExponential(3)} Bq</span></div>
                <div class="spec-row"><span class="spec-key">냉각 후 방사화량</span><span class="spec-val">${r.cooled_activity_Bq.toExponential(3)} Bq</span></div>
                <div class="spec-row"><span class="spec-key">Al-28 Γ</span><span class="spec-val">${CF252.AL28_GAMMA_CONST_MSV.toFixed(3)} mSv·cm²/(mCi·h)</span></div>
                <div class="spec-row"><span class="spec-key">평가거리</span><span class="spec-val">${r.eval_dist_cm} cm</span></div>
            </div>
        </div>

        <div class="cf252-detail-section">
            <div class="header" style="border:none; font-size:0.85rem;">NUCLEAR REACTION</div>
            <div style="text-align:center; padding:10px; font-family:'Share Tech Mono',monospace; font-size:0.9rem; color:var(--hobis-cyan);">
                <sup>27</sup>Al (n, γ) → <sup>28</sup>Al → <sup>28</sup>Si + β⁻ + γ (1.779 MeV)
                <br><span style="color:#8fa3b0; font-size:0.8rem;">T½ = 2.24 min</span>
            </div>
        </div>`;
}

function cf252ComplianceHTML(total_uSvh) {
    const checks = cf252EvaluateCompliance(total_uSvh);
    return checks.map(c => {
        const cls = c.pass ? 'cf252-check-pass' : 'cf252-check-fail';
        const icon = c.pass ? '✓' : '✗';
        return `<div class="cf252-check-row ${cls}">
            <span>${icon}</span>
            <span>${c.label}</span>
            <span>${cf252Fmt(c.actual_uSvh)} / ${c.limit_uSvh} μSv/h</span>
        </div>`;
    }).join('');
}

function cf252Fmt(val) {
    if (Math.abs(val) < 0.001) return val.toExponential(3);
    if (Math.abs(val) < 1) return val.toFixed(4);
    if (Math.abs(val) < 100) return val.toFixed(2);
    return val.toExponential(3);
}

// --- 차폐 역산 모드 ---

function cf252AddInvShield() {
    const list = document.getElementById('cf252InvShieldList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'list-item cf252-inv-shield-row';
    div.innerHTML = `
        <div class="del-btn" onclick="this.parentElement.remove()">×</div>
        <div class="grid-row" style="margin:0; gap:5px;">
            <div style="flex:1">
                <label style="font-size:0.7rem;">차폐재</label>
                <select class="cf252-inv-shield-mat">
                    <option value="Pb">납 (Pb)</option>
                    <option value="Concrete">콘크리트</option>
                    <option value="PE">폴리에틸렌 (PE)</option>
                    <option value="Water">물</option>
                    <option value="Paraffin">파라핀</option>
                </select>
            </div>
            <div style="flex:1">
                <label style="font-size:0.7rem;">두께 (cm)</label>
                <input type="number" class="cf252-inv-shield-thick" value="0" step="0.1">
            </div>
        </div>`;
    list.appendChild(div);
}

function cf252InvLimitChanged() {
    const sel = document.getElementById('cf252InvLimit');
    if (!sel || !sel.value) return;
    const limit = CF252.LIMITS[sel.value];
    if (limit) document.getElementById('cf252InvTarget').value = limit.value;
}

function cf252CalcShieldInv() {
    const act = parseFloat(document.getElementById('cf252InvAct').value) || 0;
    const dist = parseFloat(document.getElementById('cf252InvDist').value) || 100;
    const target = parseFloat(document.getElementById('cf252InvTarget').value) || 10;
    const mat = document.getElementById('cf252InvMat').value;
    const allMats = document.getElementById('cf252InvAllMats').checked;

    if (act <= 0) return;

    // 기존 차폐 수집
    const existingShielding = [];
    document.querySelectorAll('.cf252-inv-shield-row').forEach(row => {
        const m = row.querySelector('.cf252-inv-shield-mat').value;
        const t = parseFloat(row.querySelector('.cf252-inv-shield-thick').value) || 0;
        if (t > 0) existingShielding.push({ material: m, thickness_cm: t });
    });

    const results = [];
    if (allMats) {
        ['Concrete', 'Pb', 'PE', 'Water', 'Paraffin'].forEach(m => {
            const r = cf252ShieldInverseCalc(act, dist, m, target, existingShielding);
            if (r) results.push(r);
        });
    } else {
        const r = cf252ShieldInverseCalc(act, dist, mat, target, existingShielding);
        if (r) results.push(r);
    }

    if (results.length === 0) return;

    cf252ShowShieldInvResult(results, act, dist, target, existingShielding);

    // 감쇄 곡선 차트 — 주 차폐재 기준
    const maxThk = Math.max(...results.map(r => r.thickness_cm)) * 1.3 || 50;
    const chartMat = results[0].material;
    cf252DrawAttenuationChart(act, dist, chartMat, existingShielding, maxThk, target);

    addToLog({
        mode: "CF252_SHIELD_INV",
        timestamp: new Date().toLocaleString(),
        totalInputVal: act + 'mCi @' + dist + 'cm',
        inputUnit: "mCi",
        resultVal: results[0].thickness_cm.toFixed(1) + 'cm ' + results[0].material,
        resultUnit: "cm"
    });
}

function cf252ShowShieldInvResult(results, act, dist, target, existingShielding) {
    document.getElementById('cf252ReportEmpty').classList.add('hidden');
    const box = document.getElementById('cf252ResultBox');
    box.classList.remove('hidden');
    const dw = document.getElementById('cf252DoseResultWrap');
    const sw = document.getElementById('cf252ShieldInvResultWrap');
    const aw = document.getElementById('cf252ActResultWrap');
    if (dw) dw.classList.add('hidden');
    if (sw) sw.classList.remove('hidden');
    if (aw) aw.classList.add('hidden');

    const matNames = { 'Concrete': '콘크리트', 'Pb': '납', 'PE': '폴리에틸렌', 'Water': '물', 'Paraffin': '파라핀' };
    const primary = results[0];

    let tableHTML = '';
    results.forEach(r => {
        const thkMM = (r.thickness_cm * 10).toFixed(0);
        tableHTML += `
            <tr>
                <td>${matNames[r.material] || r.material}</td>
                <td style="color:var(--hobis-warn); font-weight:bold;">${r.thickness_cm.toFixed(1)} cm (${thkMM} mm)</td>
                <td>${cf252Fmt(r.total_before_uSvh)} μSv/h</td>
                <td>${cf252Fmt(r.total_after_uSvh)} μSv/h</td>
            </tr>`;
    });

    let existHTML = '';
    if (existingShielding.length > 0) {
        existHTML = `<div class="spec-report" style="margin-bottom:10px;">`;
        existingShielding.forEach(s => {
            existHTML += `<div class="spec-row"><span class="spec-key">기존 ${matNames[s.material] || s.material}</span><span class="spec-val">${s.thickness_cm} cm</span></div>`;
        });
        existHTML += `</div>`;
    }

    const wrap = document.getElementById('cf252ShieldInvResultWrap') || box;
    wrap.innerHTML = `
        <div class="cf252-result-header" style="background:var(--hobis-warn); color:#000;">
            <span class="cf252-verdict" style="color:#000;">SHIELD INVERSE</span>
            <span class="cf252-verdict-label" style="color:#333;">목표: ≤ ${target} μSv/h</span>
        </div>

        <div class="cf252-result-main">
            <div class="cf252-result-row">
                <span class="cf252-result-label">선원</span>
                <span class="cf252-result-value">${act} mCi @ ${dist} cm</span>
            </div>
            <div class="cf252-result-row">
                <span class="cf252-result-label">차폐 전 선량률</span>
                <span class="cf252-result-value">${cf252Fmt(primary.total_before_uSvh)} μSv/h</span>
                <span class="cf252-result-sub">(γ: ${cf252Fmt(primary.gamma_before * 1000)} + n: ${cf252Fmt(primary.neutron_before * 1000)})</span>
            </div>
        </div>

        ${existHTML}

        <div class="cf252-detail-section">
            <div class="header" style="border:none; font-size:0.85rem;">REQUIRED THICKNESS</div>
            <div style="overflow-x:auto;">
                <table class="cf252-detail-table">
                    <thead>
                        <tr><th>차폐재</th><th>필요 두께</th><th>차폐 전</th><th>차폐 후</th></tr>
                    </thead>
                    <tbody>${tableHTML}</tbody>
                </table>
            </div>
        </div>

        <div class="cf252-diagram-section">
            <div class="header" style="border:none; font-size:0.85rem;">SHIELDING DIAGRAM</div>
            <div class="cf252-diagram-thumb">
                ${cf252GenerateSchematicSVG([{activity_mCi: act, distance_cm: dist}], existingShielding.concat(results.map(r => ({material: r.material, thickness_cm: r.thickness_cm}))), {width: 600, height: 200, compact: true})}
            </div>
        </div>

        <div class="cf252-detail-section">
            <div class="header" style="border:none; font-size:0.85rem;">HVL REFERENCE</div>
            <div class="spec-report">
                <div class="spec-row"><span class="spec-key">감마 HVL</span><span class="spec-val">Pb=${CF252.HVL_GAMMA.Pb}, Conc=${CF252.HVL_GAMMA.Concrete}, Water=${CF252.HVL_GAMMA.Water}, Paraffin=${CF252.HVL_GAMMA.Paraffin}cm</span></div>
                <div class="spec-row"><span class="spec-key">중성자 HVL</span><span class="spec-val">PE=${CF252.HVL_NEUTRON.PE}, Pb=${CF252.HVL_NEUTRON.Pb}, Conc=${CF252.HVL_NEUTRON.Concrete}, Water=${CF252.HVL_NEUTRON.Water}, Paraffin=${CF252.HVL_NEUTRON.Paraffin}cm</span></div>
            </div>
        </div>`;
}

// --- 감쇄 곡선 차트 ---

let _cf252Chart = null;

function cf252HideChart() {
    const wrap = document.getElementById('cf252ChartWrap');
    if (wrap) wrap.classList.add('hidden');
}

function cf252DrawAttenuationChart(activity_mCi, distance_cm, material, existingShielding, maxThickness_cm, target_uSvh) {
    const wrap = document.getElementById('cf252ChartWrap');
    if (!wrap) return;
    wrap.classList.remove('hidden');

    if (_cf252Chart) { _cf252Chart.destroy(); _cf252Chart = null; }

    const ctx = document.getElementById('cf252Chart').getContext('2d');
    const steps = 100;
    const labels = [];
    const gammaData = [];
    const neutronData = [];
    const totalData = [];
    const targetLine = [];

    for (let i = 0; i <= steps; i++) {
        const t = i * (maxThickness_cm / steps);
        labels.push(t.toFixed(1));

        const shielding = [...existingShielding, { material: material, thickness_cm: t }];
        const g = cf252GammaDoseRate(activity_mCi, distance_cm, shielding) * 1000; // μSv/h
        const n = cf252NeutronDoseRate(activity_mCi, distance_cm, shielding) * 1000;

        gammaData.push(g);
        neutronData.push(n);
        totalData.push(g + n);
        targetLine.push(target_uSvh);
    }

    Chart.defaults.color = '#5f7481';
    const matNames = { 'Concrete': '콘크리트', 'Pb': '납', 'PE': 'PE', 'Water': '물', 'Paraffin': '파라핀' };

    _cf252Chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '총 선량률 (γ+n)',
                    data: totalData,
                    borderColor: '#00ff33',
                    backgroundColor: 'rgba(0,255,51,0.05)',
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3,
                },
                {
                    label: '감마선',
                    data: gammaData,
                    borderColor: '#ff9900',
                    borderDash: [5, 3],
                    pointRadius: 0,
                    borderWidth: 1.5,
                    tension: 0.3,
                },
                {
                    label: '중성자',
                    data: neutronData,
                    borderColor: '#00f7ff',
                    borderDash: [5, 3],
                    pointRadius: 0,
                    borderWidth: 1.5,
                    tension: 0.3,
                },
                {
                    label: '기준 (' + target_uSvh + ' μSv/h)',
                    data: targetLine,
                    borderColor: '#ff3300',
                    borderDash: [10, 5],
                    pointRadius: 0,
                    borderWidth: 1,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { font: { size: 10 } } },
                tooltip: {
                    callbacks: {
                        title: (items) => (matNames[material] || material) + ' ' + items[0].label + ' cm',
                        label: (ctx) => ctx.dataset.label + ': ' + cf252Fmt(ctx.parsed.y) + ' μSv/h',
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: (matNames[material] || material) + ' 두께 (cm)' },
                    grid: { color: '#1f2b33' },
                    ticks: { maxTicksLimit: 10 },
                },
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: '선량률 (μSv/h)' },
                    grid: { color: '#1f2b33' },
                }
            }
        }
    });
}

// --- 보고서 PDF 내보내기 ---

function cf252ExportPDF() {
    const resultBox = document.getElementById('cf252ResultBox');
    if (!resultBox || resultBox.classList.contains('hidden')) {
        alert('계산 결과가 없습니다. 먼저 CALCULATE를 실행하세요.');
        return;
    }

    let contentHTML = '';
    if (cf252CurrentMode === 'dose') {
        const w = document.getElementById('cf252DoseResultWrap');
        if (w) contentHTML = w.innerHTML;
    } else if (cf252CurrentMode === 'shield_inv') {
        const w = document.getElementById('cf252ShieldInvResultWrap');
        if (w) contentHTML = w.innerHTML;
    } else {
        const w = document.getElementById('cf252ActResultWrap');
        if (w) contentHTML = w.innerHTML;
    }

    if (!contentHTML) { alert('표시할 결과가 없습니다.'); return; }

    // 차트 이미지 캡처
    let chartImg = '';
    const chartCanvas = document.getElementById('cf252Chart');
    const chartWrap = document.getElementById('cf252ChartWrap');
    if (chartCanvas && chartWrap && !chartWrap.classList.contains('hidden')) {
        try { chartImg = '<div style="text-align:center;margin:20px 0;"><img src="' + chartCanvas.toDataURL('image/png') + '" style="max-width:100%;height:auto;"></div>'; } catch (e) {}
    }

    const modeNames = { 'dose': '선량평가', 'shield_inv': '차폐역산', 'activation': '방사화평가' };
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);

    const printHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cf-252 ' + (modeNames[cf252CurrentMode] || '') + '</title>' +
        '<style>' +
        '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap");' +
        '*{box-sizing:border-box;margin:0;padding:0}' +
        'body{font-family:"Noto Sans KR",sans-serif;color:#222;padding:30px;font-size:12px;line-height:1.6}' +
        '.report-header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}' +
        '.report-header h1{font-size:18px;margin-bottom:5px}' +
        '.report-header .sub{font-size:11px;color:#666}' +
        '.report-meta{display:flex;justify-content:space-between;font-size:10px;color:#888;margin-bottom:15px;padding:5px 0;border-bottom:1px solid #ddd}' +
        '.cf252-result-header{padding:10px 15px;font-weight:bold;font-size:14px;display:flex;justify-content:space-between;align-items:center;border:2px solid #333;margin-bottom:10px}' +
        '.cf252-pass{background:#e8f5e9;border-color:#4caf50}.cf252-fail{background:#ffebee;border-color:#f44336}' +
        '.cf252-result-main{margin:10px 0}' +
        '.cf252-result-row{display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #eee}' +
        '.cf252-result-total{font-weight:bold;background:#f5f5f5}' +
        '.cf252-result-label{color:#555}.cf252-result-value{font-weight:bold}.cf252-result-sub{color:#888;font-size:10px}' +
        '.cf252-detail-section{margin:15px 0}' +
        '.cf252-detail-table{width:100%;border-collapse:collapse;font-size:11px}' +
        '.cf252-detail-table th{background:#f0f0f0;padding:6px 8px;border:1px solid #ddd;text-align:left}' +
        '.cf252-detail-table td{padding:5px 8px;border:1px solid #ddd}' +
        '.cf252-check-row{display:flex;gap:10px;padding:3px 10px;font-size:11px}' +
        '.cf252-check-pass{color:#2e7d32}.cf252-check-fail{color:#c62828}' +
        '.cf252-compliance-section,.cf252-constants-section,.cf252-ref-section{margin:10px 0}' +
        '.header{font-weight:bold;font-size:12px;color:#333;margin:10px 0 5px}' +
        '.spec-report{font-size:11px}' +
        '.spec-row{display:flex;justify-content:space-between;padding:2px 10px;border-bottom:1px dotted #ddd}' +
        '.spec-key{color:#555}.spec-val{color:#222}' +
        '.cf252-verdict{font-size:16px}.cf252-verdict-label{font-size:11px}' +
        '.report-footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}' +
        '@media print{body{padding:15px}}' +
        '</style></head><body>' +
        '<div class="report-header"><h1>Cf-252 ' + (modeNames[cf252CurrentMode] || '') + ' 보고서</h1>' +
        '<div class="sub">HOBIS v6.0 — Radiation Protection Calculation System</div></div>' +
        '<div class="report-meta"><span>작성일: ' + dateStr + ' ' + timeStr + '</span>' +
        '<span>REF: HJSR-01 REV.13 (6차 보완)</span></div>' +
        contentHTML + chartImg +
        '<div class="report-footer">Generated by HOBIS v6.0 Cf-252 Dose Assessment Module<br>' +
        'Based on: 호진산업기연(주) 방사선안전보고서 HJSR-01 REV.13 (6차 보완)</div>' +
        '</body></html>';

    const pw = window.open('', '_blank');
    if (pw) {
        pw.document.write(printHTML);
        pw.document.close();
        setTimeout(function() { pw.print(); }, 500);
    } else {
        const blob = new Blob([printHTML], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cf252_report_' + dateStr.replace(/-/g, '') + '.html';
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

// === 차폐 단면도 SVG 생성 + 인터랙티브 오버레이 ===

/**
 * 차폐 단면도 SVG 생성
 * 선원(왼쪽) → 차폐층(가운데) → 평가점(오른쪽) 횡단면도
 * @param {Array} sources - [{activity_mCi, distance_cm, container}]
 * @param {Array} shielding - [{material, thickness_cm}]
 * @param {Object} options - {width, height, compact}
 * @returns {string} SVG HTML string
 */
function cf252GenerateSchematicSVG(sources, shielding, options = {}) {
    const W = options.width || 700;
    const H = options.height || 260;
    const compact = options.compact || false;
    const pad = compact ? 30 : 50;

    // 재료 색상 매핑
    const matColors = {
        'Pb': { fill: '#6b7b8d', stroke: '#8fa3b0', label: '납' },
        'Concrete': { fill: '#7a6e5e', stroke: '#a09080', label: '콘크리트' },
        'PE': { fill: '#4a8a5a', stroke: '#6abf7a', label: 'PE' },
        'Water': { fill: '#2a5fa0', stroke: '#4a9fef', label: '물' },
        'Paraffin': { fill: '#a08040', stroke: '#d0b060', label: '파라핀' },
    };

    // 총 거리 계산 (첫 번째 선원 기준)
    const src = sources[0] || { activity_mCi: 54, distance_cm: 100 };
    const totalDist = src.distance_cm;
    const totalShieldThick = shielding.reduce((s, l) => s + l.thickness_cm, 0);
    const freePathBefore = totalDist - totalShieldThick > 0 ? totalDist - totalShieldThick : totalDist * 0.3;

    // 도면 영역 (패딩 제외)
    const drawW = W - pad * 2;
    const drawH = H - 60;
    const centerY = 50 + drawH / 2;

    // 스케일: 총 거리 → drawW 매핑
    const scale = drawW / (totalDist + 40); // 여유 40cm

    // 선원 위치
    const srcX = pad + 15;
    // 차폐 시작 위치
    const shieldStartX = srcX + freePathBefore * scale;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:'Share Tech Mono',monospace;">`;

    // 배경
    svg += `<rect width="${W}" height="${H}" fill="#0d1117" rx="4"/>`;

    // --- 선원 아이콘 (방사선 마크) ---
    svg += `<g transform="translate(${srcX},${centerY})">`;
    svg += `<circle r="12" fill="#ff9900" opacity="0.3"/>`;
    svg += `<circle r="6" fill="#ff9900" opacity="0.7"/>`;
    svg += `<circle r="2.5" fill="#ffcc00"/>`;
    // 방사선 파동
    for (let i = 0; i < 3; i++) {
        const r = 18 + i * 8;
        svg += `<path d="M ${r * 0.7} ${-r * 0.7} A ${r} ${r} 0 0 1 ${r * 0.7} ${r * 0.7}" fill="none" stroke="#ff9900" stroke-width="1" opacity="${0.5 - i * 0.15}"/>`;
    }
    svg += `</g>`;

    // 선원 라벨
    const actLabel = sources.length > 1
        ? sources.map(s => s.activity_mCi).join('+') + ' mCi'
        : src.activity_mCi + ' mCi';
    svg += `<text x="${srcX}" y="${centerY - 22}" text-anchor="middle" fill="#ff9900" font-size="${compact ? 9 : 11}">${actLabel}</text>`;

    // 용기 표시
    if (src.container && CF252.CONTAINERS[src.container]) {
        const c = CF252.CONTAINERS[src.container];
        const cw = 20, ch = 35;
        svg += `<rect x="${srcX + 14}" y="${centerY - ch / 2}" width="${cw}" height="${ch}" rx="3" fill="none" stroke="#5f7481" stroke-width="1" stroke-dasharray="3,2"/>`;
        svg += `<text x="${srcX + 14 + cw / 2}" y="${centerY + ch / 2 + 12}" text-anchor="middle" fill="#5f7481" font-size="8">${c.name}</text>`;
    }

    // --- 차폐층 ---
    let shieldX = shieldStartX;
    shielding.forEach((layer, idx) => {
        const layerW = Math.max(layer.thickness_cm * scale, 15); // 최소 15px 가시성
        const layerH = drawH * 0.7;
        const y = centerY - layerH / 2;
        const mc = matColors[layer.material] || { fill: '#555', stroke: '#888', label: layer.material };

        // 차폐체 사각형
        svg += `<rect x="${shieldX}" y="${y}" width="${layerW}" height="${layerH}" fill="${mc.fill}" stroke="${mc.stroke}" stroke-width="1.5" opacity="0.7" rx="2"/>`;

        // 해칭 패턴 (재질 구분)
        if (layer.material === 'Pb') {
            for (let hy = y + 5; hy < y + layerH - 5; hy += 8) {
                svg += `<line x1="${shieldX + 3}" y1="${hy}" x2="${shieldX + layerW - 3}" y2="${hy + 6}" stroke="${mc.stroke}" stroke-width="0.5" opacity="0.4"/>`;
            }
        } else if (layer.material === 'Water' || layer.material === 'Paraffin') {
            for (let hy = y + 8; hy < y + layerH - 5; hy += 12) {
                svg += `<path d="M ${shieldX + 3} ${hy} Q ${shieldX + layerW * 0.3} ${hy - 4} ${shieldX + layerW * 0.5} ${hy} Q ${shieldX + layerW * 0.7} ${hy + 4} ${shieldX + layerW - 3} ${hy}" fill="none" stroke="${mc.stroke}" stroke-width="0.7" opacity="0.5"/>`;
            }
        } else if (layer.material === 'Concrete') {
            for (let dx = 5; dx < layerW - 5; dx += 10) {
                for (let dy = 8; dy < layerH - 5; dy += 12) {
                    svg += `<circle cx="${shieldX + dx + Math.random() * 4}" cy="${y + dy}" r="${1 + Math.random()}" fill="${mc.stroke}" opacity="0.3"/>`;
                }
            }
        }

        // 재질 라벨 (중앙)
        const labelSize = compact ? 8 : 10;
        svg += `<text x="${shieldX + layerW / 2}" y="${centerY - 2}" text-anchor="middle" fill="#fff" font-size="${labelSize}" font-weight="bold">${mc.label}</text>`;
        svg += `<text x="${shieldX + layerW / 2}" y="${centerY + 12}" text-anchor="middle" fill="${mc.stroke}" font-size="${compact ? 7 : 9}">${layer.thickness_cm}cm</text>`;

        // 두께 치수선 (상단)
        const dimY = y - 8;
        svg += `<line x1="${shieldX}" y1="${dimY}" x2="${shieldX + layerW}" y2="${dimY}" stroke="#00f7ff" stroke-width="0.8"/>`;
        svg += `<line x1="${shieldX}" y1="${dimY - 4}" x2="${shieldX}" y2="${dimY + 4}" stroke="#00f7ff" stroke-width="0.8"/>`;
        svg += `<line x1="${shieldX + layerW}" y1="${dimY - 4}" x2="${shieldX + layerW}" y2="${dimY + 4}" stroke="#00f7ff" stroke-width="0.8"/>`;
        if (!compact) {
            svg += `<text x="${shieldX + layerW / 2}" y="${dimY - 3}" text-anchor="middle" fill="#00f7ff" font-size="8">${layer.thickness_cm} cm</text>`;
        }

        shieldX += layerW;
    });

    // --- 평가점 ---
    const evalX = srcX + totalDist * scale;
    svg += `<g transform="translate(${evalX},${centerY})">`;
    svg += `<circle r="5" fill="none" stroke="#00ff33" stroke-width="2"/>`;
    svg += `<line x1="-4" y1="0" x2="4" y2="0" stroke="#00ff33" stroke-width="1.5"/>`;
    svg += `<line x1="0" y1="-4" x2="0" y2="4" stroke="#00ff33" stroke-width="1.5"/>`;
    svg += `</g>`;
    svg += `<text x="${evalX}" y="${centerY + 22}" text-anchor="middle" fill="#00ff33" font-size="${compact ? 8 : 10}">평가점</text>`;

    // --- 총 거리 치수선 (하단) ---
    const dimBottomY = centerY + (compact ? 35 : 45);
    svg += `<line x1="${srcX}" y1="${dimBottomY}" x2="${evalX}" y2="${dimBottomY}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<line x1="${srcX}" y1="${dimBottomY - 5}" x2="${srcX}" y2="${dimBottomY + 5}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<line x1="${evalX}" y1="${dimBottomY - 5}" x2="${evalX}" y2="${dimBottomY + 5}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<text x="${(srcX + evalX) / 2}" y="${dimBottomY + 14}" text-anchor="middle" fill="#ffcc00" font-size="${compact ? 9 : 11}">총 거리: ${totalDist} cm</text>`;

    // 선원-차폐 거리 (점선)
    if (freePathBefore > 10 && !compact) {
        const fpEndX = shieldStartX;
        svg += `<line x1="${srcX}" y1="${centerY}" x2="${fpEndX}" y2="${centerY}" stroke="#5f7481" stroke-width="0.8" stroke-dasharray="4,3"/>`;
    }

    // 타이틀
    if (!compact) {
        svg += `<text x="${W / 2}" y="18" text-anchor="middle" fill="#8fa3b0" font-size="11" font-family="'Orbitron',sans-serif">SHIELDING CROSS-SECTION</text>`;
    }

    svg += `</svg>`;
    return svg;
}

/**
 * 인터랙티브 오버레이 열기
 * 전체화면 모달에 확대 도면 + 슬라이더 + 실시간 재계산
 */
function cf252OpenOverlay(sources, shielding, limitKey) {
    // 기존 오버레이 제거
    let overlay = document.getElementById('cf252Overlay');
    if (overlay) overlay.remove();

    const limit = CF252.LIMITS[limitKey] || CF252.LIMITS.MANAGED_INNER;

    overlay = document.createElement('div');
    overlay.id = 'cf252Overlay';
    overlay.className = 'cf252-overlay';

    // 슬라이더 HTML 생성
    const matNames = { 'Pb': '납', 'Concrete': '콘크리트', 'PE': 'PE', 'Water': '물', 'Paraffin': '파라핀' };
    const src = sources[0] || { activity_mCi: 54, distance_cm: 100 };

    let slidersHTML = `
        <div class="cf252-ov-sliders">
            <div class="cf252-ov-slider-group">
                <label>방사능량: <span id="cf252OvActVal">${src.activity_mCi}</span> mCi</label>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="range" id="cf252OvAct" min="1" max="${Math.max(src.activity_mCi * 2, 5400)}" step="1" value="${src.activity_mCi}" style="flex:1;">
                    <input type="number" id="cf252OvActNum" min="1" max="${Math.max(src.activity_mCi * 2, 5400)}" step="1" value="${src.activity_mCi}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="cf252OvSyncInput('cf252OvAct')">
                    <span style="font-size:10px; color:#5f7481;">mCi</span>
                </div>
            </div>
            <div class="cf252-ov-slider-group">
                <label>총 거리: <span id="cf252OvDistVal">${src.distance_cm}</span> cm</label>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="range" id="cf252OvDist" min="10" max="${Math.max(src.distance_cm * 3, 500)}" step="1" value="${src.distance_cm}" style="flex:1;">
                    <input type="number" id="cf252OvDistNum" min="10" max="${Math.max(src.distance_cm * 3, 500)}" step="1" value="${src.distance_cm}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="cf252OvSyncInput('cf252OvDist')">
                    <span style="font-size:10px; color:#5f7481;">cm</span>
                </div>
            </div>`;

    shielding.forEach((layer, idx) => {
        const maxThick = Math.max(layer.thickness_cm * 3, 100);
        slidersHTML += `
            <div class="cf252-ov-slider-group">
                <label>${matNames[layer.material] || layer.material} 두께: <span id="cf252OvShield${idx}Val">${layer.thickness_cm}</span> cm</label>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="range" class="cf252-ov-shield-slider" data-idx="${idx}" id="cf252OvShield${idx}" min="0" max="${maxThick}" step="0.5" value="${layer.thickness_cm}" style="flex:1;">
                    <input type="number" id="cf252OvShield${idx}Num" min="0" max="${maxThick}" step="0.5" value="${layer.thickness_cm}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="cf252OvSyncInput('cf252OvShield${idx}')">
                    <span style="font-size:10px; color:#5f7481;">cm</span>
                </div>
            </div>`;
    });

    // 차폐재 추가 버튼
    slidersHTML += `
        <div class="cf252-ov-add-shield">
            <select id="cf252OvAddMat">
                <option value="Water">물</option>
                <option value="Pb">납</option>
                <option value="Concrete">콘크리트</option>
                <option value="PE">PE</option>
                <option value="Paraffin">파라핀</option>
            </select>
            <button class="btn-outline" onclick="cf252OvAddShieldLayer()">+ 차폐층 추가</button>
        </div>
    </div>`;

    overlay.innerHTML = `
        <div class="cf252-ov-content">
            <div class="cf252-ov-header">
                <span style="font-family:'Orbitron',sans-serif; color:var(--hobis-warn);">INTERACTIVE SHIELDING ANALYSIS</span>
                <button class="cf252-ov-close" onclick="cf252CloseOverlay()">&times;</button>
            </div>
            <div class="cf252-ov-body">
                <div class="cf252-ov-diagram" id="cf252OvDiagram">
                    ${cf252GenerateSchematicSVG(sources, shielding, { width: 900, height: 300 })}
                </div>
                <div class="cf252-ov-controls">
                    ${slidersHTML}
                    <div class="cf252-ov-result" id="cf252OvResult"></div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    // 클릭으로 닫기 (배경 클릭)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cf252CloseOverlay();
    });

    // ESC로 닫기
    overlay._keyHandler = (e) => { if (e.key === 'Escape') cf252CloseOverlay(); };
    document.addEventListener('keydown', overlay._keyHandler);

    // 오버레이 데이터 저장 (재계산용)
    overlay._data = {
        sources: JSON.parse(JSON.stringify(sources)),
        shielding: JSON.parse(JSON.stringify(shielding)),
        limitKey: limitKey,
    };

    // 슬라이더 이벤트 바인딩 (슬라이더 → 텍스트 동기화 + 재계산)
    const actSlider = document.getElementById('cf252OvAct');
    const distSlider = document.getElementById('cf252OvDist');

    const syncAndUpdate = (sliderId) => {
        const slider = document.getElementById(sliderId);
        const numInput = document.getElementById(sliderId + 'Num');
        if (slider && numInput) numInput.value = slider.value;
        cf252OvRecalculate();
    };
    if (actSlider) actSlider.addEventListener('input', () => syncAndUpdate('cf252OvAct'));
    if (distSlider) distSlider.addEventListener('input', () => syncAndUpdate('cf252OvDist'));
    document.querySelectorAll('.cf252-ov-shield-slider').forEach(s => {
        s.addEventListener('input', () => syncAndUpdate(s.id));
    });

    // 초기 결과 표시
    cf252OvRecalculate();

    // 애니메이션 (DOM 추가 후 약간 지연하여 트랜지션 트리거)
    setTimeout(() => overlay.classList.add('cf252-ov-visible'), 30);
}

/**
 * 기존 차폐 오버레이: 텍스트 입력 → 슬라이더 동기화 + 재계산
 */
function cf252OvSyncInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const numInput = document.getElementById(sliderId + 'Num');
    if (slider && numInput) {
        let v = parseFloat(numInput.value);
        if (isNaN(v)) return;
        v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        slider.value = v;
    }
    cf252OvRecalculate();
}

/**
 * 오버레이 내 차폐층 추가
 */
function cf252OvAddShieldLayer() {
    const overlay = document.getElementById('cf252Overlay');
    if (!overlay || !overlay._data) return;

    const matSel = document.getElementById('cf252OvAddMat');
    const mat = matSel ? matSel.value : 'Water';

    overlay._data.shielding.push({ material: mat, thickness_cm: 10 });

    // 오버레이 재생성 (슬라이더 포함)
    const data = overlay._data;
    cf252CloseOverlay();
    cf252OpenOverlay(data.sources, data.shielding, data.limitKey);
}

/**
 * 오버레이 실시간 재계산
 */
function cf252OvRecalculate() {
    const overlay = document.getElementById('cf252Overlay');
    if (!overlay || !overlay._data) return;

    const data = overlay._data;
    const limit = CF252.LIMITS[data.limitKey] || CF252.LIMITS.MANAGED_INNER;

    // 슬라이더 값 읽기
    const actSlider = document.getElementById('cf252OvAct');
    const distSlider = document.getElementById('cf252OvDist');
    const act = actSlider ? parseFloat(actSlider.value) : data.sources[0].activity_mCi;
    const dist = distSlider ? parseFloat(distSlider.value) : data.sources[0].distance_cm;

    // 라벨 업데이트
    const actVal = document.getElementById('cf252OvActVal');
    const distVal = document.getElementById('cf252OvDistVal');
    if (actVal) actVal.textContent = act;
    if (distVal) distVal.textContent = dist;

    // 차폐 슬라이더 값 수집
    const currentShielding = [];
    data.shielding.forEach((layer, idx) => {
        const slider = document.getElementById(`cf252OvShield${idx}`);
        const thick = slider ? parseFloat(slider.value) : layer.thickness_cm;
        const valSpan = document.getElementById(`cf252OvShield${idx}Val`);
        if (valSpan) valSpan.textContent = thick;
        currentShielding.push({ material: layer.material, thickness_cm: thick });
    });

    // 선원 업데이트 (모든 선원의 비율 유지)
    const origAct = data.sources[0].activity_mCi;
    const origDist = data.sources[0].distance_cm;
    const updatedSources = data.sources.map(s => ({
        ...s,
        activity_mCi: s.activity_mCi === origAct ? act : s.activity_mCi * (act / origAct),
        distance_cm: s.distance_cm === origDist ? dist : s.distance_cm + (dist - origDist),
    }));

    // 재계산
    const result = cf252MultiSourceDoseRate(updatedSources, currentShielding);
    const pass = result.total_uSvh <= limit.value;

    // 도면 업데이트
    const diagramDiv = document.getElementById('cf252OvDiagram');
    if (diagramDiv) {
        diagramDiv.innerHTML = cf252GenerateSchematicSVG(
            updatedSources, currentShielding,
            { width: 900, height: 300 }
        );
    }

    // 결과 업데이트
    const resultDiv = document.getElementById('cf252OvResult');
    if (resultDiv) {
        const passClass = pass ? 'cf252-pass' : 'cf252-fail';
        const passIcon = pass ? '✓' : '✗';
        resultDiv.innerHTML = `
            <div class="cf252-ov-result-card ${passClass}">
                <div class="cf252-ov-result-verdict">${passIcon} ${pass ? 'PASS' : 'FAIL'} — ${limit.label}</div>
                <div class="cf252-ov-result-grid">
                    <div><span class="cf252-ov-rlabel">감마선</span><span class="cf252-ov-rval">${cf252Fmt(result.gamma_uSvh)} μSv/h</span></div>
                    <div><span class="cf252-ov-rlabel">중성자</span><span class="cf252-ov-rval">${cf252Fmt(result.neutron_uSvh)} μSv/h</span></div>
                    <div class="cf252-ov-result-total"><span class="cf252-ov-rlabel">총 선량률</span><span class="cf252-ov-rval">${cf252Fmt(result.total_uSvh)} μSv/h</span></div>
                </div>
                <div class="cf252-ov-result-bar">
                    <div class="cf252-ov-bar-fill" style="width:${Math.min(result.total_uSvh / limit.value * 100, 100)}%; background:${pass ? 'var(--hobis-green)' : 'var(--hobis-alert)'}"></div>
                    <div class="cf252-ov-bar-limit" style="left:100%"></div>
                </div>
                <div style="font-size:0.7rem; color:#5f7481; text-align:right;">${cf252Fmt(result.total_uSvh)} / ${limit.value} μSv/h (${(result.total_uSvh / limit.value * 100).toFixed(1)}%)</div>
            </div>`;
    }
}

function cf252CloseOverlay() {
    const overlay = document.getElementById('cf252Overlay');
    if (!overlay) return;
    if (overlay._keyHandler) document.removeEventListener('keydown', overlay._keyHandler);
    overlay.classList.remove('cf252-ov-visible');
    setTimeout(() => overlay.remove(), 200);
}

// === 3D 핫셀 뷰어 오버레이 (인터랙티브 구조 변형 + 실시간 선량평가) ===

function _cf252SliderWithInput(id, label, min, max, step, value, unit) {
    return `
        <div class="cf252-ov-slider-group">
            <label>${label}</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;" oninput="cf252Sync3DSlider('${id}')">
                <input type="number" id="${id}Num" min="${min}" max="${max}" step="${step}" value="${value}" style="width:60px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="cf252Sync3DInput('${id}')">
                <span style="font-size:10px; color:#5f7481; min-width:20px;">${unit}</span>
            </div>
        </div>`;
}

function cf252Sync3DSlider(id) {
    const slider = document.getElementById(id);
    const numInput = document.getElementById(id + 'Num');
    if (slider && numInput) numInput.value = slider.value;
    cf252Ov3DRecalculate();
}

function cf252Sync3DInput(id) {
    const slider = document.getElementById(id);
    const numInput = document.getElementById(id + 'Num');
    if (slider && numInput) {
        let v = parseFloat(numInput.value);
        if (isNaN(v)) return;
        v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        slider.value = v;
    }
    cf252Ov3DRecalculate();
}

function cf252Open3DOverlay() {
    let ov = document.getElementById('cf252-3d-overlay');
    if (ov) ov.remove();

    ov = document.createElement('div');
    ov.id = 'cf252-3d-overlay';
    ov.className = 'cf252-overlay';

    const controlsHTML = `
        <div class="cf252-3d-controls">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-family:'Orbitron',sans-serif; color:var(--hobis-warn); font-size:0.85rem;">RT 수조 핫셀 설계</span>
                <button onclick="cf252Close3DOverlay()" style="background:none; color:var(--hobis-alert); border:1px solid var(--hobis-alert); padding:2px 8px; cursor:pointer; font-size:12px;">✕</button>
            </div>

            <h3 style="font-size:0.75rem; color:var(--hobis-cyan); margin:10px 0 6px; border-bottom:1px solid var(--hobis-border); padding-bottom:3px;">차폐 구조</h3>
            ${_cf252SliderWithInput('cf252Ov3D_waterT', '수조 물 두께', 5, 60, 1, 30, 'cm')}
            ${_cf252SliderWithInput('cf252Ov3D_leadT', '납판 두께', 0, 20, 0.5, 5, 'cm')}
            ${_cf252SliderWithInput('cf252Ov3D_leadGlassT', '납유리 두께 (창)', 0, 20, 0.5, 5, 'cm')}

            <h3 style="font-size:0.75rem; color:var(--hobis-cyan); margin:10px 0 6px; border-bottom:1px solid var(--hobis-border); padding-bottom:3px;">내부 치수</h3>
            ${_cf252SliderWithInput('cf252Ov3D_innerW', '폭', 50, 200, 5, 100, 'cm')}
            ${_cf252SliderWithInput('cf252Ov3D_innerD', '깊이', 50, 200, 5, 80, 'cm')}
            ${_cf252SliderWithInput('cf252Ov3D_innerH', '높이', 50, 200, 5, 100, 'cm')}

            <h3 style="font-size:0.75rem; color:var(--hobis-cyan); margin:10px 0 6px; border-bottom:1px solid var(--hobis-border); padding-bottom:3px;">선원</h3>
            <div class="cf252-ov-slider-group">
                <label>방사능</label>
                <select id="cf252Ov3D_act" style="width:100%; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:4px; font-size:11px;" onchange="cf252Ov3DRecalculate()">
                    <option value="54">54 mCi (STC-100 × 1)</option>
                    <option value="2700" selected>2,700 mCi (2.7 Ci)</option>
                </select>
            </div>

            <h3 style="font-size:0.75rem; color:var(--hobis-cyan); margin:10px 0 6px; border-bottom:1px solid var(--hobis-border); padding-bottom:3px;">실시간 선량 평가</h3>
            <div style="font-size:10px; color:#5f7481; margin-bottom:6px;">관리구역 내부 ≤ 25 μSv/h</div>
            <div id="cf252Ov3D_doseResult"></div>

            <h3 style="font-size:0.75rem; color:var(--hobis-cyan); margin:10px 0 6px; border-bottom:1px solid var(--hobis-border); padding-bottom:3px;">구조 제원</h3>
            <div id="cf252Ov3D_specs" style="font-size:11px;"></div>
        </div>`;

    ov.innerHTML = `
        <div class="cf252-ov-content cf252-3d-enhanced">
            <div class="cf252-3d-viewer">
                <iframe id="cf252-3d-iframe" src="cf252-hotcell-3d.html" style="width:100%; height:100%; border:none;"></iframe>
            </div>
            ${controlsHTML}
        </div>`;

    document.body.appendChild(ov);

    // 배경 클릭 닫기
    ov.addEventListener('click', (e) => { if (e.target === ov) cf252Close3DOverlay(); });

    // ESC 닫기
    ov._keyHandler = (e) => { if (e.key === 'Escape') cf252Close3DOverlay(); };
    document.addEventListener('keydown', ov._keyHandler);

    // postMessage 핸들러
    ov._msgHandler = (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'ready') {
            // iframe 로드 완료 → embedded mode + 초기 계산
            const iframe = document.getElementById('cf252-3d-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'setEmbeddedMode' }, '*');
            }
            cf252Ov3DRecalculate();
        }
    };
    window.addEventListener('message', ov._msgHandler);

    // 초기 계산 (iframe이 아직 로드되지 않았을 수 있으므로 대기)
    setTimeout(() => cf252Ov3DRecalculate(), 100);

    // 애니메이션
    setTimeout(() => ov.classList.add('cf252-ov-visible'), 30);
}

function cf252Ov3DRecalculate() {
    const _v = (id, def) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? def : v; };
    const waterT = _v('cf252Ov3D_waterT', 30);
    const leadT = _v('cf252Ov3D_leadT', 5);
    const leadGlassT = _v('cf252Ov3D_leadGlassT', 5);
    const innerW = _v('cf252Ov3D_innerW', 100);
    const innerD = _v('cf252Ov3D_innerD', 80);
    const innerH = _v('cf252Ov3D_innerH', 100);
    const act = _v('cf252Ov3D_act', 2700);

    // iframe에 파라미터 전송
    const iframe = document.getElementById('cf252-3d-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'updateParams',
            params: { innerW, innerD, innerH, waterT, leadT, leadGlassT }
        }, '*');
    }

    // 3개 평가 시나리오 계산 (cf252.js 엔진 사용)
    const scenarios = [
        {
            name: '벽 (물+납)',
            dist: innerW / 2 + waterT + leadT + 30,
            shields: [
                { material: 'Water', thickness_cm: waterT },
                { material: 'Pb', thickness_cm: leadT },
            ],
        },
        {
            name: '창 (물+납유리)',
            dist: innerD / 2 + waterT + leadGlassT + 30,
            shields: [
                { material: 'Water', thickness_cm: waterT },
                { material: 'Pb', thickness_cm: leadGlassT },
            ],
        },
        {
            name: '천장 (물+납)',
            dist: 20 + innerH + waterT + leadT + 30,
            shields: [
                { material: 'Water', thickness_cm: waterT },
                { material: 'Pb', thickness_cm: leadT },
            ],
        },
    ];

    const limit = 25; // μSv/h

    let tableHTML = '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
    tableHTML += '<tr style="border-bottom:1px solid var(--hobis-border);"><th style="text-align:left; padding:3px; color:var(--hobis-cyan);">위치</th><th style="text-align:right; padding:3px; color:var(--hobis-cyan);">γ</th><th style="text-align:right; padding:3px; color:var(--hobis-cyan);">n</th><th style="text-align:right; padding:3px; color:var(--hobis-cyan);">합계</th><th style="padding:3px;"></th></tr>';

    scenarios.forEach(s => {
        const g = cf252GammaDoseRate(act, s.dist, s.shields) * 1000; // mSv/h → μSv/h
        const n = cf252NeutronDoseRate(act, s.dist, s.shields) * 1000;
        const total = g + n;
        const pass = total <= limit;
        const cls = pass ? 'color:var(--hobis-green)' : 'color:var(--hobis-alert)';
        const icon = pass ? '✓' : '✗';
        tableHTML += `<tr style="border-bottom:1px solid #1a2530;">
            <td style="padding:3px;">${s.name}</td>
            <td style="text-align:right; padding:3px; font-family:monospace;">${cf252Fmt(g)}</td>
            <td style="text-align:right; padding:3px; font-family:monospace;">${cf252Fmt(n)}</td>
            <td style="text-align:right; padding:3px; font-family:monospace; font-weight:bold; ${cls}">${cf252Fmt(total)}</td>
            <td style="padding:3px; ${cls}; font-weight:bold;">${icon}</td>
        </tr>`;
    });
    tableHTML += '</table>';

    const doseDiv = document.getElementById('cf252Ov3D_doseResult');
    if (doseDiv) doseDiv.innerHTML = tableHTML;

    // 구조 제원 업데이트
    const outerW = innerW + (waterT + leadT) * 2;
    const outerD = innerD + waterT + leadT + waterT + leadGlassT;
    const outerH = innerH + waterT + leadT + 10; // baseH=10
    const wallVol = 2 * (innerW * innerH * waterT) + 2 * (innerD * innerH * waterT) + (innerW * innerD * waterT);
    const waterKg = Math.round(wallVol / 1000);
    const leadVol = 2 * (outerW * innerH * leadT) + 2 * ((innerD + waterT * 2) * innerH * leadT) + (outerW * outerD * leadT) + (innerW * innerD * leadT);
    const leadKg = Math.round(leadVol * 11.34 / 1000);

    const specsDiv = document.getElementById('cf252Ov3D_specs');
    if (specsDiv) {
        specsDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dotted #1a2530;"><span style="color:#5f7481;">외부 치수</span><span style="color:var(--hobis-green); font-family:monospace;">${outerW} × ${outerD} × ${outerH} cm</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dotted #1a2530;"><span style="color:#5f7481;">수조 무게 (물)</span><span style="color:var(--hobis-green); font-family:monospace;">≈ ${waterKg.toLocaleString()} kg</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dotted #1a2530;"><span style="color:#5f7481;">납판 무게</span><span style="color:var(--hobis-green); font-family:monospace;">≈ ${leadKg.toLocaleString()} kg</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 0;"><span style="color:#5f7481;">총 중량 (구조제외)</span><span style="color:var(--hobis-warn); font-family:monospace;">≈ ${(waterKg + leadKg).toLocaleString()} kg</span></div>`;
    }
}

function cf252Close3DOverlay() {
    const ov = document.getElementById('cf252-3d-overlay');
    if (!ov) return;
    if (ov._keyHandler) document.removeEventListener('keydown', ov._keyHandler);
    if (ov._msgHandler) window.removeEventListener('message', ov._msgHandler);
    ov.classList.remove('cf252-ov-visible');
    setTimeout(() => ov.remove(), 200);
}

// === 현재 입력 상태에서 sources/shielding 수집 (오버레이 열기용) ===
function cf252GetCurrentInputs() {
    const sources = [];
    document.querySelectorAll('.cf252-source-row').forEach(row => {
        const act = parseFloat(row.querySelector('.cf252-src-act')?.value) || 0;
        const dist = parseFloat(row.querySelector('.cf252-src-dist')?.value) || 100;
        const container = row.querySelector('.cf252-src-container')?.value || null;
        if (act > 0) sources.push({ activity_mCi: act, distance_cm: dist, container: container });
    });

    const shielding = [];
    document.querySelectorAll('.cf252-shield-row').forEach(row => {
        const mat = row.querySelector('.cf252-shield-mat')?.value;
        const thick = parseFloat(row.querySelector('.cf252-shield-thick')?.value) || 0;
        if (thick > 0) shielding.push({ material: mat, thickness_cm: thick });
    });

    const criteriaKey = document.getElementById('cf252Criteria')?.value || 'MANAGED_INNER';

    return { sources, shielding, criteriaKey };
}
