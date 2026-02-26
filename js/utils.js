// --- HOBIS UTILS MODULE ---
// Constants and utility functions used across modules

const UNIT_ACT = { "Ci": 1, "TBq": 27.027, "GBq": 0.027027, "Bq": 2.7027e-11 };
const UNIT_DOSE = { "mSv/h": 1, "uSv/h": 0.001, "R/h": 10, "mR/h": 0.01 };

function addDays(dateStr, days) {
    const r = new Date(dateStr);
    r.setDate(r.getDate() + days);
    return r.toISOString().split('T')[0];
}

function getNucData(id) {
    if (id === "MANUAL") return { id: "MANUAL" };
    return currentData.find(n => n.id === id);
}

function updateRowSpec(el) {
    const id = el.value;
    const nuc = getNucData(id);
    let disp = (el.id === "nucSelect") ? document.getElementById('specDisplay') : el.parentElement.querySelector('.spec-mini');
    if (nuc && disp) disp.innerText = id === "MANUAL" ? "Manual" : "HL:" + nuc.hl + nuc.unit;
}

function getHLDays(nuc) {
    let d = nuc.hl;
    if (nuc.unit === 'h') d /= 24;
    if (nuc.unit === 'm') d /= 1440;
    if (nuc.unit === 'y') d *= 365.25;
    return d;
}

function getUnitOpts(type) {
    return type === 'act'
        ? '<option value="Ci">Ci</option><option value="TBq">TBq</option><option value="GBq">GBq</option><option value="Bq">Bq</option>'
        : '<option value="mSv/h">mSv/h</option><option value="uSv/h">uSv/h</option><option value="R/h">R/h</option><option value="mR/h">mR/h</option>';
}
