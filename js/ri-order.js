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
    var files = e.target.files;
    if (!files || files.length === 0) return;

    var allFiles = Array.from(files);
    var htmFile = allFiles.find(function(f) { return /\.htm[l]?$/i.test(f.name); });
    var csvFile = allFiles.find(function(f) { return /\.csv$/i.test(f.name); });
    var xlsFile = allFiles.find(function(f) { return /\.xlsx?$/i.test(f.name); });
    var primaryFile = htmFile || csvFile || xlsFile || allFiles[0];

    roFileName = primaryFile.name;
    document.getElementById('roFileStatus').textContent = primaryFile.name + ' loading...';
    document.getElementById('roFileStatus').style.color = 'var(--hobis-cyan)';

    var ext = primaryFile.name.split('.').pop().toLowerCase();

    // .htm → HTML 테이블 파싱
    if (ext === 'htm' || ext === 'html') {
        roReadAsText(primaryFile, function(text) {
            var json = roParseHTMLTable(text);
            if (json.length === 0) throw new Error('HTM 파일에서 데이터를 찾을 수 없습니다.');
            roNormalizeRows(json);
        });
        return;
    }

    // .csv → 텍스트 CSV 파싱 (EUC-KR 시도 → UTF-8 폴백)
    if (ext === 'csv') {
        roReadAsText(primaryFile, function(text) {
            var json = roParseCSV(text);
            if (json.length === 0) throw new Error('CSV 파일에서 데이터를 찾을 수 없습니다.');
            roNormalizeRows(json);
        }, 'EUC-KR');
        return;
    }

    // .xls/.xlsx → ArrayBuffer (SheetJS + frameset 폴백)
    var readerBuf = new FileReader();
    readerBuf.onload = function(ev) {
        try {
            roParseXLS(ev.target.result, allFiles);
        } catch (err) {
            document.getElementById('roFileStatus').textContent = 'Parse error: ' + err.message;
            document.getElementById('roFileStatus').style.color = 'var(--hobis-alert)';
        }
    };
    readerBuf.readAsArrayBuffer(primaryFile);
}

// 텍스트 읽기 헬퍼 (인코딩 지정 가능, 에러 핸들링 포함)
function roReadAsText(file, callback, encoding) {
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            callback(ev.target.result);
        } catch (err) {
            // EUC-KR로 깨지면 UTF-8로 재시도
            if (encoding && encoding !== 'UTF-8') {
                var reader2 = new FileReader();
                reader2.onload = function(ev2) {
                    try {
                        callback(ev2.target.result);
                    } catch (err2) {
                        document.getElementById('roFileStatus').textContent = 'Parse error: ' + err2.message;
                        document.getElementById('roFileStatus').style.color = 'var(--hobis-alert)';
                    }
                };
                reader2.readAsText(file, 'UTF-8');
                return;
            }
            document.getElementById('roFileStatus').textContent = 'Parse error: ' + err.message;
            document.getElementById('roFileStatus').style.color = 'var(--hobis-alert)';
        }
    };
    reader.readAsText(file, encoding || 'UTF-8');
}

// CSV 파싱 (쉼표 구분, 따옴표 지원)
function roParseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lines.length < 2) return [];

    var headers = roSplitCSVLine(lines[0]);
    var result = [];
    for (var i = 1; i < lines.length; i++) {
        var cols = roSplitCSVLine(lines[i]);
        if (cols.length === 0) continue;
        var obj = {};
        headers.forEach(function(h, idx) {
            obj[h.trim()] = idx < cols.length ? cols[idx].trim() : '';
        });
        if (obj[headers[0].trim()] || obj[headers[1] ? headers[1].trim() : '']) {
            result.push(obj);
        }
    }
    return result;
}

function roSplitCSVLine(line) {
    var result = [];
    var current = '';
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (inQuote) {
            if (c === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (c === '"') {
                inQuote = false;
            } else {
                current += c;
            }
        } else {
            if (c === '"') {
                inQuote = true;
            } else if (c === ',') {
                result.push(current);
                current = '';
            } else {
                current += c;
            }
        }
    }
    result.push(current);
    return result;
}

function roParseXLS(arrayBuf, allFiles) {
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS library not loaded');
    }

    var data = new Uint8Array(arrayBuf);

    // Try SheetJS first
    var wb = XLSX.read(data, { type: 'array' });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // SheetJS 성공
    if (json.length > 0) {
        roNormalizeRows(json);
        return;
    }

    // SheetJS 0행 → 텍스트로 디코딩하여 HTML table 또는 frameset 시도
    var text = new TextDecoder('utf-8').decode(data);

    // HTML 테이블 직접 파싱
    var htmlJson = roParseHTMLTable(text);
    if (htmlJson.length > 0) {
        roNormalizeRows(htmlJson);
        return;
    }

    // CSV 형태일 수 있음 (확장자만 .xls)
    var csvJson = roParseCSV(text);
    if (csvJson.length > 0) {
        roNormalizeRows(csvJson);
        return;
    }

    // Frameset 감지: href로 .htm 경로 추출
    var linkMatch = text.match(/href="([^"]*sheet\d+\.htm[l]?)"/i);
    if (linkMatch) {
        var htmName = linkMatch[1].split('/').pop();
        // allFiles에서 매칭되는 .htm 찾기
        var htmFile = (allFiles || []).find(function(f) {
            return f.name.toLowerCase() === htmName.toLowerCase();
        });
        if (htmFile) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var htmJson = roParseHTMLTable(ev.target.result);
                    if (htmJson.length === 0) throw new Error('HTM 파일에서 데이터를 찾을 수 없습니다.');
                    roNormalizeRows(htmJson);
                } catch (err) {
                    document.getElementById('roFileStatus').textContent = 'Parse error: ' + err.message;
                    document.getElementById('roFileStatus').style.color = 'var(--hobis-alert)';
                }
            };
            reader.readAsText(htmFile, 'utf-8');
            return;
        }
        throw new Error('프레임셋 XLS 감지. .xls 파일과 함께 .files/ 폴더의 ' + htmName + ' 파일도 선택하세요. (Ctrl/Cmd 클릭으로 다중 선택)');
    }
    throw new Error('데이터를 찾을 수 없습니다. CSV, XLS, 또는 HTM 파일을 확인하세요.');
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
    var specialLabel = fcEsc(roSpecialCompany || '(special company)');

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
            html += '<tr><td>' + fcEsc(item.isotope) + '</td><td>' + fcEsc(item.model) + '</td><td>' +
                fcEsc(item.activity) + '</td><td>' + fcEsc(item.quantity) + '</td><td>' + fcEsc(item.company) + '</td></tr>';
        });
    }
    html += '</tbody></table></div>';

    // Anomalies
    if (anomalies.length > 0) {
        html += '<div class="ro-anomaly-section">';
        html += '<div class="ro-anomaly-header">ANOMALY REPORT (' + anomalies.length + ')</div>';
        anomalies.forEach(function(a) {
            var rowInfo = a.row.company ? (fcEsc(a.row.company) + ' / ' + fcEsc(a.row.isotope) + ' / ' +
                fcEsc(a.row.activity) + 'Ci x' + fcEsc(a.row.quantity)) : '';
            html += '<div class="ro-anomaly-item"><span class="ro-anomaly-type">' +
                fcEsc(roAnomalyLabel(a.type)) + '</span> ' + fcEsc(a.detail);
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
