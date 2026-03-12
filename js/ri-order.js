// --- HOBIS RI-ORDER MODULE ---
// Purchase request aggregation for Ir-192 / Se-75 / Co-60

var roRawRows = [];       // parsed rows from XLS
var roFileName = '';       // loaded file name
var roSpecialCompany = ''; // from localStorage

var RO_LS_KEY_COMPANY = 'hobis_ro_special_company';
var RO_LS_KEY_SHEET   = 'hobis_ro_sheet_url';

var IR192_CI_BUCKETS = [20, 30, 40, 50, 60, 70, 80, 90, 100];
var SE75_CI_BUCKETS  = [40, 50, 60, 70, 80];

// Column header mappings (Korean → key)
var RO_COL_MAP = {
    '회원등급': 'region',
    '회사명':   'company',
    '핵종':     'isotope',
    '모델':     'model',
    '방사능량': 'activity',
    '단위':     'unit',
    '수량':     'quantity',
    '구입예정일': 'purchaseDate',
    '상태':     'status',
    '기타':     'remarks'
};

function roInit() {
    roSpecialCompany = localStorage.getItem(RO_LS_KEY_COMPANY) || '';
    var sheetUrl = localStorage.getItem(RO_LS_KEY_SHEET) || '';
    var compInput = document.getElementById('roCompanyInput');
    var sheetInput = document.getElementById('roSheetUrl');
    if (compInput) compInput.value = roSpecialCompany;
    if (sheetInput) sheetInput.value = sheetUrl;
}

function roSaveSettings() {
    var comp = document.getElementById('roCompanyInput').value.trim();
    var url  = document.getElementById('roSheetUrl').value.trim();
    localStorage.setItem(RO_LS_KEY_COMPANY, comp);
    localStorage.setItem(RO_LS_KEY_SHEET, url);
    roSpecialCompany = comp;
    roShowToast('Settings saved');
}

function roOpenSheet() {
    var url = document.getElementById('roSheetUrl').value.trim();
    if (!url) { roShowToast('No URL configured'); return; }
    window.open(url, '_blank');
}

function roShowToast(msg) {
    var el = document.getElementById('roToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 2000);
}

// --- File Import ---

function roHandleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    roFileName = file.name;
    document.getElementById('roFileStatus').textContent = file.name + ' loading...';
    document.getElementById('roFileStatus').style.color = 'var(--hobis-cyan)';

    // Read as both ArrayBuffer (for SheetJS) and text (for HTML fallback)
    var readerBuf = new FileReader();
    readerBuf.onload = function(ev) {
        try {
            roParseFile(ev.target.result);
        } catch (err) {
            document.getElementById('roFileStatus').textContent = 'Parse error: ' + err.message;
            document.getElementById('roFileStatus').style.color = 'var(--hobis-alert)';
        }
    };
    readerBuf.readAsArrayBuffer(file);
}

function roParseFile(arrayBuf) {
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS library not loaded');
    }

    var data = new Uint8Array(arrayBuf);

    // Try SheetJS first
    var wb = XLSX.read(data, { type: 'array' });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // If SheetJS returned 0 rows, it may be an HTML frameset .xls
    if (json.length === 0) {
        // Decode as text and try HTML table parsing
        var text = new TextDecoder('utf-8').decode(data);
        json = roParseHTMLTable(text);
        if (json.length === 0) {
            // Check if it's a frameset referencing a .files/ directory
            var frameMatch = text.match(/src="([^"]*sheet\d+\.htm)"/);
            var hint = frameMatch
                ? '\n\n(.files/ 폴더 안의 ' + frameMatch[1].split('/').pop() + ' 파일을 선택하세요)'
                : '';
            throw new Error('데이터를 찾을 수 없습니다. .xls 프레임셋 파일인 경우 .files/ 폴더의 .htm 파일을 업로드하세요.' + hint);
        }
    }

    roNormalizeRows(json);
}

function roParseHTMLTable(data) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(data, 'text/html');
    var rows = doc.querySelectorAll('table tr');
    if (rows.length < 2) return [];

    // First row = headers
    var headers = [];
    rows[0].querySelectorAll('td, th').forEach(function(cell) {
        headers.push(cell.textContent.trim());
    });
    if (headers.length === 0) return [];

    // Data rows
    var result = [];
    for (var i = 1; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td, th');
        if (cells.length === 0) continue;
        var obj = {};
        headers.forEach(function(h, idx) {
            obj[h] = idx < cells.length ? cells[idx].textContent.trim() : '';
        });
        // Skip empty rows
        if (obj[headers[0]] || obj[headers[1]]) {
            result.push(obj);
        }
    }
    return result;
}

function roNormalizeRows(json) {
    roRawRows = json.map(function(row) {
        var out = {};
        Object.keys(row).forEach(function(k) {
            var trimmed = k.trim();
            var mapped = RO_COL_MAP[trimmed];
            var val = row[k];
            // Handle Date objects from SheetJS
            if (val instanceof Date) {
                val = roDateStr(val);
            } else if (typeof val === 'string') {
                val = val.trim();
            }
            if (mapped) {
                out[mapped] = val;
            } else {
                out[trimmed] = val;
            }
        });
        // Ensure numeric fields
        out.activity = parseFloat(out.activity) || 0;
        out.quantity = parseInt(out.quantity, 10) || 0;
        return out;
    });

    document.getElementById('roFileStatus').textContent =
        roFileName + ' (' + roRawRows.length + ' rows loaded)';
    document.getElementById('roFileStatus').style.color = 'var(--hobis-green)';
}

// --- Date Helpers ---

function roParseDate(val) {
    if (!val) return null;
    var s = String(val).trim();
    // Handle various formats: "2026-03-09", "2026.03.09", "2026/03/09", Excel serial, etc.
    // Excel serial number
    if (/^\d{5}$/.test(s)) {
        var d = new Date((parseInt(s, 10) - 25569) * 86400000);
        return isNaN(d.getTime()) ? null : d;
    }
    // Try standard parse after normalizing separators
    s = s.replace(/\./g, '-').replace(/\//g, '-');
    // Handle "YYYY-MM-DD HH:MM:SS" -> take date part
    s = s.split(' ')[0];
    var parts = s.split('-');
    if (parts.length === 3) {
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function roDateStr(d) {
    if (!d) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
}

// --- Aggregation ---

function roAggregate() {
    if (roRawRows.length === 0) {
        roShowToast('No data loaded');
        return;
    }

    var startStr = document.getElementById('roDateStart').value;
    var endStr   = document.getElementById('roDateEnd').value;
    var startDate = startStr ? new Date(startStr + 'T00:00:00') : null;
    var endDate   = endStr   ? new Date(endStr + 'T23:59:59') : null;

    roSpecialCompany = document.getElementById('roCompanyInput').value.trim();

    // Filter rows
    var filtered = [];
    var anomalies = [];

    roRawRows.forEach(function(row) {
        // Exclude cancelled
        if (row.status === '취소') return;

        // Date filter
        var pd = roParseDate(row.purchaseDate);
        if (startDate && pd && pd < startDate) return;
        if (endDate && pd && pd > endDate) return;

        // Classify
        var isotope = String(row.isotope || '').trim();
        if (isotope === 'Ir-192' || isotope === 'Se-75' || isotope === 'Co-60') {
            filtered.push(row);
        } else if (isotope) {
            anomalies.push({ type: 'unknown_isotope', row: row, detail: 'Unknown isotope: ' + isotope });
        }
    });

    // Build tables
    var ir192 = roBuildIr192(filtered, anomalies);
    var se75  = roBuildSe75(filtered, anomalies);
    var co60  = roBuildCo60(filtered);

    // Render
    roRenderTables(ir192, se75, co60, anomalies, filtered.length);
}

function roMapCiBucket(activity, isotope, buckets) {
    // Special rule: 49Ci Ir-192 → 50Ci
    if (isotope === 'Ir-192' && activity === 49) {
        return 50;
    }
    // Check if value matches a bucket
    if (buckets.indexOf(activity) >= 0) {
        return activity;
    }
    return null; // non-standard
}

function roBuildIr192(rows, anomalies) {
    var matrix = { '수도권': {}, '지방': {}, 'special': {} };
    IR192_CI_BUCKETS.forEach(function(ci) {
        matrix['수도권'][ci] = 0;
        matrix['지방'][ci] = 0;
        matrix['special'][ci] = 0;
    });

    rows.forEach(function(row) {
        if (row.isotope !== 'Ir-192') return;
        var bucket = roMapCiBucket(row.activity, 'Ir-192', IR192_CI_BUCKETS);

        if (bucket === null) {
            anomalies.push({ type: 'nonstandard_ci', row: row, detail: 'Ir-192 non-standard Ci: ' + row.activity });
            return;
        }

        var company = String(row.company || '');
        var region  = String(row.region || '');

        // Special company check
        if (roSpecialCompany && company === roSpecialCompany) {
            matrix['special'][bucket] += row.quantity;
        } else if (region === '수도권') {
            matrix['수도권'][bucket] += row.quantity;
        } else if (region === '지방') {
            matrix['지방'][bucket] += row.quantity;
        } else if (region === '해외') {
            // Overseas non-special: anomaly
            anomalies.push({ type: 'overseas_ir192', row: row, detail: 'Overseas non-special Ir-192: ' + company });
        } else {
            anomalies.push({ type: 'unknown_region', row: row, detail: 'Unknown region for Ir-192: ' + region + ' / ' + company });
        }
    });

    return matrix;
}

function roBuildSe75(rows, anomalies) {
    var matrix = { '수도권': {}, '지방': {}, '해외': {} };
    SE75_CI_BUCKETS.forEach(function(ci) {
        matrix['수도권'][ci] = 0;
        matrix['지방'][ci] = 0;
        matrix['해외'][ci] = 0;
    });

    rows.forEach(function(row) {
        if (row.isotope !== 'Se-75') return;
        var bucket = roMapCiBucket(row.activity, 'Se-75', SE75_CI_BUCKETS);

        if (bucket === null) {
            anomalies.push({ type: 'nonstandard_ci', row: row, detail: 'Se-75 non-standard Ci: ' + row.activity });
            return;
        }

        var region = String(row.region || '');
        if (matrix[region]) {
            matrix[region][bucket] += row.quantity;
        } else {
            anomalies.push({ type: 'unknown_region', row: row, detail: 'Unknown region for Se-75: ' + region + ' / ' + row.company });
        }
    });

    return matrix;
}

function roBuildCo60(rows) {
    var list = [];
    rows.forEach(function(row) {
        if (row.isotope !== 'Co-60') return;
        list.push({
            isotope:  row.isotope,
            model:    row.model || '',
            activity: row.activity,
            quantity: row.quantity,
            company:  row.company || ''
        });
    });
    return list;
}

// --- Rendering ---

function roRenderTables(ir192, se75, co60, anomalies, totalFiltered) {
    var resultDiv = document.getElementById('roResults');
    var specialLabel = roSpecialCompany || '(special company)';

    // Summary
    var html = '<div class="ro-summary">Filtered: <span style="color:var(--hobis-green);">' +
        totalFiltered + '</span> orders (cancelled excluded)</div>';

    // Ir-192 table
    html += roRenderMatrix('Ir-192', IR192_CI_BUCKETS,
        [{ key: '수도권', label: '수도권' }, { key: '지방', label: '지방' }, { key: 'special', label: specialLabel }],
        ir192, 'roIr192Table');

    // Se-75 table
    html += roRenderMatrix('Se-75', SE75_CI_BUCKETS,
        [{ key: '수도권', label: '수도권' }, { key: '지방', label: '지방' }, { key: '해외', label: '해외' }],
        se75, 'roSe75Table');

    // Co-60 table
    html += '<div class="ro-table-section">';
    html += '<div class="ro-table-header"><span>Co-60</span>';
    html += '<button class="btn-outline ro-copy-btn" onclick="roCopyTable(\'roCo60Table\')">COPY</button></div>';
    html += '<table class="ro-table" id="roCo60Table"><thead><tr>';
    html += '<th>핵종</th><th>모델</th><th>방사능량</th><th>수량</th><th>업체</th></tr></thead><tbody>';
    if (co60.length === 0) {
        html += '<tr><td colspan="5" style="text-align:center; color:#5f7481;">No Co-60 orders</td></tr>';
    } else {
        co60.forEach(function(item) {
            html += '<tr><td>' + item.isotope + '</td><td>' + item.model + '</td><td>' +
                item.activity + '</td><td>' + item.quantity + '</td><td>' + item.company + '</td></tr>';
        });
    }
    html += '</tbody></table></div>';

    // Anomalies
    if (anomalies.length > 0) {
        html += '<div class="ro-anomaly-section">';
        html += '<div class="ro-anomaly-header">ANOMALY REPORT (' + anomalies.length + ')</div>';
        anomalies.forEach(function(a) {
            var rowInfo = a.row.company ? (a.row.company + ' / ' + a.row.isotope + ' / ' +
                a.row.activity + 'Ci x' + a.row.quantity) : '';
            html += '<div class="ro-anomaly-item"><span class="ro-anomaly-type">' +
                roAnomalyLabel(a.type) + '</span> ' + a.detail;
            if (rowInfo) html += '<div class="ro-anomaly-detail">' + rowInfo + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }

    resultDiv.innerHTML = html;
}

function roAnomalyLabel(type) {
    var labels = {
        'overseas_ir192': 'OVERSEAS',
        'nonstandard_ci': 'NON-STD CI',
        'unknown_isotope': 'UNKNOWN ISO',
        'unknown_region': 'UNKNOWN REGION'
    };
    return labels[type] || type;
}

function roRenderMatrix(title, buckets, regionDefs, matrix, tableId) {
    var html = '<div class="ro-table-section">';
    html += '<div class="ro-table-header"><span>' + title + '</span>';
    html += '<button class="btn-outline ro-copy-btn" onclick="roCopyTable(\'' + tableId + '\')">COPY</button></div>';
    html += '<table class="ro-table" id="' + tableId + '"><thead><tr><th>구분</th>';
    buckets.forEach(function(ci) { html += '<th>' + ci + 'Ci</th>'; });
    html += '<th>합계</th></tr></thead><tbody>';

    var colTotals = {};
    buckets.forEach(function(ci) { colTotals[ci] = 0; });
    var grandTotal = 0;

    regionDefs.forEach(function(rd) {
        var rowTotal = 0;
        html += '<tr><td class="ro-region-cell">' + rd.label + '</td>';
        buckets.forEach(function(ci) {
            var val = matrix[rd.key][ci] || 0;
            rowTotal += val;
            colTotals[ci] += val;
            html += '<td class="ro-num-cell">' + (val || '') + '</td>';
        });
        grandTotal += rowTotal;
        html += '<td class="ro-num-cell ro-total-cell">' + (rowTotal || '') + '</td></tr>';
    });

    // Total row
    html += '<tr class="ro-total-row"><td class="ro-region-cell">합계</td>';
    buckets.forEach(function(ci) {
        html += '<td class="ro-num-cell ro-total-cell">' + (colTotals[ci] || '') + '</td>';
    });
    html += '<td class="ro-num-cell ro-total-cell ro-grand-total">' + (grandTotal || '') + '</td></tr>';

    html += '</tbody></table></div>';
    return html;
}

// --- Clipboard Copy ---

function roCopyTable(tableId) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var rows = table.querySelectorAll('tr');
    var lines = [];
    rows.forEach(function(tr) {
        var cells = [];
        tr.querySelectorAll('th, td').forEach(function(cell) {
            cells.push(cell.textContent.trim());
        });
        lines.push(cells.join('\t'));
    });

    var text = lines.join('\n');
    navigator.clipboard.writeText(text).then(function() {
        roShowToast(tableId.replace('ro', '').replace('Table', '') + ' copied');
    }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        roShowToast('Copied');
    });
}
