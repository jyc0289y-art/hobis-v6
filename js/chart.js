// --- HOBIS CHART MODULE ---
// Graph rendering (V4.5 SPEC: clean line + points on hover)

function drawChart(L, D, lbl, xl, mx, my, startDate) {
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('opsChart').getContext('2d');
    let idx = 0, min = 9e9;
    L.forEach((v, i) => { let d = Math.abs(v - mx); if (d < min) { min = d; idx = i; } });
    const P = Array(L.length).fill(null);
    P[idx] = my;

    Chart.defaults.color = '#5f7481';
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: L,
            datasets: [{
                label: lbl, data: D, borderColor: '#00ff33', backgroundColor: 'rgba(0,255,51,0.1)',
                fill: true, pointRadius: 0, pointHoverRadius: 6, borderWidth: 2, tension: 0.4
            }, {
                label: 'Result', data: P, borderColor: '#ff9900', backgroundColor: '#ff9900',
                pointRadius: 6, type: 'scatter'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    enabled: true, mode: 'index', intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += context.parsed.y.toExponential(2);
                            if (startDate && xl === "Days") {
                                const dateStr = addDays(startDate, context.parsed.x);
                                label += ` (${dateStr})`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: xl }, grid: { color: '#1f2b33' } },
                y: { title: { display: true, text: lbl }, grid: { color: '#1f2b33' } }
            }
        }
    });
}
