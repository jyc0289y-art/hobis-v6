// --- HOBIS LOGISTICS MODULE ---
// Customer/source file handling, routes, map, sharing

function handleCustFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function(ev) {
        parseCustCSV(ev.target.result);
        document.getElementById('custFileStatus').innerText = `LOADED: ${f.name} (${customerDB.length})`;
        document.getElementById('custFileStatus').style.color = "var(--hobis-green)";
    };
    r.readAsText(f, document.getElementById('custEncoding').value);
}

function parseCustCSV(txt) {
    const lines = txt.split(/\r\n|\n/);
    customerHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    customerDB = [];
    const idxName = customerHeaders.findIndex(h => h.includes('회사명') || h.includes('Company'));
    const idxAddr = customerHeaders.findIndex(h => h.includes('주소') && !h.includes('상세'));
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;
        const cols = parseLine(lines[i]);
        if (cols.length < customerHeaders.length) continue;
        let obj = {};
        customerHeaders.forEach((h, idx) => { obj[h] = cols[idx] || ""; });
        obj._searchStr = Object.values(obj).join(' ').toLowerCase();
        obj._displayName = idxName > -1 ? cols[idxName] : cols[0];
        obj._displayAddr = idxAddr > -1 ? cols[idxAddr] : "";
        customerDB.push(obj);
    }
}

function parseLine(l) {
    const r = []; let q = false, t = "";
    for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { q = !q; continue; }
        if (c === ',' && !q) { r.push(t); t = ""; } else t += c;
    }
    r.push(t); return r;
}

function searchCustomer() {
    const q = document.getElementById('custSearch').value.toLowerCase().replace(/\s/g, '');
    const l = document.getElementById('customerResultList');
    l.innerHTML = "";
    if (q.length < 1) return;
    const r = customerDB.filter(c => c._searchStr.replace(/\s/g, '').includes(q));
    renderCustomerList(r);
}

function renderCustomerList(list) {
    const el = document.getElementById('customerResultList');
    el.innerHTML = "";
    list.forEach(c => {
        const d = document.createElement('div');
        d.className = 'cust-item';
        d.innerHTML = `<div class="cust-main" onclick="selectCust(this)"><div class="cust-name">${c._displayName}</div><div class="cust-addr">${c._displayAddr}</div></div><button class="item-add-btn" onclick="addToActiveRoute('${c._displayName}')">[+]</button>`;
        d.querySelector('.cust-main').data = c;
        el.appendChild(d);
    });
    if (list.length === 0) el.innerHTML = `<div style="padding:10px; color:#666; text-align:center;">No match</div>`;
}

function selectCust(el) {
    selectedCustomer = el.data;
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('intelContent').classList.remove('hidden');
    const b = document.getElementById('infoTableBody');
    b.innerHTML = "";
    customerHeaders.forEach(h => {
        if (selectedCustomer[h]) b.innerHTML += `<tr><td class="key">${h}</td><td class="val">${selectedCustomer[h]}</td></tr>`;
    });
    if (selectedCustomer._displayAddr) searchOSM(selectedCustomer._displayAddr);
}

function handleSourceFiles(e) {
    const files = e.target.files; if (!files.length) return;
    sourceInventory = [];
    let loaded = 0;
    const encoding = document.getElementById('sourceEncoding').value;
    Array.from(files).forEach(f => {
        const r = new FileReader();
        r.onload = function(ev) {
            parseSourceCSV(ev.target.result, f.name);
            loaded++;
            if (loaded === files.length) renderInventory();
        };
        r.readAsText(f, encoding);
    });
}

function parseSourceCSV(txt, fname) {
    const lines = txt.split(/\r\n|\n/);
    let meta = { qty: 0, nuc: "Unknown", dateExport: "" };
    lines.forEach(l => {
        if (!l.trim()) return;
        const r = l.split(',');
        r.forEach((c, i) => {
            const v = c.replace(/"/g, '').trim();
            const nv = r[i + 1] ? r[i + 1].replace(/"/g, '').trim() : "";
            if (v.includes("수량") && !meta.qty && !isNaN(parseInt(nv))) meta.qty = parseInt(nv);
            if (v.includes("핵종")) meta.nuc = nv;
            if (v.includes("반출일자")) meta.dateExport = nv;
        });
        if (meta.nuc === "Unknown") {
            if (l.includes("Ir-192")) meta.nuc = "Ir-192";
            else if (l.includes("Se-75")) meta.nuc = "Se-75";
            else if (l.includes("Co-60")) meta.nuc = "Co-60";
        }
    });
    let hIdx = -1;
    for (let i = 0; i < Math.min(30, lines.length); i++) {
        if (lines[i].includes('No.') && (lines[i].includes('방사능') || lines[i].includes('Ci') || lines[i].includes('선원일련번호'))) { hIdx = i; break; }
    }
    if (hIdx !== -1 && meta.qty > 0) {
        const h = lines[hIdx].split(',').map(s => s.trim().replace(/"/g, ''));
        const iNo = h.findIndex(x => x.includes('No'));
        const iSN = h.findIndex(x => x.includes('선원일련번호') || x.includes('S/N'));
        const iCi = h.findIndex(x => x.includes('Ci'));
        const iMng = h.findIndex(x => x.includes('관리번호'));
        for (let i = 1; i <= meta.qty; i++) {
            const ri = hIdx + i;
            if (ri >= lines.length) break;
            const cols = parseLine(lines[ri]);
            if (!cols[iNo] || isNaN(parseInt(cols[iNo]))) continue;
            let sn = cols[iSN] || "";
            if (iSN > -1 && cols[iSN + 1] && cols[iSN + 1].length < 10) sn += "-" + cols[iSN + 1];
            sourceInventory.push({ no: cols[iNo], sn: sn, mng: iMng > -1 ? cols[iMng] : "", actCi: iCi > -1 ? cols[iCi] : "0", nuc: meta.nuc, date: meta.dateExport, file: fname });
        }
    }
}

function renderInventory() {
    document.getElementById('invCount').innerText = `${sourceInventory.length} Items`;
    const l = document.getElementById('inventoryList');
    l.innerHTML = "";
    sourceInventory.forEach(i => {
        const d = document.createElement('div');
        d.className = 'inv-item';
        d.innerHTML = `<div><span class="inv-badge">${i.nuc}</span><b>${i.actCi} Ci</b><span class="inv-meta">S/N: ${i.sn}</span><span class="inv-meta" style="font-size:0.7rem;color:#555;">${i.date} (${i.file})</span></div><button class="item-add-btn" onclick="addToActiveRouteCargo('${i.nuc} ${i.actCi}Ci (${i.sn})')">ADD</button>`;
        l.appendChild(d);
    });
}

function addRouteRow() {
    const c = document.getElementById('routeContainer');
    const d = document.createElement('div');
    d.className = 'route-card';
    d.innerHTML = `<div class="route-del-btn" onclick="this.parentElement.remove()">×</div><div class="route-meta"><input type="date" class="route-date"><input type="text" placeholder="Vehicle"><input type="text" placeholder="Manager"><input type="text" placeholder="Passenger"></div><div><label>Route (Format: A - B - C)</label><input type="text" class="route-input" onkeyup="parseRoute(this)" placeholder="Ex: Seoul - Busan"></div><div class="route-path-box"></div><div class="cargo-list">📦 Cargo: <span class="cargo-content">None</span></div>`;
    c.appendChild(d);
    d.querySelector('.route-date').value = new Date().toISOString().split('T')[0];
}

function parseRoute(el) {
    const box = el.parentElement.parentElement.querySelector('.route-path-box');
    box.innerHTML = "";
    const parts = el.value.split('-').map(s => s.trim()).filter(s => s.length > 0);
    parts.forEach((p, i) => {
        const q = p.toLowerCase().replace(/\s/g, '');
        const m = customerDB.find(c => c._displayName.toLowerCase().replace(/\s/g, '').includes(q));
        const s = document.createElement('span');
        s.className = 'route-node';
        if (m) { s.innerText = m._displayName; s.style.border = "1px solid var(--hobis-cyan)"; }
        else { s.innerText = p + " (?)"; s.style.color = "#8fa3b0"; s.style.border = "1px dashed #5f7481"; }
        box.appendChild(s);
        if (i < parts.length - 1) { const a = document.createElement('span'); a.className = 'route-arrow'; a.innerHTML = '➜'; box.appendChild(a); }
    });
}

function addToActiveRoute(n) {
    const all = document.querySelectorAll('.route-input');
    if (!all.length) { addRouteRow(); return addToActiveRoute(n); }
    const l = all[all.length - 1];
    let v = l.value.trim();
    if (v.length > 0 && !v.endsWith('-')) v += " - ";
    l.value = v + n;
    parseRoute(l);
}

function addToActiveRouteCargo(i) {
    const all = document.querySelectorAll('.cargo-content');
    if (!all.length) { alert("Create route first."); return; }
    const l = all[all.length - 1];
    if (l.innerText === "None") l.innerText = i;
    else l.innerText += ", " + i;
}

function copyCustomerInfo() {
    if (!selectedCustomer) return;
    let t = `[HOBIS]\n`;
    customerHeaders.forEach(h => { if (selectedCustomer[h]) t += `${h}: ${selectedCustomer[h]}\n`; });
    navigator.clipboard.writeText(t).then(() => alert("Copied!"));
}

function shareCustomerInfo() {
    if (!selectedCustomer) return;
    let t = `[HOBIS]\n`;
    customerHeaders.forEach(h => { if (selectedCustomer[h]) t += `${h}: ${selectedCustomer[h]}\n`; });
    if (navigator.share) navigator.share({ title: selectedCustomer._displayName, text: t });
    else navigator.clipboard.writeText(t).then(() => alert("Copied!"));
}

function shareMapLocation() {
    if (!selectedCustomer) return;
    const u = `https://map.naver.com/v5/search/${encodeURIComponent(selectedCustomer._displayAddr)}`;
    if (navigator.share) navigator.share({ title: "Location", url: u });
    else navigator.clipboard.writeText(u).then(() => alert("Link Copied!"));
}

function searchOSM(addr) {
    doFetch(addr, () => { const c = addr.replace(/\(.*\)/g, '').trim(); if (c !== addr) doFetch(c, null); });
}

function doFetch(q, fail) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => {
            if (d.length) {
                const p = d[0];
                map.setView([p.lat, p.lon], 16);
                if (marker) map.removeLayer(marker);
                marker = L.marker([p.lat, p.lon]).addTo(map);
            } else if (fail) fail();
        })
        .catch(() => { if (fail) fail(); });
}

function toggleMapSize() {
    const m = document.getElementById('map');
    const b = document.getElementById('mapExpandBtn');
    const f = m.classList.toggle('map-fullscreen');
    b.innerHTML = f ? "↩ SHRINK" : "⛶ EXPAND";
    setTimeout(() => map.invalidateSize(), 100);
}

function openMap(t) {
    if (!selectedCustomer) return;
    const q = encodeURIComponent(selectedCustomer._displayAddr);
    window.open(
        t === 'naver' ? `https://map.naver.com/v5/search/${q}` :
        t === 'kakao' ? `https://map.kakao.com/link/search/${q}` :
        `http://google.com/maps?q=${q}`, '_blank'
    );
}
