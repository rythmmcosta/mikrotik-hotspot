import { createWSClient } from '../core/ws.js';
import { authStore } from '../store/auth.js';
import { api } from '../api/client.js';
import { success } from './Toast.js';

const PAGE_TITLES = {
    '/dashboard':           'Dashboard',
    '/guests/queue':        'Guest Queue',
    '/connections/active':  'Active Connections',
    '/connections/history': 'Connection History',
    '/profile':             'My Profile',
    '/employees':           'Employees',
    '/assets':              'Office Assets',
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
let _queueWsClient = null;
let _pendingQueueCount = 0;
let _topbarEl = null;
let _hashChangeHandler = null;

function _icon(name, size = 18) {
    return `<iconify-icon icon="${name}" width="${size}" height="${size}"></iconify-icon>`;
}

export function renderTopbar(container) {
    const path = window.location.hash.slice(1) || '/dashboard';
    const title = _getTitle(path);
    const user = authStore.getUser();
    const avatarUrl = authStore.getAvatar();
    const displayName = authStore.getDisplayName();

    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.id = 'topbar';
    topbar.innerHTML = `
        <div class="topbar-left">
            <span class="topbar-title" id="topbar-title">${title}</span>
        </div>
        <div class="topbar-right">
            <!-- System gauges -->
            <div class="gauge-item" title="Router CPU">
                <span class="gauge-label">CPU</span>
                <span class="gauge-value" id="gauge-cpu-val">—</span>
            </div>
            <div class="gauge-item" title="Router RAM">
                <span class="gauge-label">RAM</span>
                <span class="gauge-value" id="gauge-ram-val">—</span>
            </div>
            <div class="gauge-item" title="Network">
                <span class="gauge-up">▲</span>
                <span class="gauge-value" id="gauge-tx">—</span>
                <span class="gauge-down">▼</span>
                <span class="gauge-value" id="gauge-rx">—</span>
            </div>

            <!-- Notification bell -->
            <div style="position:relative">
                <button class="topbar-icon-btn" id="notif-btn" title="Notifications">
                    ${_icon('tabler:bell', 18)}
                    <span class="notif-badge" id="notif-badge" style="display:none">0</span>
                </button>
                <div class="notif-panel" id="notif-panel">
                    <div class="notif-panel-header">Recent Events</div>
                    <div id="notif-list"><div style="padding:12px;font-size:0.78rem;color:var(--text-muted)">Loading…</div></div>
                </div>
            </div>

            <!-- User chip -->
            <a href="#/profile" class="gauge-item" style="gap:6px;text-decoration:none;cursor:pointer" title="My Profile">
                <img src="${avatarUrl}" alt="avatar" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=user'">
                <span style="font-family:var(--font-ui);font-size:0.78rem;font-weight:600;color:var(--text-main)">${displayName}</span>
                <span style="font-size:0.65rem;text-transform:uppercase;color:var(--accent-rx)">${user?.role || ''}</span>
            </a>
        </div>
    `;

    _topbarEl = topbar;
    container.appendChild(topbar);

    // Notification panel
    const notifBtn = topbar.querySelector('#notif-btn');
    const notifPanel = topbar.querySelector('#notif-panel');
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifPanel.classList.toggle('open');
        if (notifPanel.classList.contains('open')) {
            _loadNotifications();
            _resetQueueBadge();
        }
    });
    document.addEventListener('click', () => notifPanel?.classList.remove('open'));

    // Reset badge when navigating to guest queue
    _hashChangeHandler = () => {
        _updateTitle();
        if (window.location.hash === '#/guests/queue') _resetQueueBadge();
    };
    window.addEventListener('hashchange', _hashChangeHandler);

    // Connect to metrics WebSocket for router stats
    _connectMetrics();

    // Connect to queue WebSocket for live guest notifications
    _connectQueue();

    return topbar;
}

function _getTitle(path) {
    if (/^\/assets\/\d+$/.test(path)) return 'Asset Detail';
    return PAGE_TITLES[path] || 'HotspotMgr';
}

function _updateTitle() {
    const path = window.location.hash.slice(1) || '/dashboard';
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = _getTitle(path);
}

async function _loadNotifications() {
    const listEl = document.getElementById('notif-list');
    const badgeEl = document.getElementById('notif-badge');
    if (!listEl) return;
    try {
        const data = await api.get('/audit?per_page=10&page=1');
        const items = data.items || [];
        if (!items.length) {
            listEl.innerHTML = '<div class="empty-state" style="padding:16px">No recent events</div>';
            return;
        }
        listEl.innerHTML = items.map(a => `
            <div class="notif-item">
                <span>${a.action || ''} ${a.resource_type ? '· ' + a.resource_type : ''}</span>
                <small>${a.username || ''} · ${_timeAgo(a.created_at)}</small>
            </div>
        `).join('');
        if (badgeEl && items.length) {
            badgeEl.textContent = items.length;
            badgeEl.style.display = 'flex';
        }
    } catch {
        listEl.innerHTML = '<div class="notif-item" style="color:var(--text-muted)">Unavailable</div>';
    }
}

function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function _connectMetrics() {
    if (_wsClient) _wsClient.close();
    _wsClient = createWSClient('metrics');
    _wsClient.on('metrics', (data) => {
        const cpu = data.cpu_percent != null ? `${data.cpu_percent.toFixed(0)}%` : '—';
        const ram = data.ram_percent != null ? `${data.ram_percent.toFixed(0)}%` : '—';
        const tx = data.tx_bps != null ? _fmt(data.tx_bps) : '—';
        const rx = data.rx_bps != null ? _fmt(data.rx_bps) : '—';

        _setVal('gauge-cpu-val', cpu, data.cpu_percent, 80);
        _setVal('gauge-ram-val', ram, data.ram_percent, 85);
        _setText('gauge-tx', tx);
        _setText('gauge-rx', rx);
    });
}

function _setVal(id, text, value, warnAt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = value != null && value > warnAt
        ? 'var(--accent-err)'
        : value > warnAt * 0.75
        ? 'var(--accent-warn)'
        : 'var(--text-main)';
}

function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _fmt(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)}K`;
    return `${bps}`;
}

function _connectQueue() {
    if (_queueWsClient) _queueWsClient.close();
    _queueWsClient = createWSClient('queue');
    _queueWsClient.on('new_guest', (msg) => {
        const data = msg.data || msg;
        _pendingQueueCount++;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = _pendingQueueCount;
            badge.style.display = 'flex';
        }
        const name = data.name || 'Guest';
        success(`New guest waiting: ${name}`);
    });
}

function _resetQueueBadge() {
    _pendingQueueCount = 0;
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
}

export function destroyTopbar() {
    if (_hashChangeHandler) { window.removeEventListener('hashchange', _hashChangeHandler); _hashChangeHandler = null; }
    if (_wsClient) { _wsClient.close(); _wsClient = null; }
    if (_queueWsClient) { _queueWsClient.close(); _queueWsClient = null; }
    _pendingQueueCount = 0;
    _topbarEl = null;
}
