// --- HOBIS CALCULATOR ENGINE ---
// Main calculate() function for all 4 modes

// HVL 소스 선택: QSA(broad-beam) vs NIST(narrow-beam)
function getHVL(nuc, mat) {
    const sel = document.getElementById('hvlSource');
    const useNist = sel && sel.value === 'nist';
    if (useNist && nuc.hvl_nist && nuc.hvl_nist[mat] !== undefined) {
        return nuc.hvl_nist[mat];
    }
    return (nuc.hvl && nuc.hvl[mat]) ? nuc.hvl[mat] : 0;
}

function getHVLSourceLabel() {
    const sel = document.getElementById('hvlSource');
    return (sel && sel.value === 'nist') ? 'NIST XCOM (narrow-beam)' : 'QSA MAN-027 (broad-beam)';
}

function calculate() {
    document.getElementById('reportEmpty').classList.add('hidden');
    document.getElementById('resultBox').classList.remove('hidden');

    let entry = { mode: "", timestamp: new Date().toLocaleString(), totalInputVal: "", inputUnit: "", resultVal: "", resultUnit: "" };
    function getReadyNuc(id) {
        if (id !== "MANUAL") return getNucData(id);
        const h = prompt("HL(d)"); const g = prompt("Gamma"); const l = prompt("Pb HVL");
        if (!h) return null;
        return { id: "MANUAL", hl: parseFloat(h), unit: 'd', gamma: parseFloat(g), hvl: { 'Lead': parseFloat(l) } };
    }

    if (currentSubMode === 'decay_forward') {
        entry.mode = "DECAY_FWD";
        const outUnit = document.getElementById('outUnit').value;
        const sDate = document.getElementById('dateStart').value;
        const days = (new Date(document.getElementById('dateEnd').value) - new Date(sDate)) / 86400000;
        let total = 0; let srcs = [];
        document.querySelectorAll('.source-row').forEach(r => {
            const n = getReadyNuc(r.querySelector('.src-select').value);
            const v = parseFloat(r.querySelector('.src-val').value) || 0;
            if (n && v > 0) {
                const A0 = v * UNIT_ACT[r.querySelector('.src-unit').value];
                total += A0 * Math.pow(0.5, days / getHLDays(n));
                srcs.push({ n: n, A0: A0 });
            }
        });
        const res = total * (1 / UNIT_ACT[outUnit]);
        entry.resultVal = res.toExponential(4); entry.resultUnit = outUnit;
        showResult(`${entry.resultVal} ${outUnit}`, `Elapsed: ${days.toFixed(1)}d`);
        addToLog(entry);

        // Spec Report
        let specHTML = "";
        srcs.forEach(s => specHTML += `<div class="spec-row"><span class="spec-key">${s.n.id}</span> <span class="spec-val">HL: ${s.n.hl}${s.n.unit}</span></div>`);
        let decayInteractiveHTML = '';
        try {
            if (typeof decayOpenOverlay === 'function') {
                decayInteractiveHTML = `<div style="margin-top:10px;"><button class="btn-outline" style="color:var(--hobis-cyan); border-color:var(--hobis-cyan); font-size:0.75rem;" onclick="decayOpenOverlay()">⤢ INTERACTIVE VIEW</button></div>`;
            }
        } catch(e) { console.warn('Decay overlay error:', e); }
        document.getElementById('specReportBox').innerHTML = `<div class="spec-report">${specHTML}</div>` + decayInteractiveHTML;

        const L = [], D = []; let range = days > 0 ? days * 1.2 : 365;
        for (let i = 0; i <= 100; i++) {
            let t = i * (range / 100); let sum = 0;
            srcs.forEach(s => sum += s.A0 * Math.pow(0.5, t / getHLDays(s.n)));
            L.push(t.toFixed(1)); D.push(sum * (1 / UNIT_ACT[outUnit]));
        }
        drawChart(L, D, "Activity", "Days", days, res, sDate);
    }
    else if (currentSubMode === 'decay_reverse') {
        entry.mode = "DECAY_REV";
        const sDate = document.getElementById('dateStart').value;
        const n = getReadyNuc(document.getElementById('nucSelect').value);
        const A0 = parseFloat(document.getElementById('inA0').value);
        const At = parseFloat(document.getElementById('inTargetAct').value);
        if (n && A0 && At) {
            const days = getHLDays(n) * (Math.log(At / A0) / Math.log(0.5));
            const dDate = new Date(new Date(sDate).getTime() + days * 86400000);
            const dDateStr = dDate.toISOString().split('T')[0];
            entry.resultVal = dDateStr; entry.resultUnit = "(Date)";
            showResult(`${days.toFixed(1)} Days`, `Reach: ${dDateStr}`);
            addToLog(entry);

            // Spec Report
            document.getElementById('specReportBox').innerHTML = `<div class="spec-report"><div class="spec-row"><span class="spec-key">${n.id}</span> <span class="spec-val">HL: ${n.hl}${n.unit}</span></div></div>`;

            const L = [], D = [];
            for (let i = 0; i <= 100; i++) { let t = i * (days * 1.2 / 100); L.push(t.toFixed(1)); D.push(A0 * Math.pow(0.5, t / getHLDays(n))); }
            drawChart(L, D, "Decay", "Days", days, At, sDate);
        }
    }
    else if (currentSubMode === 'shield_forward') {
        entry.mode = "SHIELD_FWD";
        const dist = parseFloat(document.getElementById('inDist').value) || 1;
        const inType = document.getElementById('inputType').value;
        const ot = document.getElementById('outType').value;
        const ou = document.getElementById('outUnit').value;
        let srcs = [], lays = [], reportSpecHTML = "";

        document.querySelectorAll('.source-row').forEach(r => {
            const n = getReadyNuc(r.querySelector('.src-select').value);
            const v = parseFloat(r.querySelector('.src-val').value) || 0;
            if (n && v > 0) {
                let val = 0;
                if (inType === 'act') val = v * UNIT_ACT[r.querySelector('.src-unit').value];
                else val = v * UNIT_DOSE[r.querySelector('.src-unit').value];
                srcs.push({ n: n, val: val });
                reportSpecHTML += `<div class="spec-row"><span class="spec-key">${n.id}</span> <span class="spec-val">Γ=${n.gamma} mSv·m²/h·Ci</span></div>`;
            }
        });
        document.querySelectorAll('.shield-layer').forEach(r => {
            const m = r.querySelector('.mat-select').value;
            const t = parseFloat(r.querySelector('.thk-input').value) || 0;
            lays.push({ m: m, t: t });
        });

        const hvlSrcLabel = getHVLSourceLabel();
        let totalRes = 0;
        srcs.forEach(s => {
            let trans = 1.0;
            lays.forEach(l => {
                let h = getHVL(s.n, l.m);
                if (h > 0) trans *= Math.pow(0.5, l.t / h);
                reportSpecHTML += `<div class="spec-row"><span class="spec-key">${l.m} HVL (${s.n.id})</span> <span class="spec-val">${h}mm</span></div>`;
            });
            if (inType === 'act') {
                if (ot === 'dose') totalRes += s.n.gamma * s.val * (1 / (dist * dist)) * trans;
                else totalRes += s.val * trans;
            } else {
                let d = s.val * (1 / (dist * dist)) * trans;
                if (ot === 'dose') totalRes += d; else totalRes += d / s.n.gamma;
            }
        });

        const finalVal = totalRes * (ot === 'dose' ? (1 / UNIT_DOSE[ou]) : (1 / UNIT_ACT[ou]));
        entry.resultVal = finalVal.toExponential(4); entry.resultUnit = ou;
        showResult(`${entry.resultVal} ${ou}`, ot);
        addToLog(entry);

        // Spec Report + SVG Diagram + Interactive button
        let shieldDiagramHTML = '';
        try {
            if (typeof shieldGenerateSVG === 'function' && lays.length > 0) {
                const svgSrcs = srcs.map(s => ({ nuclide: s.n.id, distance_m: dist, value: s.val }));
                const svgLays = lays.map(l => ({ material: l.m, thickness_mm: l.t }));
                shieldDiagramHTML = `
                    <div id="shieldDiagramSection" style="margin-top:12px;">
                        <div style="font-size:0.8rem; font-weight:bold; color:var(--hobis-cyan); margin-bottom:5px;">SHIELDING DIAGRAM
                            <button class="btn-outline" style="margin-left:8px; font-size:0.7rem; padding:2px 8px; color:var(--hobis-cyan); border-color:var(--hobis-cyan);" onclick="shieldOpenOverlay()">⤢ EXPAND</button>
                        </div>
                        <div class="cf252-diagram-thumb" onclick="shieldOpenOverlay()" style="cursor:pointer;" title="클릭하여 인터랙티브 뷰 열기">
                            ${shieldGenerateSVG(svgSrcs, svgLays, {width: 600, height: 200, compact: true})}
                        </div>
                    </div>`;
            }
        } catch(e) { console.warn('SVG diagram error:', e); }
        // HVL 출처 + 검증 근거 정보
        const hvlRefDetail = {
            'Lead': { src: 'QSA MAN-027 Table 7', method: 'Manufacturer broad-beam', verify: 'NIST XCOM Cs-137 narrow-beam 5.5mm vs QSA 6.4mm (-14%, buildup factor 차이)' },
            'Steel': { src: 'QSA MAN-027 Table 7', method: 'Manufacturer broad-beam', verify: 'NDT Industry standard' },
            'Concrete': { src: 'QSA MAN-027 Table 7', method: 'Manufacturer broad-beam', verify: 'NDT Industry standard' },
            'Tungsten': { src: 'QSA MAN-027 Table 7', method: 'Manufacturer broad-beam', verify: '' },
            'DU': { src: 'QSA MAN-027 Table 7', method: 'Manufacturer broad-beam', verify: '' },
            'LeadGlass': { src: 'Representative', method: 'ρ≈3.3 g/cm³, Pb 30wt%', verify: '' },
            'Water': { src: 'NIST XCOM', method: 'HVL=ln2/(μ/ρ×ρ), narrow-beam', verify: 'Cs-137 NIST 80mm ≈ 코드값 87mm (broad-beam 보정)' },
            'Polyethylene': { src: 'NIST XCOM', method: 'HVL=ln2/(μ/ρ×ρ), ρ=0.94', verify: 'Water 대비 밀도비 스케일링 확인' },
            'Paraffin': { src: 'NIST XCOM', method: 'HVL=ln2/(μ/ρ×ρ), ρ=0.93', verify: 'PE와 유사 조성(탄화수소)' },
            'Aluminum': { src: 'NIST XCOM', method: 'HVL=ln2/(μ/ρ×ρ), ρ=2.699', verify: 'Nuclear-Power.com 500keV Al HVL 3.05cm 일치' },
        };
        const usedMats = [...new Set(lays.map(l => l.m))];
        let hvlRefRows = usedMats.map(m => {
            const r = hvlRefDetail[m] || { src: 'N/A', method: '', verify: '' };
            return `<div class="spec-row" style="font-size:0.65rem;"><span class="spec-key" style="color:#5f7481;">${m}</span> <span class="spec-val" style="color:#5f7481;">${r.src} (${r.method})</span></div>`;
        }).join('');
        const hvlRefHTML = `<div style="margin-top:8px; padding:6px 8px; border-top:1px dashed var(--hobis-border);">
            <div style="font-size:0.7rem; font-weight:bold; color:#5f7481; margin-bottom:3px;">HVL REFERENCE — <span style="color:var(--hobis-cyan);">${hvlSrcLabel}</span></div>
            ${hvlRefRows}
            <div style="font-size:0.6rem; color:#4a5a64; margin-top:4px;">QSA: broad-beam(빌드업 포함, 보수적) | NIST: narrow-beam(이론값, HVL=ln2/(μ/ρ×ρ))</div>
        </div>`;
        document.getElementById('specReportBox').innerHTML = `<div class="spec-report">${reportSpecHTML}</div>` + hvlRefHTML + shieldDiagramHTML;

        // Chart
        if (lays.length) {
            const L = [], D = [], pm = lays[0].m, pt = lays[0].t;
            let maxThk = pt * 2 || 50;
            const yAxisLabel = ot === 'dose' ? `Dose Rate (${ou})` : `Activity (${ou})`;
            for (let i = 0; i <= 100; i++) {
                let x = i * (maxThk / 100), sum = 0;
                L.push(x.toFixed(1));
                srcs.forEach(s => {
                    let tr = 1.0, h1 = getHVL(s.n, pm);
                    if (h1 > 0) tr *= Math.pow(0.5, x / h1);
                    for (let k = 1; k < lays.length; k++) {
                        let l = lays[k], h = getHVL(s.n, l.m);
                        if (h > 0) tr *= Math.pow(0.5, l.t / h);
                    }
                    if (inType === 'act') {
                        if (ot === 'dose') sum += s.n.gamma * s.val * (1 / (dist * dist)) * tr;
                        else sum += s.val * tr;
                    } else {
                        let d = s.val * (1 / (dist * dist)) * tr;
                        if (ot === 'dose') sum += d; else sum += d / s.n.gamma;
                    }
                });
                D.push(sum * (ot === 'dose' ? (1 / UNIT_DOSE[ou]) : (1 / UNIT_ACT[ou])));
            }
            drawChart(L, D, yAxisLabel, "Thickness (mm)", pt, finalVal);
        }
    }
    else { // Shield Reverse
        entry.mode = "SHIELD_REV";
        const n = getReadyNuc(document.getElementById('nucSelect').value);
        const iv = parseFloat(document.getElementById('inVal').value);
        const target = parseFloat(document.getElementById('targetVal').value);
        const dist = parseFloat(document.getElementById('inDist').value) || 1;
        const mat = document.getElementById('targetMat').value;
        const inType = document.getElementById('inputType').value;

        if (n && iv && target) {
            let s = 0, t = 0;
            if (inType === 'act') s = n.gamma * (iv * UNIT_ACT[document.getElementById('inUnit').value]) * (1 / (dist * dist));
            else s = (iv * UNIT_DOSE[document.getElementById('inUnit').value]) * (1 / (dist * dist));

            if (document.getElementById('targetType').value === 'dose') t = target * UNIT_DOSE[document.getElementById('targetUnit').value];
            else t = n.gamma * (target * UNIT_ACT[document.getElementById('targetUnit').value]) * (1 / (dist * dist));

            const req = t / s;
            if (req >= 1) showResult("0 mm", "None");
            else {
                let h = getHVL(n, mat);
                const revHvlLabel = getHVLSourceLabel();
                if (h > 0) {
                    const thk = h * (Math.log(req) / Math.log(0.5));
                    entry.resultVal = thk.toFixed(2); entry.resultUnit = "mm";
                    showResult(`${thk.toFixed(2)} mm`, mat);
                    addToLog(entry);

                    document.getElementById('specReportBox').innerHTML = `<div class="spec-report"><div class="spec-row"><span class="spec-key">${n.id}:</span> <span class="spec-val">Γ=${n.gamma} mSv·m²/h·Ci</span></div><div class="spec-row"><span class="spec-key">${mat} HVL:</span> <span class="spec-val">${h}mm</span></div></div><div style="margin-top:8px; padding:6px 8px; border-top:1px dashed var(--hobis-border);"><div style="font-size:0.7rem; font-weight:bold; color:#5f7481; margin-bottom:3px;">HVL REFERENCE — <span style="color:var(--hobis-cyan);">${revHvlLabel}</span></div><div style="font-size:0.6rem; color:#4a5a64; margin-top:4px;">QSA: broad-beam(빌드업 포함, 보수적) | NIST: narrow-beam(이론값, HVL=ln2/(μ/ρ×ρ))</div></div>`;

                    const L = [], D = [];
                    const yAxisLabel = document.getElementById('targetType').value === 'dose'
                        ? `Dose Rate (${document.getElementById('targetUnit').value})`
                        : `Activity (${document.getElementById('targetUnit').value})`;
                    for (let i = 0; i <= 100; i++) {
                        let x = i * (thk * 1.5 / 100);
                        L.push(x.toFixed(1));
                        D.push(s * Math.pow(0.5, x / h));
                    }
                    drawChart(L, D, yAxisLabel, "Thickness (mm)", thk, t);
                }
            }
        }
    }
}
