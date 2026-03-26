// --- HOBIS CALC UI MODULE ---
// Calculator input rendering, source/layer row management, unit helpers

function renderInputs() {
    const area = document.getElementById('inputArea');
    area.innerHTML = "";

    // 1. DECAY FORWARD
    if (currentSubMode === 'decay_forward') {
        area.innerHTML = `
            <div style="margin-bottom:15px; border-bottom:1px dashed #3c4c56; padding-bottom:10px;">
                <div class="header" style="border:none; margin:0;"><span>SOURCES</span> <button class="btn-outline" onclick="addSourceRow()">+ ADD</button></div>
                <div id="sourceList"></div>
            </div>
            <div class="grid-row"><div><label>Start</label><input type="date" id="dateStart"></div><div><label>Eval</label><input type="date" id="dateEnd"></div></div>
            <div class="grid-row"><div><label>Result Unit</label><select id="outUnit">${getUnitOpts('act')}</select></div></div>`;
        addSourceRow();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateStart').value = today;
        document.getElementById('dateEnd').value = today;
    }
    // 2. DECAY REVERSE
    else if (currentSubMode === 'decay_reverse') {
        area.innerHTML = `
            <div class="grid-row"><div><label>Nuclide</label><select id="nucSelect" onchange="updateRowSpec(this)">${nucOptionsHTML}</select><div class="spec-mini" id="specDisplay">-</div></div><div><label>Initial (A0)</label><div class="input-group"><input type="number" id="inA0"><select id="unitA0">${getUnitOpts('act')}</select></div></div></div>
            <div class="grid-row"><div><label>Target (At)</label><input type="number" id="inTargetAct"></div><div><label>Start</label><input type="date" id="dateStart"></div></div>`;
        document.getElementById('dateStart').value = new Date().toISOString().split('T')[0];
        updateRowSpec(document.getElementById('nucSelect'));
    }
    // 3. SHIELD FORWARD
    else if (currentSubMode === 'shield_forward') {
        area.innerHTML = `
            <div style="margin-bottom:15px;">
                 <div class="grid-row" style="margin-bottom:0;">
                    <div>
                        <label>Input Mode</label>
                        <select id="inputType" onchange="updateShieldFwdInputUnit()">
                            <option value="act">Based on Activity</option>
                            <option value="dose">Based on Measured Dose</option>
                        </select>
                    </div>
                    <div class="header" style="border:none; margin:0; justify-content:flex-end;"><span>SOURCES</span> <button class="btn-outline" onclick="addSourceRow()">+ ADD</button></div>
                </div>
                <div id="sourceList"></div>
            </div>
            <div class="grid-row"><div><label>Distance(m)</label><input type="number" id="inDist" value="1"></div></div>
            <div style="margin:15px 0;"><div class="header" style="border:none;"><span>LAYERS</span> <button class="btn-outline" onclick="addLayerRow()">+ ADD</button></div><div style="margin-bottom:8px;"><select id="shieldPresetSelect" onchange="loadShieldPreset()" style="font-size:0.75rem; padding:3px 6px; background:var(--hobis-panel); color:var(--hobis-cyan); border:1px solid var(--hobis-border);">${SHIELD_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div id="layerList"></div></div>
            <div class="grid-row"><div><label>Out Type</label><select id="outType" onchange="updateOutUnit()"><option value="dose">Dose Rate</option><option value="act">Eff. Activity</option></select></div><div><label>Out Unit</label><select id="outUnit">${getUnitOpts('dose')}</select></div></div>`;
        addSourceRow();
        addLayerRow();
    }
    // 4. SHIELD REVERSE
    else {
        area.innerHTML = `
            <div class="grid-row">
                <div><label>Nuclide</label><select id="nucSelect" onchange="updateRowSpec(this)">${nucOptionsHTML}</select><div class="spec-mini" id="specDisplay">-</div></div>
                <div>
                    <label>Input Mode</label>
                    <select id="inputType" onchange="updateReverseInUnit()">
                        <option value="act">Activity</option>
                        <option value="dose">Dose Rate</option>
                    </select>
                </div>
            </div>
            <div class="grid-row">
                <div><label>Input Value</label><div class="input-group"><input type="number" id="inVal"><select id="inUnit">${getUnitOpts('act')}</select></div></div>
                <div><label>Dist (m)</label><input type="number" id="inDist" value="1"></div>
            </div>
            <div class="grid-row">
                <div><label>Target Mode</label><select id="targetType" onchange="updateReverseTargetUnit()"><option value="dose">Dose Rate</option><option value="act">Activity</option></select></div>
                <div><label>Target Val</label><div class="input-group"><input type="number" id="targetVal"><select id="targetUnit">${getUnitOpts('dose')}</select></div></div>
            </div>
            <div class="grid-row">
                <div><label>Material</label><select id="targetMat">${SHIELD_MAT_OPTIONS}</select></div>
            </div>`;
        updateRowSpec(document.getElementById('nucSelect'));
    }
}

// --- ROW & UNIT HELPERS ---
function addSourceRow() {
    let unitOpts = getUnitOpts('act');
    if (currentSubMode === 'shield_forward') {
        const inType = document.getElementById('inputType') ? document.getElementById('inputType').value : 'act';
        unitOpts = getUnitOpts(inType);
    }
    const div = document.createElement('div');
    div.className = 'list-item source-row';
    div.innerHTML = `<div class="del-btn" onclick="this.parentElement.remove()">×</div><div class="grid-row" style="margin:0; gap:5px;"><div style="flex:1"><select class="src-select" onchange="updateRowSpec(this)">${nucOptionsHTML}</select></div><div style="flex:1"><div class="input-group"><input type="number" class="src-val"><select class="src-unit">${unitOpts}</select></div></div></div><div class="spec-mini">-</div>`;
    document.getElementById('sourceList').appendChild(div);
    updateRowSpec(div.querySelector('.src-select'));
}

const SHIELD_MAT_OPTIONS = '<option value="Lead">Lead</option><option value="LeadGlass">Lead Glass</option><option value="Concrete">Concrete</option><option value="Steel">Steel</option><option value="Aluminum">Aluminum</option><option value="Water">Water</option><option value="Polyethylene">Polyethylene</option><option value="Paraffin">Paraffin</option><option value="Tungsten">W</option><option value="DU">DU</option>';

// 차폐 프리셋 (다층 구성)
const SHIELD_PRESETS = [
    { id: '', name: '-- 프리셋 선택 --', layers: [] },
    { id: 'water_pb', name: '물 + 납 (n+γ)', layers: [{ m: 'Water', t: 300 }, { m: 'Lead', t: 50 }], ref: 'Cf-252 복합차폐 기본구성' },
    { id: 'paraffin_pb', name: '파라핀 + 납 (n+γ)', layers: [{ m: 'Paraffin', t: 80 }, { m: 'Lead', t: 50 }], ref: '파라핀(n감속)+납(γ차폐)' },
    { id: 'pe_pb', name: '폴리에틸렌 + 납 (n+γ)', layers: [{ m: 'Polyethylene', t: 80 }, { m: 'Lead', t: 50 }], ref: 'PE(n감속)+납(γ차폐), Alizadeh Rahvar 2020' },
    { id: 'concrete', name: '콘크리트 단일', layers: [{ m: 'Concrete', t: 1200 }], ref: '콘크리트 벽체' },
    { id: 'pb_only', name: '납 단일 (γ)', layers: [{ m: 'Lead', t: 50 }], ref: '감마선 전용' },
];

function loadShieldPreset() {
    const sel = document.getElementById('shieldPresetSelect');
    if (!sel || !sel.value) return;
    const preset = SHIELD_PRESETS.find(p => p.id === sel.value);
    if (!preset || preset.layers.length === 0) return;

    const layerList = document.getElementById('layerList');
    layerList.innerHTML = '';
    preset.layers.forEach(l => {
        addLayerRow(l.m, l.t);
    });
}

function addLayerRow(defaultMat, defaultThk) {
    const div = document.createElement('div');
    div.className = 'list-item shield-layer';
    let matOpts = SHIELD_MAT_OPTIONS;
    if (defaultMat) matOpts = matOpts.replace(`value="${defaultMat}"`, `value="${defaultMat}" selected`);
    div.innerHTML = `<div class="del-btn" onclick="this.parentElement.remove()">×</div><div class="grid-row" style="margin:0; gap:5px;"><div style="flex:1"><select class="mat-select">${matOpts}</select></div><div style="flex:1"><input type="number" class="thk-input" placeholder="mm" ${defaultThk ? `value="${defaultThk}"` : ''}></div></div>`;
    document.getElementById('layerList').appendChild(div);
}

function updateOutUnit() {
    document.getElementById('outUnit').innerHTML = getUnitOpts(document.getElementById('outType').value);
}

function updateReverseInUnit() {
    document.getElementById('inUnit').innerHTML = getUnitOpts(document.getElementById('inputType').value);
}

function updateReverseTargetUnit() {
    document.getElementById('targetUnit').innerHTML = getUnitOpts(document.getElementById('targetType').value);
}

function updateShieldFwdInputUnit() {
    const inType = document.getElementById('inputType').value;
    const newOpts = getUnitOpts(inType);
    document.querySelectorAll('.src-unit').forEach(sel => { sel.innerHTML = newOpts; });
}
