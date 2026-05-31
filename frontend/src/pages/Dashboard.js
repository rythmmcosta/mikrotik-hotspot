import { renderSidebar } from '../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../components/Topbar.js';
import { createWSClient } from '../core/ws.js';
import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';
import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Filler, Tooltip);

const MAX_POINTS = 60;

function makeRollingChart(ctx, label, color) {
    const labels = Array(MAX_POINTS).fill('');
    const data = Array(MAX_POINTS).fill(null);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                backgroundColor: color.replace(')', ', 0.08)').replace('rgb', 'rgba'),
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                tension: 0.3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { display: false },
                y: {
                    min: 0,
                    ticks: { font: { size: 11 }, color: '#718096', maxTicksLimit: 5 },
                    grid: { color: 'rgba(0,0,0,.05)' },
                },
            },
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        },
    });
}

function pushPoint(chart, value) {
    chart.data.labels.push('');
    chart.data.labels.shift();
    chart.data.datasets[0].data.push(value);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

export async function renderDashboard(container) {
    let cpuChart, sessionsChart, wsConnections, wsMetrics;

    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="stats-grid" id="stats-grid">
                        <div class="stat-card skeleton"></div>
                        <div class="stat-card skeleton"></div>
                        <div class="stat-card skeleton"></div>
                        <div class="stat-card skeleton"></div>
                    </div>

                    <div class="charts-grid">
                        <div class="card">
                            <div class="card-header">
                                <span>Network Throughput (sessions/min)</span>
                                <span id="conn-count" class="badge badge-blue">— active</span>
                            </div>
                            <div style="padding:12px">
                                <div class="chart-container"><canvas id="chart-sessions"></canvas></div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <span>Router CPU Usage</span>
                                <span id="cpu-label" class="badge badge-gray">—</span>
                            </div>
                            <div style="padding:12px">
                                <div class="chart-container"><canvas id="chart-cpu"></canvas></div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-grid">
                        <div class="card">
                            <div class="card-header">
                                <h3>Guest Queue</h3>
                                <a href="#/guests/queue" class="btn-link">View All →</a>
                            </div>
                            <div id="queue-preview">
                                <div style="padding:16px"><div class="skeleton" style="height:40px;margin-bottom:8px"></div><div class="skeleton" style="height:40px"></div></div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3>Active Connections</h3>
                                <a href="#/connections/active" class="btn-link">View All →</a>
                            </div>
                            <div id="active-preview">
                                <div style="padding:16px"><div class="skeleton" style="height:40px;margin-bottom:8px"></div><div class="skeleton" style="height:40px"></div></div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    // Init charts
    cpuChart = makeRollingChart(
        document.getElementById('chart-cpu').getContext('2d'),
        'CPU %', 'rgb(78,115,223)'
    );
    sessionsChart = makeRollingChart(
        document.getElementById('chart-sessions').getContext('2d'),
        'Active Sessions', 'rgb(28,200,138)'
    );

    // WebSocket: active connections
    wsConnections = createWSClient('connections');
    wsConnections.on('message', (data) => {
        if (data.type === 'sessions_update') {
            const count = data.count ?? 0;
            pushPoint(sessionsChart, count);
            const el = document.getElementById('conn-count');
            if (el) el.textContent = `${count} active`;
            _refreshActivePreview(data.sessions);
        }
    });

    // WebSocket: router metrics
    wsMetrics = createWSClient('metrics');
    wsMetrics.on('metrics', (data) => {
        const cpu = data.cpu_percent ?? null;
        pushPoint(cpuChart, cpu);
        const el = document.getElementById('cpu-label');
        if (el) {
            el.textContent = cpu != null ? `${cpu.toFixed(1)}%` : '—';
            el.className = `badge ${cpu > 80 ? 'badge-red' : cpu > 60 ? 'badge-yellow' : 'badge-green'}`;
        }
    });

    // Load initial data
    try {
        const [stats, queue, active] = await Promise.all([
            api.get('/connections/stats'),
            api.get('/guests/queue'),
            api.get('/connections/active'),
        ]);

        const assetsData = authStore.isAdmin() || authStore.getUser()?.role === 'operator'
            ? await api.get('/assets').catch(() => [])
            : [];

        document.querySelector('#stats-grid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="color:var(--primary)">⬡</div>
                <div class="stat-value">${stats.active_count}</div>
                <div class="stat-label">Active Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color:var(--warning)">⏳</div>
                <div class="stat-value">${queue.length}</div>
                <div class="stat-label">Pending Approvals</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color:var(--success)">≡</div>
                <div class="stat-value">${stats.total_sessions_today}</div>
                <div class="stat-label">Sessions Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color:var(--info)">⊟</div>
                <div class="stat-value">${assetsData.length}</div>
                <div class="stat-label">Office Assets</div>
            </div>
        `;

        _renderQueuePreview(queue);
        _refreshActivePreview(active);

        // Seed sessions chart with current count
        pushPoint(sessionsChart, stats.active_count);

    } catch (err) {
        document.querySelector('#stats-grid').innerHTML =
            `<div class="alert alert-error col-span-4">${err.message}</div>`;
    }

    // Cleanup on route change
    const cleanup = () => {
        if (cpuChart) cpuChart.destroy();
        if (sessionsChart) sessionsChart.destroy();
        if (wsConnections) wsConnections.close();
        if (wsMetrics) wsMetrics.close();
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}

function _renderQueuePreview(queue) {
    const el = document.getElementById('queue-preview');
    if (!el) return;
    if (!queue.length) {
        el.innerHTML = '<p class="muted center" style="padding:20px">No pending approvals</p>';
        return;
    }
    el.innerHTML = queue.slice(0, 5).map(q => `
        <div class="list-item">
            <div>
                <strong>${q.full_name}</strong>
                <small>${q.email}</small>
            </div>
            <a href="#/guests/queue" class="badge badge-yellow">Pending</a>
        </div>
    `).join('');
}

function _refreshActivePreview(sessions) {
    const el = document.getElementById('active-preview');
    if (!el) return;
    const list = Array.isArray(sessions) ? sessions : [];
    if (!list.length) {
        el.innerHTML = '<p class="muted center" style="padding:20px">No active connections</p>';
        return;
    }
    el.innerHTML = list.slice(0, 5).map(c => `
        <div class="list-item">
            <div>
                <strong>${c.hotspot_username}</strong>
                <small>${c.ip_address} · ${c.mac_address}</small>
            </div>
            <span class="badge badge-green">${c.user_type}</span>
        </div>
    `).join('');
}
