// --- HOBIS V6 IMPORT/EXPORT MODULE ---
// JSON export and import with format auto-detection

function ioExportJson() {
    const json = storeExportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = now.getFullYear() +
        String(now.getMonth()+1).padStart(2,'0') +
        String(now.getDate()).padStart(2,'0') + '_' +
        String(now.getHours()).padStart(2,'0') +
        String(now.getMinutes()).padStart(2,'0');
    a.download = 'hobis_v6_' + ts + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function ioImportFile(event) {
    // Delegates to fcHandleFile which already handles both formats
    fcHandleFile(event);
}
