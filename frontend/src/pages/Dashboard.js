import { renderSidebar } from '../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../components/Topbar.js';
import { createWSClient } from '../core/ws.js';
import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
import { GridStack } from 'gridstack';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const MAX_POINTS = 60;
const LAYOUT_KEY = 'hotspot_dashboard_layout';

// --- Gauge SVG (arc ring like MikroDash) ---
function _gaugeRing(pct, color) {
    const r = 32, cx = 40, cy = 40;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return `
        <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(99,130,190,.12)" stroke-width="6"/>
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
                    stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
                    transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dasharray .4s ease"/>
        </svg>`;
}

// --- Rolling Chart ---
function makeRollingChart(ctx, label, color) {
    const labels = Array(MAX_POINTS).fill('');
    const data = Array(MAX_POINTS).fill(null);
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label, data,
                borderColor: color,
                backgroundColor: color.replace(')', ', 0.08)').replace('rgb', 'rgba'),
                borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.3,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: {
                x: { display: false },
                y: {
                    min: 0,
                    ticks: { font: { size: 10, family: 'JetBrains Mono' }, color: 'rgba(148,163,190,.5)', maxTicksLimit: 4 },
                    grid: { color: 'rgba(99,130,190,.06)' },
                },
            },
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        },
    });
}

function pushPoint(chart, value) {
    chart.data.labels.push(''); chart.data.labels.shift();
    chart.data.datasets[0].data.push(value); chart.data.datasets[0].data.shift();
    chart.update('none');
}

// --- Card templates ---
function _cardHtml(id, content) {
    return `<div class="card" style="height:100%;display:flex;flex-direction:column;overflow:hidden">
        <div id="${id}-inner" style="flex:1;overflow:hidden">${content}</div>
    </div>`;
}

const CARDS = {
    'cpu-gauge': {
        title: 'CPU',
        html: () => `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px">
            <div id="gauge-cpu-ring">${_gaugeRing(0, '#38bdf8')}</div>
            <div class="gauge-arc-wrap">
                <div class="gauge-val" id="gauge-cpu-pct" style="color:var(--accent-rx)">—</div>
                <div class="gauge-lbl">Router CPU</div>
            </div>
        </div>`,
        w: 3, h: 3,
    },
    'ram-gauge': {
        title: 'RAM',
        html: () => `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px">
            <div id="gauge-ram-ring">${_gaugeRing(0, '#34d399')}</div>
            <div class="gauge-arc-wrap">
                <div class="gauge-val" id="gauge-ram-pct" style="color:var(--accent-tx)">—</div>
                <div class="gauge-lbl">Router RAM</div>
            </div>
        </div>`,
        w: 3, h: 3,
    },
    'sessions-count': {
        title: 'Sessions',
        html: () => `<div class="stat-card" style="height:100%;border:none;box-shadow:none;justify-content:center">
            <div class="stat-icon"><iconify-icon icon="line-md:wifi-loop" width="28" style="color:var(--primary)"></iconify-icon></div>
            <div class="stat-value" id="stat-sessions">—</div>
            <div class="stat-label">Active Sessions</div>
        </div>`,
        w: 3, h: 3,
    },
    'pending-count': {
        title: 'Pending',
        html: () => `<div class="stat-card" style="height:100%;border:none;box-shadow:none;justify-content:center">
            <div class="stat-icon"><iconify-icon icon="line-md:account-alert" width="28" style="color:var(--accent-warn)"></iconify-icon></div>
            <div class="stat-value" id="stat-pending">—</div>
            <div class="stat-label">Pending Approvals</div>
        </div>`,
        w: 3, h: 3,
    },
    'sessions-today': {
        title: 'Today',
        html: () => `<div class="stat-card" style="height:100%;border:none;box-shadow:none;justify-content:center">
            <div class="stat-icon"><iconify-icon icon="line-md:list-3" width="28" style="color:var(--accent-tx)"></iconify-icon></div>
            <div class="stat-value" id="stat-today">—</div>
            <div class="stat-label">Sessions Today</div>
        </div>`,
        w: 3, h: 3,
    },
    'asset-count': {
        title: 'Assets',
        html: () => `<div class="stat-card" style="height:100%;border:none;box-shadow:none;justify-content:center">
            <div class="stat-icon"><iconify-icon icon="line-md:computer" width="28" style="color:var(--accent-rx)"></iconify-icon></div>
            <div class="stat-value" id="stat-assets">—</div>
            <div class="stat-label">Office Assets</div>
        </div>`,
        w: 3, h: 3,
    },
    'network-chart': {
        title: 'Active Sessions',
        html: () => `<div style="padding:10px;height:100%;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-label);text-transform:uppercase;letter-spacing:.04em">Active Sessions</span>
                <span id="conn-count" class="badge badge-blue">— active</span>
            </div>
            <div style="flex:1;min-height:0"><canvas id="chart-sessions"></canvas></div>
        </div>`,
        w: 6, h: 4,
    },
    'cpu-chart': {
        title: 'Router CPU',
        html: () => `<div style="padding:10px;height:100%;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-label);text-transform:uppercase;letter-spacing:.04em">Router CPU Usage</span>
                <span id="cpu-label" class="badge badge-gray">—</span>
            </div>
            <div style="flex:1;min-height:0"><canvas id="chart-cpu"></canvas></div>
        </div>`,
        w: 6, h: 4,
    },
    'queue-preview': {
        title: 'Guest Queue',
        html: () => `<div style="height:100%;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px">
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-label);text-transform:uppercase;letter-spacing:.04em">Guest Queue</span>
                <a href="#/guests/queue" class="btn-link">View All</a>
            </div>
            <div id="queue-preview" style="flex:1;overflow-y:auto">
                <div class="empty-state">Loading…</div>
            </div>
        </div>`,
        w: 6, h: 4,
    },
    'active-preview': {
        title: 'Active Connections',
        html: () => `<div style="height:100%;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px">
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-label);text-transform:uppercase;letter-spacing:.04em">Active Connections</span>
                <a href="#/connections/active" class="btn-link">View All</a>
            </div>
            <div id="active-preview" style="flex:1;overflow-y:auto">
                <div class="empty-state">Loading…</div>
            </div>
        </div>`,
        w: 6, h: 4,
    },
};

const DEFAULT_LAYOUT = [
    { id: 'cpu-gauge',       x: 0, y: 0, w: 3, h: 3 },
    { id: 'ram-gauge',       x: 3, y: 0, w: 3, h: 3 },
    { id: 'sessions-count',  x: 6, y: 0, w: 3, h: 3 },
    { id: 'pending-count',   x: 9, y: 0, w: 3, h: 3 },
    { id: 'network-chart',   x: 0, y: 3, w: 6, h: 4 },
    { id: 'cpu-chart',       x: 6, y: 3, w: 6, h: 4 },
    { id: 'queue-preview',   x: 0, y: 7, w: 6, h: 4 },
    { id: 'active-preview',  x: 6, y: 7, w: 6, h: 4 },
];

export async function renderDashboard(container) {
    let cpuChart, sessionsChart, wsConnections, wsMetrics, grid;

    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content" id="dash-main">
                    <div class="page-header">
                        <h2>Dashboard</h2>
                        <button class="btn btn-ghost" id="edit-dash-btn" style="font-size:0.78rem;display:flex;align-items:center;gap:6px">
                            <iconify-icon icon="tabler:layout-grid-add" width="14"></iconify-icon>
                            <span id="edit-dash-label">Edit Layout</span>
                        </button>
                    </div>
                    <div class="grid-stack" id="dash-grid"></div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    // Load saved layout or use default
    let layout;
    try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || DEFAULT_LAYOUT; }
    catch { layout = DEFAULT_LAYOUT; }

    // Init GridStack
    grid = GridStack.init({
        column: 12,
        cellHeight: 60,
        animate: true,
        resizable: { handles: 'se' },
        draggable: { handle: '.card' },
        float: false,
        staticGrid: true, // start in view mode
    }, '#dash-grid');

    // Add cards from layout
    layout.forEach(item => {
        const card = CARDS[item.id];
        if (!card) return;
        grid.addWidget(`
            <div class="grid-stack-item" gs-id="${item.id}" gs-x="${item.x}" gs-y="${item.y}" gs-w="${item.w}" gs-h="${item.h}">
                <div class="grid-stack-item-content">
                    <div class="card" style="height:100%;overflow:hidden">${card.html()}</div>
                </div>
            </div>
        `);
    });

    // Edit mode toggle
    let editMode = false;
    const editBtn = container.querySelector('#edit-dash-btn');
    const editLabel = container.querySelector('#edit-dash-label');
    editBtn.addEventListener('click', () => {
        editMode = !editMode;
        grid.setStatic(!editMode);
        editLabel.textContent = editMode ? 'Save Layout' : 'Edit Layout';
        editBtn.querySelector('iconify-icon').setAttribute('icon', editMode ? 'tabler:check' : 'tabler:layout-grid-add');
        container.querySelector('#dash-main').classList.toggle('edit-mode', editMode);

        if (!editMode) {
            // Save layout
            const items = grid.save(false);
            const serialized = items.map(i => ({ id: i.id, x: i.x, y: i.y, w: i.w, h: i.h }));
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(serialized));
        }
    });

    // Init charts after DOM is ready
    requestAnimationFrame(() => {
        const cpuCtx = document.getElementById('chart-cpu');
        const sessCtx = document.getElementById('chart-sessions');
        if (cpuCtx) cpuChart = makeRollingChart(cpuCtx.getContext('2d'), 'CPU %', 'rgb(56,189,248)');
        if (sessCtx) sessionsChart = makeRollingChart(sessCtx.getContext('2d'), 'Sessions', 'rgb(52,211,153)');
    });

    // WebSocket: active connections
    wsConnections = createWSClient('connections');
    wsConnections.on('message', (data) => {
        if (data.type === 'sessions_update') {
            const count = data.count ?? 0;
            if (sessionsChart) pushPoint(sessionsChart, count);
            const el = document.getElementById('conn-count');
            if (el) el.textContent = `${count} active`;
            const statEl = document.getElementById('stat-sessions');
            if (statEl) statEl.textContent = count;
            _renderActivePreview(data.sessions);
        }
    });

    // WebSocket: router metrics
    wsMetrics = createWSClient('metrics');
    wsMetrics.on('metrics', (data) => {
        const cpu = data.cpu_percent ?? null;
        const ram = data.ram_percent ?? null;

        if (cpuChart && cpu != null) pushPoint(cpuChart, cpu);

        // CPU gauge
        if (cpu != null) {
            const ring = document.getElementById('gauge-cpu-ring');
            if (ring) ring.innerHTML = _gaugeRing(cpu, cpu > 80 ? '#f87171' : '#38bdf8');
            const pct = document.getElementById('gauge-cpu-pct');
            if (pct) { pct.textContent = `${cpu.toFixed(0)}%`; pct.style.color = cpu > 80 ? 'var(--accent-err)' : 'var(--accent-rx)'; }
            const lbl = document.getElementById('cpu-label');
            if (lbl) { lbl.textContent = `${cpu.toFixed(1)}%`; lbl.className = `badge ${cpu > 80 ? 'badge-red' : cpu > 60 ? 'badge-yellow' : 'badge-green'}`; }
        }

        // RAM gauge
        if (ram != null) {
            const ring = document.getElementById('gauge-ram-ring');
            if (ring) ring.innerHTML = _gaugeRing(ram, ram > 85 ? '#f87171' : '#34d399');
            const pct = document.getElementById('gauge-ram-pct');
            if (pct) { pct.textContent = `${ram.toFixed(0)}%`; pct.style.color = ram > 85 ? 'var(--accent-err)' : 'var(--accent-tx)'; }
        }
    });

    // Load initial data
    try {
        const [stats, queue, active] = await Promise.all([
            api.get('/connections/stats'),
            api.get('/guests/queue'),
            api.get('/connections/active'),
        ]);

        const assetsData = await api.get('/assets').catch(() => []);

        _setText('stat-pending', queue.length ?? 0);
        _setText('stat-today', stats.total_sessions_today ?? 0);
        _setText('stat-assets', Array.isArray(assetsData) ? assetsData.length : 0);

        _renderQueuePreview(queue);
        _renderActivePreview(active);

        // Prefer live MikroTik session count over stale DB count
        const dbSessions = stats.active_count ?? 0;
        _setText('stat-sessions', dbSessions);
        if (sessionsChart) pushPoint(sessionsChart, dbSessions);
    } catch { /* non-fatal */ }

    // Initial router metrics via HTTP (fills gauges before first WS push arrives)
    requestAnimationFrame(async () => {
        try {
            const [resources, routerSessions] = await Promise.all([
                api.get('/mikrotik/system/resources'),
                api.get('/mikrotik/hotspot/active').catch(() => []),
            ]);

            // CPU gauge
            const cpu = parseFloat(resources['cpu-load'] ?? 0);
            const cpuRing = document.getElementById('gauge-cpu-ring');
            if (cpuRing) cpuRing.innerHTML = _gaugeRing(cpu, cpu > 80 ? '#f87171' : '#38bdf8');
            const cpuPct = document.getElementById('gauge-cpu-pct');
            if (cpuPct) { cpuPct.textContent = `${cpu.toFixed(0)}%`; cpuPct.style.color = cpu > 80 ? 'var(--accent-err)' : 'var(--accent-rx)'; }
            const cpuLbl = document.getElementById('cpu-label');
            if (cpuLbl) { cpuLbl.textContent = `${cpu.toFixed(1)}%`; cpuLbl.className = `badge ${cpu > 80 ? 'badge-red' : cpu > 60 ? 'badge-yellow' : 'badge-green'}`; }
            if (cpuChart) pushPoint(cpuChart, cpu);

            // RAM gauge
            const totalMem = parseInt(resources['total-memory'] ?? 1);
            const freeMem = parseInt(resources['free-memory'] ?? 0);
            const ram = Math.round((totalMem - freeMem) / Math.max(totalMem, 1) * 100);
            const ramRing = document.getElementById('gauge-ram-ring');
            if (ramRing) ramRing.innerHTML = _gaugeRing(ram, ram > 85 ? '#f87171' : '#34d399');
            const ramPct = document.getElementById('gauge-ram-pct');
            if (ramPct) { ramPct.textContent = `${ram}%`; ramPct.style.color = ram > 85 ? 'var(--accent-err)' : 'var(--accent-tx)'; }

            // Live session count from router
            const liveCount = Array.isArray(routerSessions) ? routerSessions.length : 0;
            _setText('stat-sessions', liveCount);
            const connCountEl = document.getElementById('conn-count');
            if (connCountEl) connCountEl.textContent = `${liveCount} active`;
            if (sessionsChart) pushPoint(sessionsChart, liveCount);

            // Update topbar gauges immediately too
            const tvCpu = document.getElementById('gauge-cpu-val');
            if (tvCpu) tvCpu.textContent = `${cpu.toFixed(0)}%`;
            const tvRam = document.getElementById('gauge-ram-val');
            if (tvRam) tvRam.textContent = `${ram}%`;
        } catch { /* router not reachable — WS will fill in when ready */ }
    });

    // Cleanup
    const cleanup = () => {
        if (cpuChart) cpuChart.destroy();
        if (sessionsChart) sessionsChart.destroy();
        if (wsConnections) wsConnections.close();
        if (wsMetrics) wsMetrics.close();
        if (grid) grid.destroy();
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}

function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function _renderQueuePreview(queue) {
    const el = document.getElementById('queue-preview');
    if (!el) return;
    if (!queue.length) { el.innerHTML = '<p class="empty-state">No pending approvals</p>'; return; }
    el.innerHTML = queue.slice(0, 5).map(q => `
        <div class="list-item">
            <div><strong>${q.full_name}</strong><small>${q.email}</small></div>
            <a href="#/guests/queue" class="badge badge-yellow">Pending</a>
        </div>
    `).join('');
}

function _renderActivePreview(sessions) {
    const el = document.getElementById('active-preview');
    if (!el) return;
    const list = Array.isArray(sessions) ? sessions : [];
    if (!list.length) { el.innerHTML = '<p class="empty-state">No active connections</p>'; return; }
    el.innerHTML = list.slice(0, 5).map(c => `
        <div class="list-item">
            <div><strong>${c.hotspot_username}</strong><small class="mono">${c.ip_address}</small></div>
            <span class="badge badge-green">${c.user_type}</span>
        </div>
    `).join('');
}
