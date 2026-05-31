import { createWSClient } from '../core/ws.js';
import { authStore } from '../store/auth.js';

const PAGE_TITLES = {
    '/dashboard':           'Dashboard',
    '/guests/queue':        'Guest Queue',
    '/connections/active':  'Active Connections',
    '/connections/history': 'Connection History',
    '/employees':           'Employees',
    '/assets':              'Assets',
    '/browsing':            'Browsing Log',
    '/policies':            'Usage Policies',
    '/settings':            'Settings',
    '/audit':               'Audit Log',
    '/router/interfaces':   'Interfaces',
    '/router/dhcp':         'DHCP',
    '/router/firewall':     'Firewall',
    '/router/dns':          'DNS',
    '/router/queues':       'Queues',
    '/router/hotspot':      'Hotspot Server',
    '/router/system':       'System Resources',
};

let _wsClient = null;
let _topbarEl = null;

export function renderTopbar(container) {
    const path = window.location.hash.slice(1) || '/dashboard';
    const title = PAGE_TITLES[path] || 'Dashboard';
    const user = authStore.getUser();

    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.id = 'topbar';
    topbar.innerHTML = `
        <div class="topbar-left">
            <span class="topbar-breadcrumb" id="topbar-title">${title}</span>
        </div>
        <div class="topbar-right">
            <div class="gauge-item" id="gauge-cpu" title="CPU Usage">
                <span class="gauge-label">CPU</span>
                <span class="gauge-value" id="gauge-cpu-val">—</span>
            </div>
            <div class="gauge-item" id="gauge-ram" title="RAM Usage">
                <span class="gauge-label">RAM</span>
                <span class="gauge-value" id="gauge-ram-val">—</span>
            </div>
            <div class="gauge-item" title="Network">
                <span class="gauge-up">▲</span>
                <span class="gauge-value" id="gauge-tx">—</span>
                <span class="gauge-down">▼</span>
                <span class="gauge-value" id="gauge-rx">—</span>
            </div>
            <div class="gauge-item">
                <span class="status-dot online"></span>
                <span class="gauge-label">${user?.username || ''}</span>
                <span class="user-badge ${user?.role}" style="margin-left:4px">${(user?.role || '').toUpperCase()}</span>
            </div>
        </div>
    `;

    _topbarEl = topbar;
    container.appendChild(topbar);

    // Update title on hash change
    window.addEventListener('hashchange', _updateTitle);

    // Connect to metrics WebSocket for router stats
    _connectMetrics();

    return topbar;
}

function _updateTitle() {
    const path = window.location.hash.slice(1) || '/dashboard';
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = PAGE_TITLES[path] || 'Dashboard';
}

function _connectMetrics() {
    if (_wsClient) _wsClient.close();
    _wsClient = createWSClient('metrics');
    _wsClient.on('metrics', (data) => {
        const cpu = data.cpu_percent != null ? `${data.cpu_percent.toFixed(0)}%` : '—';
        const ram = data.ram_percent != null ? `${data.ram_percent.toFixed(0)}%` : '—';
        const tx = data.tx_bps != null ? _formatBps(data.tx_bps) : '—';
        const rx = data.rx_bps != null ? _formatBps(data.rx_bps) : '—';

        _setGauge('gauge-cpu-val', cpu, data.cpu_percent, 80);
        _setGauge('gauge-ram-val', ram, data.ram_percent, 85);
        _setText('gauge-tx', tx);
        _setText('gauge-rx', rx);
    });
}

function _setGauge(id, text, value, warnThreshold) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = (value != null && value > warnThreshold) ? 'var(--danger)' : 'var(--text-primary)';
}

function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _formatBps(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)}K`;
    return `${bps}`;
}

export function destroyTopbar() {
    window.removeEventListener('hashchange', _updateTitle);
    if (_wsClient) {
        _wsClient.close();
        _wsClient = null;
    }
    _topbarEl = null;
}
