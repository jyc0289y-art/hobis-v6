// --- HOBIS Cf-252 UI MODULE ---
// Cf-252 선량평가 계산기 UI 렌더링 및 이벤트 핸들링

let cf252CurrentMode = 'dose'; // 'dose' | 'activation'

function cf252SetMode(mode, el) {
    if (cf252CurrentMode === mode) return;
    cf252CurrentMode = mode;
    el.parentElement.querySelectorAll('.mode-opt').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    // DOM 보존: 모드별 컨테이너를 show/hide
    const doseWrap = document.getElementById('cf252DoseWrap');
    const actWrap = document.getElementById('cf252ActWrap');
    const doseResult = document.getElementById('cf252DoseResultWrap');
    const actResult = document.getElementById('cf252ActResultWrap');
    if (mode === 'dose') {
        if (doseWrap) doseWrap.classList.remove('hidden');
        if (actWrap) actWrap.classList.add('hidden');
        if (doseResult) doseResult.classList.remove('hidden');
        if (actResult) actResult.classList.add('hidden');
    } else {
        if (doseWrap) doseWrap.classList.add('hidden');
        if (actWrap) actWrap.classList.remove('hidden');
        if (doseResult) doseResult.classList.add('hidden');
        if (actResult) actResult.classList.remove('hidden');
    }
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
                            <input type="number" id="cf252ActDist" value="5" step="0.1">
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
    const actResultWrap = document.getElementById('cf252ActResultWrap');
    state.doseResultHTML = doseResultWrap ? doseResultWrap.innerHTML : '';
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
        if ((state.mode === 'dose' && o.textContent.trim().includes('선량')) ||
            (state.mode === 'activation' && o.textContent.trim().includes('방사화'))) {
            o.classList.add('active');
        }
    });

    // Wrap 토글
    const doseWrap = document.getElementById('cf252DoseWrap');
    const actWrap = document.getElementById('cf252ActWrap');
    if (doseWrap) doseWrap.classList.toggle('hidden', state.mode !== 'dose');
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
        const actResultWrap = document.getElementById('cf252ActResultWrap');
        if (doseResultWrap && state.doseResultHTML) doseResultWrap.innerHTML = state.doseResultHTML;
        if (actResultWrap && state.actResultHTML) actResultWrap.innerHTML = state.actResultHTML;
        // 결과 표시
        document.getElementById('cf252ReportEmpty').classList.add('hidden');
        document.getElementById('cf252ResultBox').classList.remove('hidden');
        // 모드별 결과 wrap 토글
        if (doseResultWrap) doseResultWrap.classList.toggle('hidden', state.mode !== 'dose');
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

        <div class="cf252-constants-section">
            <div class="header" style="border:none; font-size:0.85rem;">APPLIED CONSTANTS</div>
            <div class="spec-report">
                <div class="spec-row"><span class="spec-key">Γ_γ (감마)</span><span class="spec-val">${CF252.GAMMA_CONST_MSV.toFixed(3)} mSv·cm²/(mCi·h)</span></div>
                <div class="spec-row"><span class="spec-key">Γ_n (중성자)</span><span class="spec-val">${CF252.NEUTRON_CONST_MSV.toFixed(3)} mSv·cm²/(mCi·h)</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Pb</span><span class="spec-val">${CF252.HVL_GAMMA.Pb} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL γ Conc</span><span class="spec-val">${CF252.HVL_GAMMA.Concrete} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n PE</span><span class="spec-val">${CF252.HVL_NEUTRON.PE} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Pb</span><span class="spec-val">${CF252.HVL_NEUTRON.Pb} cm</span></div>
                <div class="spec-row"><span class="spec-key">HVL n Conc</span><span class="spec-val">${CF252.HVL_NEUTRON.Concrete} cm</span></div>
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
