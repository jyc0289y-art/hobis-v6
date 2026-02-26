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
            <div style="margin:15px 0;"><div class="header" style="border:none;"><span>LAYERS</span> <button class="btn-outline" onclick="addLayerRow()">+ ADD</button></div><div id="layerList"></div></div>
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
                <div><label>Material</label><select id="targetMat"><option value="Lead">Lead</option><option value="Concrete">Concrete</option><option value="Steel">Steel</option><option value="Tungsten">W</option><option value="DU">DU</option></select></div>
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

function addLayerRow() {
    const div = document.createElement('div');
    div.className = 'list-item shield-layer';
    div.innerHTML = `<div class="del-btn" onclick="this.parentElement.remove()">×</div><div class="grid-row" style="margin:0; gap:5px;"><div style="flex:1"><select class="mat-select"><option value="Lead">Lead</option><option value="Concrete">Concrete</option><option value="Steel">Steel</option><option value="Tungsten">W</option><option value="DU">DU</option></select></div><div style="flex:1"><input type="number" class="thk-input" placeholder="mm"></div></div>`;
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
