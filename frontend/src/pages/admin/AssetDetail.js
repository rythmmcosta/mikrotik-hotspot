import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { createWSClient } from '../../core/ws.js';
import { error } from '../../components/Toast.js';
import { api } from '../../api/client.js';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const MAX_POINTS = 60;

function makeChart(ctx, label, color) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(MAX_POINTS).fill(''),
            datasets: [{
                label,
                data: Array(MAX_POINTS).fill(null),
                borderColor: color,
                backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.08)'),
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                tension: 0.3,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: {
                x: { display: false },
                y: { min: 0, max: 100, ticks: { font: { size: 11 }, color: '#718096', maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.05)' } },
            },
            plugins: { legend: { display: false } },
        },
    });
}

function push(chart, value) {
    chart.data.labels.push('');
    chart.data.labels.shift();
    chart.data.datasets[0].data.push(value);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

export async function renderAssetDetail(container) {
    const hash = window.location.hash.slice(1);
    const assetId = parseInt(hash.split('/')[2]);

    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2 id="asset-title">Asset Detail</h2>
                        <a href="#/assets" class="btn btn-ghost">← Back</a>
                    </div>

                    <div id="asset-info" class="card" style="padding:16px;margin-bottom:16px">Loading...</div>

                    <div class="charts-grid">
                        <div class="card">
                            <div class="card-header">CPU %</div>
                            <div style="padding:12px"><div class="chart-container"><canvas id="chart-cpu"></canvas></div></div>
                        </div>
                        <div class="card">
                            <div class="card-header">RAM %</div>
                            <div style="padding:12px"><div class="chart-container"><canvas id="chart-ram"></canvas></div></div>
                        </div>
                    </div>

                    <div class="charts-grid">
                        <div class="card">
                            <div class="card-header">Network Sent (bytes)</div>
                            <div style="padding:12px"><div class="chart-container"><canvas id="chart-tx"></canvas></div></div>
                        </div>
                        <div class="card">
                            <div class="card-header">Network Received (bytes)</div>
                            <div style="padding:12px"><div class="chart-container"><canvas id="chart-rx"></canvas></div></div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">Recent Browsing Activity</div>
                        <div id="browsing-list" style="padding:12px">Loading...</div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    if (!assetId) {
        document.getElementById('asset-info').innerHTML = '<div class="alert alert-error">Invalid asset ID</div>';
        return;
    }

    let cpuChart, ramChart, txChart, rxChart, ws;

    try {
        const asset = await api.get(`/assets/${assetId}`);
        document.getElementById('asset-title').textContent = asset.name;
        document.getElementById('asset-info').innerHTML = `
            <div class="info-grid">
                <div><div style="font-size:11px;opacity:.6">Type</div><div>${asset.asset_type} / ${asset.connection_type}</div></div>
                <div><div style="font-size:11px;opacity:.6">MAC</div><div>${asset.mac_address}</div></div>
                <div><div style="font-size:11px;opacity:.6">IP</div><div>${asset.ip_address || '—'}</div></div>
                <div><div style="font-size:11px;opacity:.6">OS</div><div>${asset.os_type || '—'}</div></div>
                <div><div style="font-size:11px;opacity:.6">Hostname</div><div>${asset.hostname || '—'}</div></div>
                <div><div style="font-size:11px;opacity:.6">Status</div><div>
                    <span class="status-dot ${asset.status}" style="display:inline-block;margin-right:6px"></span>${asset.status}
                </div></div>
                <div><div style="font-size:11px;opacity:.6">Agent</div><div>${asset.agent_installed ? `v${asset.agent_version || '?'} (${asset.agent_last_seen ? new Date(asset.agent_last_seen).toLocaleString() : 'unknown'})` : 'Not installed'}</div></div>
            </div>
        `;

        // Init charts
        cpuChart = makeChart(document.getElementById('chart-cpu').getContext('2d'), 'CPU %', 'rgb(78,115,223)');
        ramChart = makeChart(document.getElementById('chart-ram').getContext('2d'), 'RAM %', 'rgb(28,200,138)');

        const txChartEl = document.getElementById('chart-tx').getContext('2d');
        const rxChartEl = document.getElementById('chart-rx').getContext('2d');
        txChart = new Chart(txChartEl, {
            type: 'line',
            data: { labels: Array(MAX_POINTS).fill(''), datasets: [{ data: Array(MAX_POINTS).fill(null), borderColor: 'rgb(246,194,62)', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { display: false }, y: { min: 0, ticks: { font: { size: 11 }, color: '#718096', maxTicksLimit: 4 }, grid: { color: 'rgba(0,0,0,.05)' } } }, plugins: { legend: { display: false } } },
        });
        rxChart = new Chart(rxChartEl, {
            type: 'line',
            data: { labels: Array(MAX_POINTS).fill(''), datasets: [{ data: Array(MAX_POINTS).fill(null), borderColor: 'rgb(54,185,204)', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { display: false }, y: { min: 0, ticks: { font: { size: 11 }, color: '#718096', maxTicksLimit: 4 }, grid: { color: 'rgba(0,0,0,.05)' } } }, plugins: { legend: { display: false } } },
        });

        // WebSocket for live metrics
        ws = createWSClient(`asset:${assetId}`);
        ws.on('metrics', (msg) => {
            const d = msg.data || {};
            push(cpuChart, d.cpu_percent ?? null);
            push(ramChart, d.ram_percent ?? null);
            push(txChart, d.net_bytes_sent ?? null);
            push(rxChart, d.net_bytes_recv ?? null);
        });

        // Load historical metrics
        const metrics = await api.get(`/assets/${assetId}/metrics?window=1h`);
        metrics.slice(-MAX_POINTS).forEach(m => {
            push(cpuChart, m.cpu_percent ?? null);
            push(ramChart, m.ram_percent ?? null);
            push(txChart, m.net_bytes_sent ?? null);
            push(rxChart, m.net_bytes_recv ?? null);
        });

        // Load browsing
        const browsing = await api.get(`/browsing?username=asset_${assetId}&per_page=20`).catch(() => ({ items: [] }));
        const bEl = document.getElementById('browsing-list');
        if (!browsing.items?.length) {
            bEl.innerHTML = '<p class="muted center">No browsing activity recorded</p>';
        } else {
            bEl.innerHTML = browsing.items.map(b => `
                <div class="list-item">
                    <div>
                        <strong>${b.domain}</strong>
                        <small>${b.query_type} · ${b.ip_address || '—'}</small>
                    </div>
                    <small style="opacity:.5">${b.queried_at ? new Date(b.queried_at).toLocaleTimeString() : ''}</small>
                </div>
            `).join('');
        }

    } catch (e) {
        document.getElementById('asset-info').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }

    const cleanup = () => {
        [cpuChart, ramChart, txChart, rxChart].forEach(c => c?.destroy());
        ws?.close();
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}
