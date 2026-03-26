// --- HOBIS CALC VISUALIZATION MODULE ---
// SHIELD/DECAY 탭 시각화: SVG 단면도, 인터랙티브 오버레이, PDF 내보내기
// Cf-252 시각화 패턴을 범용화

// ========== SHIELD 탭: SVG 차폐 단면도 ==========

/**
 * 범용 차폐 단면도 SVG 생성 (SHIELD 탭용)
 * @param {Array} sources - [{nuclide, activity_mSv_m2_h_Ci, distance_m, value}]
 * @param {Array} layers - [{material, thickness_mm}]
 * @param {Object} options - {width, height, compact, distLabel}
 * @returns {string} SVG HTML
 */
function shieldGenerateSVG(sources, layers, options = {}) {
    const W = options.width || 700;
    const H = options.height || 260;
    const compact = options.compact || false;
    const pad = compact ? 30 : 50;

    const matColors = {
        'Lead': { fill: '#6b7b8d', stroke: '#8fa3b0', label: 'Pb' },
        'Concrete': { fill: '#7a6e5e', stroke: '#a09080', label: 'Conc' },
        'Steel': { fill: '#5a6a7a', stroke: '#8a9aaa', label: 'Steel' },
        'Tungsten': { fill: '#7a7a7a', stroke: '#aaaaaa', label: 'W' },
        'DU': { fill: '#5a8a5a', stroke: '#7aba7a', label: 'DU' },
        'LeadGlass': { fill: '#4a6a8a', stroke: '#7ab0d0', label: 'PbGlass' },
        'Water': { fill: '#2a5a8a', stroke: '#4a9aee', label: 'H₂O' },
        'Polyethylene': { fill: '#6a6a3a', stroke: '#b0b060', label: 'PE' },
        'Paraffin': { fill: '#8a7a4a', stroke: '#d0c070', label: 'Wax' },
        'Aluminum': { fill: '#8a8a8a', stroke: '#c0c0c0', label: 'Al' },
        'Iron': { fill: '#5a6a7a', stroke: '#8a9aaa', label: 'Fe' },
    };

    const src = sources[0] || { value: 0, distance_m: 1 };
    const totalShieldMM = layers.reduce((s, l) => s + l.thickness_mm, 0);

    const drawW = W - pad * 2;
    const drawH = H - 60;
    const centerY = 50 + drawH / 2;

    // 스케마틱 레이아웃: 선원(15%) — 차폐체(35~65%) — 평가점(85%)
    const srcX = pad + drawW * 0.12;
    const evalX = pad + drawW * 0.88;
    const shieldZoneStart = pad + drawW * 0.35;
    const shieldZoneEnd = pad + drawW * 0.65;
    const shieldZoneW = shieldZoneEnd - shieldZoneStart;

    // 각 차폐층 폭을 두께 비율로 배분 (최소 25px)
    const layerWidths = layers.map(l => Math.max(l.thickness_mm, 1));
    const totalLayerW = layerWidths.reduce((s, w) => s + w, 0);
    const shieldStartX = shieldZoneStart;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:'Share Tech Mono',monospace;">`;
    svg += `<rect width="${W}" height="${H}" fill="#0d1117" rx="4"/>`;

    // 선원 아이콘
    svg += `<g transform="translate(${srcX},${centerY})">`;
    svg += `<circle r="12" fill="#ff9900" opacity="0.3"/>`;
    svg += `<circle r="6" fill="#ff9900" opacity="0.7"/>`;
    svg += `<circle r="2.5" fill="#ffcc00"/>`;
    for (let i = 0; i < 3; i++) {
        const r = 18 + i * 8;
        svg += `<path d="M ${r*0.7} ${-r*0.7} A ${r} ${r} 0 0 1 ${r*0.7} ${r*0.7}" fill="none" stroke="#ff9900" stroke-width="1" opacity="${0.5-i*0.15}"/>`;
    }
    svg += `</g>`;

    // 선원 라벨
    const srcLabel = sources.length > 1
        ? sources.map(s => s.nuclide).join('+')
        : (src.nuclide || 'Source');
    svg += `<text x="${srcX}" y="${centerY - 22}" text-anchor="middle" fill="#ff9900" font-size="${compact ? 9 : 11}">${srcLabel}</text>`;

    // 차폐층 (스케마틱: 비율 배분)
    let shieldX = shieldStartX;
    layers.forEach((layer, idx) => {
        const layerW = Math.max(shieldZoneW * (layerWidths[idx] / totalLayerW), 25);
        const layerH = drawH * 0.7;
        const y = centerY - layerH / 2;
        const mc = matColors[layer.material] || { fill: '#555', stroke: '#888', label: layer.material };

        svg += `<rect x="${shieldX}" y="${y}" width="${layerW}" height="${layerH}" fill="${mc.fill}" stroke="${mc.stroke}" stroke-width="1.5" opacity="0.7" rx="2"/>`;

        // 해칭 패턴
        if (layer.material === 'Lead' || layer.material === 'DU') {
            for (let hy = y + 5; hy < y + layerH - 5; hy += 8) {
                svg += `<line x1="${shieldX+3}" y1="${hy}" x2="${shieldX+layerW-3}" y2="${hy+6}" stroke="${mc.stroke}" stroke-width="0.5" opacity="0.4"/>`;
            }
        } else if (layer.material === 'Concrete') {
            for (let dx = 5; dx < layerW - 5; dx += 10) {
                for (let dy = 8; dy < layerH - 5; dy += 12) {
                    svg += `<circle cx="${shieldX+dx+(idx*3%4)}" cy="${y+dy}" r="${1+((idx+dx)%2)}" fill="${mc.stroke}" opacity="0.3"/>`;
                }
            }
        } else if (layer.material === 'Steel' || layer.material === 'Tungsten') {
            for (let hy = y + 5; hy < y + layerH - 5; hy += 6) {
                svg += `<line x1="${shieldX+2}" y1="${hy}" x2="${shieldX+layerW-2}" y2="${hy}" stroke="${mc.stroke}" stroke-width="0.4" opacity="0.3"/>`;
            }
        } else if (layer.material === 'Water') {
            // 물결 패턴
            for (let hy = y + 8; hy < y + layerH - 5; hy += 10) {
                let wave = `M ${shieldX+3} ${hy}`;
                for (let wx = 0; wx < layerW - 6; wx += 12) {
                    wave += ` q 3 -4 6 0 q 3 4 6 0`;
                }
                svg += `<path d="${wave}" fill="none" stroke="${mc.stroke}" stroke-width="0.6" opacity="0.35"/>`;
            }
        } else if (layer.material === 'Polyethylene' || layer.material === 'Paraffin') {
            // 점선 패턴
            for (let hy = y + 6; hy < y + layerH - 5; hy += 8) {
                svg += `<line x1="${shieldX+3}" y1="${hy}" x2="${shieldX+layerW-3}" y2="${hy}" stroke="${mc.stroke}" stroke-width="0.5" opacity="0.3" stroke-dasharray="3,4"/>`;
            }
        }

        // 재질 라벨
        const ls = compact ? 8 : 10;
        svg += `<text x="${shieldX+layerW/2}" y="${centerY-2}" text-anchor="middle" fill="#fff" font-size="${ls}" font-weight="bold">${mc.label}</text>`;
        svg += `<text x="${shieldX+layerW/2}" y="${centerY+12}" text-anchor="middle" fill="${mc.stroke}" font-size="${compact?7:9}">${layer.thickness_mm}mm</text>`;

        // 치수선
        const dimY = y - 8;
        svg += `<line x1="${shieldX}" y1="${dimY}" x2="${shieldX+layerW}" y2="${dimY}" stroke="#00f7ff" stroke-width="0.8"/>`;
        svg += `<line x1="${shieldX}" y1="${dimY-4}" x2="${shieldX}" y2="${dimY+4}" stroke="#00f7ff" stroke-width="0.8"/>`;
        svg += `<line x1="${shieldX+layerW}" y1="${dimY-4}" x2="${shieldX+layerW}" y2="${dimY+4}" stroke="#00f7ff" stroke-width="0.8"/>`;
        if (!compact) {
            svg += `<text x="${shieldX+layerW/2}" y="${dimY-3}" text-anchor="middle" fill="#00f7ff" font-size="8">${layer.thickness_mm} mm</text>`;
        }
        shieldX += layerW;
    });

    // 평가점 (고정 위치)
    svg += `<g transform="translate(${evalX},${centerY})">`;
    svg += `<circle r="5" fill="none" stroke="#00ff33" stroke-width="2"/>`;
    svg += `<line x1="-4" y1="0" x2="4" y2="0" stroke="#00ff33" stroke-width="1.5"/>`;
    svg += `<line x1="0" y1="-4" x2="0" y2="4" stroke="#00ff33" stroke-width="1.5"/>`;
    svg += `</g>`;
    svg += `<text x="${evalX}" y="${centerY+22}" text-anchor="middle" fill="#00ff33" font-size="${compact?8:10}">평가점</text>`;

    // 총 거리 치수선
    const dimBY = centerY + (compact ? 35 : 45);
    svg += `<line x1="${srcX}" y1="${dimBY}" x2="${evalX}" y2="${dimBY}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<line x1="${srcX}" y1="${dimBY-5}" x2="${srcX}" y2="${dimBY+5}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<line x1="${evalX}" y1="${dimBY-5}" x2="${evalX}" y2="${dimBY+5}" stroke="#ffcc00" stroke-width="1"/>`;
    svg += `<text x="${(srcX+evalX)/2}" y="${dimBY+14}" text-anchor="middle" fill="#ffcc00" font-size="${compact?9:11}">거리: ${src.distance_m} m</text>`;

    if (!compact) {
        svg += `<text x="${W/2}" y="18" text-anchor="middle" fill="#8fa3b0" font-size="11" font-family="'Orbitron',sans-serif">SHIELDING CROSS-SECTION</text>`;
    }

    svg += `</svg>`;
    return svg;
}

// ========== SHIELD 인터랙티브 오버레이 ==========

let _shieldOvData = null;

function shieldOpenOverlay() {
    let ov = document.getElementById('shieldOverlay');
    if (ov) ov.remove();

    // 현재 입력값 수집
    const inType = document.getElementById('inputType') ? document.getElementById('inputType').value : 'act';
    const dist = parseFloat(document.getElementById('inDist')?.value) || 1;
    const ot = document.getElementById('outType')?.value || 'dose';
    const ou = document.getElementById('outUnit')?.value || 'mSv/h';

    const srcs = [];
    document.querySelectorAll('.source-row').forEach(r => {
        const n = getNucData(r.querySelector('.src-select').value);
        const v = parseFloat(r.querySelector('.src-val').value) || 0;
        if (n && v > 0) {
            let val = inType === 'act' ? v * UNIT_ACT[r.querySelector('.src-unit').value] : v * UNIT_DOSE[r.querySelector('.src-unit').value];
            srcs.push({ nuc: n, val, rawVal: v, unit: r.querySelector('.src-unit').value, nuclide: n.id });
        }
    });

    const lays = [];
    document.querySelectorAll('.shield-layer').forEach(r => {
        const m = r.querySelector('.mat-select').value;
        const t = parseFloat(r.querySelector('.thk-input').value) || 0;
        lays.push({ material: m, thickness_mm: t });
    });

    if (srcs.length === 0) return;

    _shieldOvData = { srcs, lays, dist, inType, ot, ou };

    ov = document.createElement('div');
    ov.id = 'shieldOverlay';
    ov.className = 'cf252-overlay';

    const matNames = { 'Lead': '납', 'Concrete': '콘크리트', 'Steel': '강철', 'Tungsten': 'W', 'DU': 'DU' };

    // 슬라이더 HTML
    let slidersHTML = `<div class="cf252-ov-sliders">`;

    // 방사능 / 선량률 슬라이더
    const src = srcs[0];
    const actMax = Math.max(src.rawVal * 3, 100);
    const actLabel = inType === 'act' ? '방사능량' : '선량률';
    slidersHTML += `
        <div class="cf252-ov-slider-group">
            <label>${actLabel}: <span id="shieldOvActVal">${src.rawVal}</span> ${src.unit}</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" id="shieldOvAct" min="0.1" max="${actMax}" step="0.1" value="${src.rawVal}" style="flex:1;">
                <input type="number" id="shieldOvActNum" min="0.1" max="${actMax}" step="0.1" value="${src.rawVal}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="shieldOvSyncInput('shieldOvAct')">
            </div>
        </div>`;

    // 거리 슬라이더
    slidersHTML += `
        <div class="cf252-ov-slider-group">
            <label>거리: <span id="shieldOvDistVal">${dist}</span> m</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" id="shieldOvDist" min="0.1" max="${Math.max(dist*5,10)}" step="0.1" value="${dist}" style="flex:1;">
                <input type="number" id="shieldOvDistNum" min="0.1" max="${Math.max(dist*5,10)}" step="0.1" value="${dist}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="shieldOvSyncInput('shieldOvDist')">
            </div>
        </div>`;

    // 차폐층 슬라이더
    lays.forEach((layer, idx) => {
        const maxThk = Math.max(layer.thickness_mm * 3, 200);
        slidersHTML += `
        <div class="cf252-ov-slider-group">
            <label>${matNames[layer.material] || layer.material}: <span id="shieldOvLayer${idx}Val">${layer.thickness_mm}</span> mm</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" class="shield-ov-layer-slider" data-idx="${idx}" id="shieldOvLayer${idx}" min="0" max="${maxThk}" step="1" value="${layer.thickness_mm}" style="flex:1;">
                <input type="number" id="shieldOvLayer${idx}Num" min="0" max="${maxThk}" step="1" value="${layer.thickness_mm}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="shieldOvSyncInput('shieldOvLayer${idx}')">
            </div>
        </div>`;
    });

    slidersHTML += `</div>`;

    // SVG sources 변환
    const svgSources = srcs.map(s => ({ nuclide: s.nuclide, distance_m: dist, value: s.rawVal }));
    const svgLayers = lays.map(l => ({ material: l.material, thickness_mm: l.thickness_mm }));

    ov.innerHTML = `
        <div class="cf252-ov-content">
            <div class="cf252-ov-header">
                <span style="font-family:'Orbitron',sans-serif; color:var(--hobis-warn);">INTERACTIVE SHIELDING ANALYSIS</span>
                <button class="cf252-ov-close" onclick="shieldCloseOverlay()">&times;</button>
            </div>
            <div class="cf252-ov-body">
                <div class="cf252-ov-diagram" id="shieldOvDiagram">
                    ${shieldGenerateSVG(svgSources, svgLayers, { width: 900, height: 300 })}
                </div>
                <div class="cf252-ov-controls">
                    ${slidersHTML}
                    <div class="cf252-ov-result" id="shieldOvResult"></div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(ov);

    ov.addEventListener('click', (e) => { if (e.target === ov) shieldCloseOverlay(); });
    ov._keyHandler = (e) => { if (e.key === 'Escape') shieldCloseOverlay(); };
    document.addEventListener('keydown', ov._keyHandler);

    // 슬라이더 이벤트
    const bindSync = (id) => {
        const slider = document.getElementById(id);
        if (slider) slider.addEventListener('input', () => {
            const numInput = document.getElementById(id + 'Num');
            if (numInput) numInput.value = slider.value;
            shieldOvRecalculate();
        });
    };
    bindSync('shieldOvAct');
    bindSync('shieldOvDist');
    lays.forEach((_, idx) => bindSync('shieldOvLayer' + idx));

    shieldOvRecalculate();
    setTimeout(() => ov.classList.add('cf252-ov-visible'), 30);
}

function shieldOvSyncInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const numInput = document.getElementById(sliderId + 'Num');
    if (slider && numInput) {
        let v = parseFloat(numInput.value);
        if (isNaN(v)) return;
        v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        slider.value = v;
    }
    shieldOvRecalculate();
}

function shieldOvRecalculate() {
    if (!_shieldOvData) return;
    const d = _shieldOvData;

    const actVal = parseFloat(document.getElementById('shieldOvAct')?.value) || d.srcs[0].rawVal;
    const dist = parseFloat(document.getElementById('shieldOvDist')?.value) || d.dist;

    document.getElementById('shieldOvActVal').textContent = actVal;
    document.getElementById('shieldOvDistVal').textContent = dist;

    const currentLayers = d.lays.map((layer, idx) => {
        const slider = document.getElementById('shieldOvLayer' + idx);
        const thick = slider ? parseFloat(slider.value) : layer.thickness_mm;
        const valSpan = document.getElementById('shieldOvLayer' + idx + 'Val');
        if (valSpan) valSpan.textContent = thick;
        return { material: layer.material, thickness_mm: thick };
    });

    // 계산 (calculator.js 로직 재현)
    let totalRes = 0;
    const actRatio = actVal / d.srcs[0].rawVal;
    d.srcs.forEach(s => {
        let trans = 1.0;
        currentLayers.forEach(l => {
            const h = (s.nuc.hvl && s.nuc.hvl[l.material]) ? s.nuc.hvl[l.material] : 0;
            if (h > 0) trans *= Math.pow(0.5, l.thickness_mm / h);
        });
        const val = s.val * actRatio;
        if (d.inType === 'act') {
            totalRes += s.nuc.gamma * val * (1 / (dist * dist)) * trans;
        } else {
            totalRes += val * (1 / (dist * dist)) * trans;
        }
    });

    const finalVal = totalRes * (1 / UNIT_DOSE[d.ou]);

    // SVG 업데이트
    const svgSources = d.srcs.map(s => ({ nuclide: s.nuclide, distance_m: dist, value: actVal }));
    const svgLayers = currentLayers.map(l => ({ material: l.material, thickness_mm: l.thickness_mm }));
    const diag = document.getElementById('shieldOvDiagram');
    if (diag) diag.innerHTML = shieldGenerateSVG(svgSources, svgLayers, { width: 900, height: 300 });

    // 결과 표시
    const resultDiv = document.getElementById('shieldOvResult');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="cf252-ov-result-card" style="border-color:var(--hobis-green);">
                <div class="cf252-ov-result-verdict" style="color:var(--hobis-green);">SHIELD FORWARD RESULT</div>
                <div class="cf252-ov-result-grid">
                    <div class="cf252-ov-result-total">
                        <span class="cf252-ov-rlabel">계산 결과</span>
                        <span class="cf252-ov-rval" style="font-size:1.1rem;">${finalVal.toExponential(4)} ${d.ou}</span>
                    </div>
                    <div>
                        <span class="cf252-ov-rlabel">거리</span>
                        <span class="cf252-ov-rval">${dist} m</span>
                    </div>
                    <div>
                        <span class="cf252-ov-rlabel">총 차폐 두께</span>
                        <span class="cf252-ov-rval">${currentLayers.reduce((s,l) => s + l.thickness_mm, 0)} mm</span>
                    </div>
                </div>
            </div>`;
    }
}

function shieldCloseOverlay() {
    const ov = document.getElementById('shieldOverlay');
    if (!ov) return;
    if (ov._keyHandler) document.removeEventListener('keydown', ov._keyHandler);
    ov.classList.remove('cf252-ov-visible');
    setTimeout(() => ov.remove(), 200);
    _shieldOvData = null;
}


// ========== DECAY 인터랙티브 오버레이 ==========

let _decayOvData = null;

function decayOpenOverlay() {
    let ov = document.getElementById('decayOverlay');
    if (ov) ov.remove();

    // decay_forward의 입력값 수집
    const sDate = document.getElementById('dateStart')?.value;
    const eDate = document.getElementById('dateEnd')?.value;
    const outUnit = document.getElementById('outUnit')?.value || 'mCi';
    const days = (new Date(eDate) - new Date(sDate)) / 86400000;

    const srcs = [];
    document.querySelectorAll('.source-row').forEach(r => {
        const n = getNucData(r.querySelector('.src-select').value);
        const v = parseFloat(r.querySelector('.src-val').value) || 0;
        if (n && v > 0) {
            const A0 = v * UNIT_ACT[r.querySelector('.src-unit').value];
            srcs.push({ nuc: n, A0, rawVal: v, unit: r.querySelector('.src-unit').value });
        }
    });

    if (srcs.length === 0) return;

    _decayOvData = { srcs, days, outUnit, sDate };

    ov = document.createElement('div');
    ov.id = 'decayOverlay';
    ov.className = 'cf252-overlay';

    // 슬라이더: 날짜 범위, 초기 방사능
    const maxDays = Math.max(days * 3, 365);
    const src = srcs[0];
    const actMax = Math.max(src.rawVal * 3, 1000);

    let slidersHTML = `<div class="cf252-ov-sliders">`;

    slidersHTML += `
        <div class="cf252-ov-slider-group">
            <label>초기 방사능: <span id="decayOvActVal">${src.rawVal}</span> ${src.unit}</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" id="decayOvAct" min="0.1" max="${actMax}" step="0.1" value="${src.rawVal}" style="flex:1;">
                <input type="number" id="decayOvActNum" min="0.1" max="${actMax}" step="0.1" value="${src.rawVal}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="decayOvSyncInput('decayOvAct')">
            </div>
        </div>`;

    slidersHTML += `
        <div class="cf252-ov-slider-group">
            <label>경과일: <span id="decayOvDaysVal">${days.toFixed(0)}</span> days</label>
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="range" id="decayOvDays" min="0" max="${maxDays}" step="1" value="${days}" style="flex:1;">
                <input type="number" id="decayOvDaysNum" min="0" max="${maxDays}" step="1" value="${days.toFixed(0)}" style="width:70px; background:var(--hobis-panel); color:var(--hobis-green); border:1px solid var(--hobis-border); padding:2px 4px; font-size:11px; text-align:right; font-family:monospace;" oninput="decayOvSyncInput('decayOvDays')">
            </div>
        </div>`;

    slidersHTML += `</div>`;

    ov.innerHTML = `
        <div class="cf252-ov-content">
            <div class="cf252-ov-header">
                <span style="font-family:'Orbitron',sans-serif; color:var(--hobis-warn);">INTERACTIVE DECAY ANALYSIS</span>
                <button class="cf252-ov-close" onclick="decayCloseOverlay()">&times;</button>
            </div>
            <div class="cf252-ov-body">
                <div class="cf252-ov-diagram" id="decayOvChart" style="display:flex; align-items:center; justify-content:center;">
                    <canvas id="decayOvCanvas" style="width:100%; height:100%;"></canvas>
                </div>
                <div class="cf252-ov-controls">
                    ${slidersHTML}
                    <div class="cf252-ov-result" id="decayOvResult"></div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(ov);

    ov.addEventListener('click', (e) => { if (e.target === ov) decayCloseOverlay(); });
    ov._keyHandler = (e) => { if (e.key === 'Escape') decayCloseOverlay(); };
    document.addEventListener('keydown', ov._keyHandler);

    // 슬라이더 이벤트
    ['decayOvAct', 'decayOvDays'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) slider.addEventListener('input', () => {
            const numInput = document.getElementById(id + 'Num');
            if (numInput) numInput.value = slider.value;
            decayOvRecalculate();
        });
    });

    decayOvRecalculate();
    setTimeout(() => ov.classList.add('cf252-ov-visible'), 30);
}

function decayOvSyncInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const numInput = document.getElementById(sliderId + 'Num');
    if (slider && numInput) {
        let v = parseFloat(numInput.value);
        if (isNaN(v)) return;
        v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        slider.value = v;
    }
    decayOvRecalculate();
}

let _decayOvChart = null;

function decayOvRecalculate() {
    if (!_decayOvData) return;
    const d = _decayOvData;

    const actVal = parseFloat(document.getElementById('decayOvAct')?.value) || d.srcs[0].rawVal;
    const days = parseFloat(document.getElementById('decayOvDays')?.value) || d.days;

    document.getElementById('decayOvActVal').textContent = actVal;
    document.getElementById('decayOvDaysVal').textContent = Math.round(days);

    // 방사능 비율 적용
    const actRatio = actVal / d.srcs[0].rawVal;

    // 현재 값 계산
    let total = 0;
    d.srcs.forEach(s => {
        const A0 = s.A0 * actRatio;
        total += A0 * Math.pow(0.5, days / getHLDays(s.nuc));
    });
    const result = total * (1 / UNIT_ACT[d.outUnit]);

    // 감쇄 곡선 데이터
    const range = days > 0 ? days * 1.5 : 365;
    const labels = [], data = [], resultPoint = [];
    for (let i = 0; i <= 100; i++) {
        const t = i * (range / 100);
        labels.push(t.toFixed(0));
        let sum = 0;
        d.srcs.forEach(s => {
            const A0 = s.A0 * actRatio;
            sum += A0 * Math.pow(0.5, t / getHLDays(s.nuc));
        });
        data.push(sum * (1 / UNIT_ACT[d.outUnit]));
        resultPoint.push(null);
    }

    // 결과점 마킹
    let closestIdx = 0, minDiff = Infinity;
    labels.forEach((v, i) => { const diff = Math.abs(parseFloat(v) - days); if (diff < minDiff) { minDiff = diff; closestIdx = i; } });
    resultPoint[closestIdx] = result;

    // 차트 그리기
    const canvas = document.getElementById('decayOvCanvas');
    if (!canvas) return;

    if (_decayOvChart) _decayOvChart.destroy();
    Chart.defaults.color = '#5f7481';

    _decayOvChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Activity (' + d.outUnit + ')',
                    data,
                    borderColor: '#00ff33',
                    backgroundColor: 'rgba(0,255,51,0.05)',
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3,
                },
                {
                    label: 'Result',
                    data: resultPoint,
                    borderColor: '#ff9900',
                    backgroundColor: '#ff9900',
                    pointRadius: 8,
                    type: 'scatter',
                }
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
                        title: (items) => items[0].label + ' days',
                        label: (ctx) => {
                            if (ctx.parsed.y === null) return '';
                            return ctx.dataset.label + ': ' + ctx.parsed.y.toExponential(3) + ' ' + d.outUnit;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Days' },
                    grid: { color: '#1f2b33' },
                    ticks: { maxTicksLimit: 10 },
                },
                y: {
                    title: { display: true, text: 'Activity (' + d.outUnit + ')' },
                    grid: { color: '#1f2b33' },
                }
            }
        }
    });

    // 결과 카드
    const evalDate = d.sDate ? new Date(new Date(d.sDate).getTime() + days * 86400000).toISOString().slice(0, 10) : '';
    const resultDiv = document.getElementById('decayOvResult');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="cf252-ov-result-card" style="border-color:var(--hobis-green);">
                <div class="cf252-ov-result-verdict" style="color:var(--hobis-green);">DECAY RESULT</div>
                <div class="cf252-ov-result-grid">
                    <div class="cf252-ov-result-total">
                        <span class="cf252-ov-rlabel">잔여 방사능</span>
                        <span class="cf252-ov-rval" style="font-size:1.1rem;">${result.toExponential(4)} ${d.outUnit}</span>
                    </div>
                    <div>
                        <span class="cf252-ov-rlabel">경과일</span>
                        <span class="cf252-ov-rval">${Math.round(days)} days</span>
                    </div>
                    ${evalDate ? `<div><span class="cf252-ov-rlabel">평가일</span><span class="cf252-ov-rval">${evalDate}</span></div>` : ''}
                    <div>
                        <span class="cf252-ov-rlabel">핵종</span>
                        <span class="cf252-ov-rval">${d.srcs.map(s => s.nuc.id).join(', ')}</span>
                    </div>
                </div>
            </div>`;
    }
}

function decayCloseOverlay() {
    const ov = document.getElementById('decayOverlay');
    if (!ov) return;
    if (ov._keyHandler) document.removeEventListener('keydown', ov._keyHandler);
    ov.classList.remove('cf252-ov-visible');
    if (_decayOvChart) { _decayOvChart.destroy(); _decayOvChart = null; }
    setTimeout(() => ov.remove(), 200);
    _decayOvData = null;
}


// ========== 전체 레퍼런스 테이블 생성 ==========

function generateFullRefHTML(forPDF) {
    const sel = document.getElementById('hvlSource');
    const hvlBasis = (sel && sel.value === 'nist') ? 'NIST XCOM (narrow-beam)' : 'QSA MAN-027 (broad-beam)';
    const dbSel = document.getElementById('dbSelector');
    const dbName = dbSel ? dbSel.value : 'QSA';

    const tbl = (forPDF)
        ? 'style="width:100%;font-size:9px;border-collapse:collapse;margin:5px 0;"'
        : 'style="width:100%;font-size:0.65rem;border-collapse:collapse;margin:5px 0;"';
    const td = 'style="padding:2px 5px;border:1px solid ' + (forPDF ? '#ddd' : '#2a3b47') + ';"';
    const th = 'style="padding:3px 5px;border:1px solid ' + (forPDF ? '#ddd' : '#2a3b47') + ';background:' + (forPDF ? '#f0f0f0' : '#1a2530') + ';font-weight:bold;"';
    const secColor = forPDF ? '#333' : 'var(--hobis-cyan)';
    const txtColor = forPDF ? '#444' : '#8fa3b0';
    const noteColor = forPDF ? '#888' : '#4a5a64';

    let html = '';

    // --- 섹션 1: 감마상수 비교 ---
    html += `<div style="font-size:${forPDF?'11px':'0.75rem'};font-weight:bold;color:${secColor};margin:10px 0 4px;">1. 감마상수 Γ (mSv·m²/h·Ci) — 현재 DB: ${dbName}</div>`;
    html += `<table ${tbl}><tr><td ${th}>핵종</td><td ${th}>QSA</td><td ${th}>ICRP107</td><td ${th}>차이</td><td ${th}>원인</td></tr>`;
    const gammaComp = [
        ['Ir-192', 4.80, 4.60, '+4%', '캡슐 보정 방향 차이'],
        ['Se-75', 2.03, 2.03, '0%', '중간에너지, 캡슐효과 미미'],
        ['Yb-169', 1.25, 1.85, '-32%', '저에너지(93keV) — bare source에서 저에너지선 포함'],
        ['Co-60', 13.0, 12.9, '+1%', '고에너지, 캡슐효과 거의 없음'],
        ['Cs-137', 3.20, 3.43, '-7%', 'Ba X선 기여 차이'],
    ];
    gammaComp.forEach(r => {
        html += `<tr><td ${td}>${r[0]}</td><td ${td}>${r[1]}</td><td ${td}>${r[2]}</td><td ${td}>${r[3]}</td><td ${td} style="font-size:${forPDF?'8px':'0.6rem'};color:${noteColor};">${r[4]}</td></tr>`;
    });
    html += '</table>';
    html += `<div style="font-size:${forPDF?'8px':'0.55rem'};color:${noteColor};margin:3px 0 8px;">QSA: 캡슐 소스 실측값 (자기차폐 반영) | ICRP107: bare source 이론 적분값 (캡슐 미반영)</div>`;

    // --- 섹션 2: HVL 비교 (현재 선택된 DB 기준) ---
    html += `<div style="font-size:${forPDF?'11px':'0.75rem'};font-weight:bold;color:${secColor};margin:10px 0 4px;">2. 반가층 HVL (mm) — 현재: ${hvlBasis}</div>`;
    html += `<table ${tbl}><tr><td ${th}>재질</td><td ${th}>Ir-192</td><td ${th}>Co-60</td><td ${th}>Cs-137</td><td ${th}>출처</td></tr>`;
    const hvlSrc = (sel && sel.value === 'nist') ? 'hvl_nist' : 'hvl';
    const qsa = GLOBAL_DB.QSA;
    const matList = [
        ['Lead','Pb','QSA MAN-027 T7'],['Steel','Steel','QSA MAN-027 T7'],['Concrete','Conc','QSA MAN-027 T7'],
        ['Water','H₂O','NIST XCOM'],['Polyethylene','PE','NIST XCOM'],['Paraffin','Wax','NIST XCOM'],['Aluminum','Al','NIST XCOM'],
    ];
    matList.forEach(m => {
        const ir = qsa[0][hvlSrc]?.[m[0]] ?? qsa[0].hvl[m[0]] ?? '-';
        const co = qsa[3][hvlSrc]?.[m[0]] ?? qsa[3].hvl[m[0]] ?? '-';
        const cs = qsa[4][hvlSrc]?.[m[0]] ?? qsa[4].hvl[m[0]] ?? '-';
        html += `<tr><td ${td}>${m[0]}</td><td ${td}>${ir}</td><td ${td}>${co}</td><td ${td}>${cs}</td><td ${td} style="font-size:${forPDF?'8px':'0.55rem'};color:${noteColor};">${m[2]}</td></tr>`;
    });
    html += '</table>';
    html += `<div style="font-size:${forPDF?'8px':'0.55rem'};color:${noteColor};margin:3px 0 8px;">QSA broad-beam: 빌드업 팩터 포함 (보수적, 10-20% 높음) | NIST narrow-beam: HVL=ln2/(μ/ρ×ρ) 이론값</div>`;

    // --- 섹션 3: 타당성 검증 요약 ---
    html += `<div style="font-size:${forPDF?'11px':'0.75rem'};font-weight:bold;color:${secColor};margin:10px 0 4px;">3. 데이터 타당성 검증</div>`;
    html += `<table ${tbl}><tr><td ${th}>항목</td><td ${th}>검증 방법</td><td ${th}>결과</td></tr>`;
    const validations = [
        ['Pb QSA vs NIST', 'Cs-137 단일선(662keV) 비교', 'NIST 5.5mm vs QSA 6.4mm (-14%) — 빌드업 차이로 설명됨'],
        ['Al γ-HVL', 'NIST XCOM μ/ρ×ρ 계산 + Nuclear-Power.com 교차검증', '500keV Al: 계산 3.05cm = Nuclear-Power.com 3.05cm 일치'],
        ['Fe γ-HVL', 'NIST XCOM + NDT 산업 표준(NDE-Ed.org) 비교', 'Ir-192 NIST 8.5mm vs QSA Steel 13mm — broad/narrow 차이로 설명'],
        ['Paraffin n-HVL',
         'PE 대비 H원자밀도 정량 비교 + 문헌 확인',
         'PE(C₂H₄)ₙ: H wt%=14.37%, ρ=0.94 → nH=8.13×10²²/cm³ | Paraffin(C₂₅H₅₂): H wt%=14.86%, ρ=0.93 → nH=8.32×10²²/cm³ | 비율 0.977 → HVL=1.85/0.977≈1.9cm | Kang et al. 2008 (J Korean Phys Soc 52:1744): paraffin collimator 사용 | McAlister (Eichrom): 파라핀=PE급 수소함유 차폐재 분류'],
        ['Al n-HVL (Cf-252)',
         'El-Khayatt & Abdo 2009 + 7개 문헌 교차검증 (1955-2023)',
         'ΣR/ρ 합의값=0.0245±0.001 cm²/g → HVL=10.5±0.3cm | 검증: Chapman & Storrs 1955(ORNL)=0.0245, Chilton/Shultis/Faw 1984=0.0245, Kaplan 1989=0.0245, Shultis & Faw 2000=0.0245, Hila et al. 2023(ENDF/B-VIII.0 MC)=0.0234(~5%dev), Phy-X/PSD=0.0245'],
        ['Fe n-HVL (Cf-252)',
         'El-Khayatt & Abdo 2009 + 교차검증 + Cf-252 특화 연구',
         'ΣR/ρ 합의값=0.0198±0.001 cm²/g → HVL=4.4±0.2cm | 검증: Chapman & Storrs 1955=0.01984, Shultis & Faw 2000=0.01984, Hila 2023(MC)=0.0191(~4%dev) | Bakr & Sayed 2020 (AIP Advances): Fe를 Cf-252 1차 차폐층으로 권장 (고속중성자 비탄성산란)'],
    ];
    validations.forEach(v => {
        html += `<tr><td ${td}>${v[0]}</td><td ${td} style="font-size:${forPDF?'8px':'0.55rem'};">${v[1]}</td><td ${td} style="font-size:${forPDF?'8px':'0.55rem'};color:${noteColor};">${v[2]}</td></tr>`;
    });
    html += '</table>';

    // --- 섹션 4: 참조 문헌 ---
    html += `<div style="font-size:${forPDF?'11px':'0.75rem'};font-weight:bold;color:${secColor};margin:10px 0 4px;">4. 참조 문헌</div>`;
    const refs = [
        'QSA Global MAN-027 (Sep 2022) — QSA 5핵종 Γ, HVL (broad-beam)',
        'Smith & Stabin (2012), ICRP-107 — ICRP107 13핵종 Γ, Cf-252 Γ',
        'NIST XCOM Photon Cross Sections DB — γ질량감쇄계수, HVL 계산',
        'Alizadeh Rahvar et al., Int.J.Radiat.Res. 18(2):381-387, 2020 — Cf-252 γ/n HVL (MCNPX)',
        'El-Khayatt & Abdo, Ann.Nucl.Energy 37(2):218-223, 2009 — Al/Fe 중성자 제거단면적',
        'Chapman & Storrs, ORNL AECD-3978, 1955 — 중성자 제거단면적 원천 실험 데이터',
        'Hila et al., Rad.Phys.Chem. 2023 — ENDF/B-VIII.0 MC 교차검증',
        'ICRP 74 — H/Φ 중성자 선량환산계수',
        'Bakr & Sayed, AIP Advances 10:075203, 2020 — Cf-252 최적 차폐 설계',
    ];
    html += `<div style="font-size:${forPDF?'9px':'0.6rem'};color:${txtColor};line-height:1.5;">`;
    refs.forEach((r, i) => { html += `[${i+1}] ${r}<br>`; });
    html += '</div>';

    return html;
}

// ========== 통합 PDF 내보내기 ==========

/**
 * DECAY/SHIELD 결과를 PDF (인쇄용 HTML)로 내보내기
 */
function calcExportPDF() {
    const resultBox = document.getElementById('resultBox');
    if (!resultBox || resultBox.classList.contains('hidden')) {
        alert('계산 결과가 없습니다. 먼저 EXECUTE를 실행하세요.');
        return;
    }

    // 결과 내용 수집
    const resMain = document.getElementById('resMain')?.innerText || '';
    const resSub = document.getElementById('resSub')?.innerText || '';
    const specReport = document.getElementById('specReportBox')?.innerHTML || '';

    // 차트 캡처
    let chartImg = '';
    const chartCanvas = document.getElementById('opsChart');
    if (chartCanvas) {
        try {
            chartImg = '<div style="text-align:center;margin:20px 0;"><img src="' + chartCanvas.toDataURL('image/png') + '" style="max-width:100%;height:auto;"></div>';
        } catch (e) {}
    }

    // SVG 캡처 (SHIELD 결과에 SVG가 있으면)
    const svgThumb = document.getElementById('shieldDiagramSection');
    let svgHTML = '';
    if (svgThumb) {
        svgHTML = '<div style="margin:15px 0; text-align:center;">' + svgThumb.innerHTML + '</div>';
        // EXPAND 버튼 제거
        svgHTML = svgHTML.replace(/<button[^>]*>.*?EXPAND.*?<\/button>/gi, '');
    }

    const modeLabels = {
        'decay_forward': 'DECAY FORWARD',
        'decay_reverse': 'DECAY REVERSE',
        'shield_forward': 'SHIELD FORWARD',
        'shield_reverse': 'SHIELD REVERSE',
    };
    const modeLabel = modeLabels[currentSubMode] || currentSubMode;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);

    const printHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HOBIS ${modeLabel} Report</title>
<style>
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap");
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Noto Sans KR",sans-serif;color:#222;padding:30px;font-size:12px;line-height:1.6}
.report-header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}
.report-header h1{font-size:18px;margin-bottom:5px}
.report-header .sub{font-size:11px;color:#666}
.report-meta{display:flex;justify-content:space-between;font-size:10px;color:#888;margin-bottom:15px;padding:5px 0;border-bottom:1px solid #ddd}
.result-main{text-align:center;padding:20px;margin:15px 0;background:#f5f5f5;border:2px solid #333;border-radius:4px}
.result-main .value{font-size:24px;font-weight:bold;color:#1a5e1a}
.result-main .sub{font-size:14px;color:#666;margin-top:5px}
.spec-report{font-size:11px;margin:10px 0}
.spec-row{display:flex;justify-content:space-between;padding:2px 10px;border-bottom:1px dotted #ddd}
.spec-key{color:#555}.spec-val{color:#222}
.header{font-weight:bold;font-size:12px;color:#333;margin:10px 0 5px}
.report-footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}
@media print{body{padding:15px}}
</style></head><body>
<div class="report-header">
    <h1>${modeLabel} Report</h1>
    <div class="sub">HOBIS v6.0 — Radiation Protection Calculation System</div>
</div>
<div class="report-meta">
    <span>작성일: ${dateStr} ${timeStr}</span>
    <span>Mode: ${modeLabel}</span>
</div>
<div class="result-main">
    <div class="value">${resMain}</div>
    <div class="sub">${resSub}</div>
</div>
${specReport ? '<div class="header">SPECIFICATION</div>' + specReport : ''}
${svgHTML}
${chartImg}
${currentSubMode.startsWith('shield') ? '<div style="margin-top:20px; border-top:1px solid #ccc; padding-top:10px; page-break-before:auto;"><div class="header">DATA REFERENCES</div>' + generateFullRefHTML(true) + '</div>' : ''}
<div class="report-footer">Generated by HOBIS v6.0 Radiation Protection System</div>
</body></html>`;

    const pw = window.open('', '_blank');
    if (pw) {
        pw.document.write(printHTML);
        pw.document.close();
        setTimeout(() => pw.print(), 500);
    } else {
        const blob = new Blob([printHTML], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'hobis_' + currentSubMode + '_' + dateStr.replace(/-/g, '') + '.html';
        a.click();
        URL.revokeObjectURL(a.href);
    }
}
