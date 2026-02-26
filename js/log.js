// --- HOBIS LOG MODULE ---
// Log management, CSV export, result display

function addToLog(d) {
    logHistory.push(d);
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `<span class="log-time">[${d.timestamp}]</span> <span class="log-mode">${d.mode}</span> <span class="log-result">${d.resultVal} ${d.resultUnit}</span>`;
    document.getElementById('logContainer').prepend(div);
}

function clearLog() {
    logHistory = [];
    document.getElementById('logContainer').innerHTML = "Ready.";
}

function downloadCSV() {
    if (logHistory.length === 0) return alert("Empty");
    let csv = "\uFEFFTime,Mode,Res,Unit\n";
    logHistory.forEach(r => csv += `${r.timestamp},${r.mode},${r.resultVal},${r.resultUnit}\n`);
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    l.download = "LOG.csv";
    l.click();
}

function showResult(m, s) {
    document.getElementById('resMain').innerText = m;
    document.getElementById('resSub').innerText = s;
}
