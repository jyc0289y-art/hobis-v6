// --- HOBIS CALCULATOR ENGINE ---
// Main calculate() function for all 4 modes

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
        document.getElementById('specReportBox').innerHTML = `<div class="spec-report">${specHTML}</div>`;

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
                reportSpecHTML += `<div class="spec-row"><span class="spec-key">${n.id}</span> <span class="spec-val">Γ=${n.gamma}</span></div>`;
            }
        });
        document.querySelectorAll('.shield-layer').forEach(r => {
            const m = r.querySelector('.mat-select').value;
            const t = parseFloat(r.querySelector('.thk-input').value) || 0;
            lays.push({ m: m, t: t });
        });

        let totalRes = 0;
        srcs.forEach(s => {
            let trans = 1.0;
            lays.forEach(l => {
                let h = (s.n.hvl && s.n.hvl[l.m]) ? s.n.hvl[l.m] : (l.m === 'Lead' ? s.n.hvl['Lead'] : 0);
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

        // Spec Report Injection (PATCH 3)
        document.getElementById('specReportBox').innerHTML = `<div class="spec-report">${reportSpecHTML}</div>`;

        // Chart
        if (lays.length) {
            const L = [], D = [], pm = lays[0].m, pt = lays[0].t;
            let maxThk = pt * 2 || 50;
            const yAxisLabel = ot === 'dose' ? `Dose Rate (${ou})` : `Activity (${ou})`;
            for (let i = 0; i <= 100; i++) {
                let x = i * (maxThk / 100), sum = 0;
                srcs.forEach(s => {
                    let tr = 1.0, h1 = (s.n.hvl && s.n.hvl[pm]) ? s.n.hvl[pm] : 0;
                    if (h1 > 0) tr *= Math.pow(0.5, x / h1);
                    for (let k = 1; k < lays.length; k++) {
                        let l = lays[k], h = (s.n.hvl && s.n.hvl[l.m]) ? s.n.hvl[l.m] : 0;
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
                let h = (n.hvl && n.hvl[mat]) ? n.hvl[mat] : (mat === 'Lead' ? n.hvl['Lead'] : 0);
                if (h > 0) {
                    const thk = h * (Math.log(req) / Math.log(0.5));
                    entry.resultVal = thk.toFixed(2); entry.resultUnit = "mm";
                    showResult(`${thk.toFixed(2)} mm`, mat);
                    addToLog(entry);

                    // Spec Report Injection (PATCH 3)
                    document.getElementById('specReportBox').innerHTML = `<div class="spec-report"><div class="spec-row"><span class="spec-key">${n.id}:</span> <span class="spec-val">Γ=${n.gamma}</span></div><div class="spec-row"><span class="spec-key">${mat} HVL:</span> <span class="spec-val">${h}mm</span></div></div>`;

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
