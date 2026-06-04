import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';
import { createWSClient } from '../../core/ws.js';

function fmtBytes(b) {
    if (!b) return '0 B';
    b = parseInt(b) || 0;
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (b >= 1024 && i < 3) { b /= 1024; i++; }
    return b.toFixed(1) + ' ' + units[i];
}

function fmtUptime(u) {
    if (!u) return '—';
    // Parse MikroTik uptime like "1h2m3s" or "2d3h" or "5m"
    const m = u.match(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!m) return u;
    const d = parseInt(m[1] || 0), h = parseInt(m[2] || 0), mn = parseInt(m[3] || 0);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${mn}m`;
    return `${mn}m ${parseInt(m[4] || 0)}s`;
}

export async function renderActiveConnections(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Active Connections</h2>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="conn-count" class="badge badge-blue">— online</span>
                            <button class="btn btn-ghost" id="refresh-btn">
                                <iconify-icon icon="tabler:refresh" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Refresh
                            </button>
                        </div>
                    </div>

                    <!-- Live router sessions (primary) -->
                    <div class="card" style="margin-bottom:16px">
                        <div class="card-header">
                            <h3 class="card-title">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;margin-right:6px;vertical-align:middle"></span>
                                Live Sessions (Router)
                            </h3>
                            <small class="text-muted">Real-time from MikroTik</small>
                        </div>
                        <div id="live-content" style="overflow-x:auto">
                            <div style="padding:24px;text-align:center;color:var(--text-muted)">
                                <iconify-icon icon="eos-icons:loading" width="24"></iconify-icon>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    function renderLiveSessions(sessions) {
        const liveEl = container.querySelector('#live-content');
        const countEl = container.querySelector('#conn-count');
        const count = Array.isArray(sessions) ? sessions.length : 0;
        countEl.textContent = `${count} online`;

        if (!count) {
            liveEl.innerHTML = '<p class="empty-state" style="padding:24px;text-align:center">No active sessions on router</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead><tr>
                <th>Username</th>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Uptime</th>
                <th>↓ Down</th>
                <th>↑ Up</th>
                <th>Actions</th>
            </tr></thead>
            <tbody>
                ${sessions.map(s => `
                    <tr>
                        <td><strong>${s['user'] || '—'}</strong></td>
                        <td class="mono">${s['address'] || '—'}</td>
                        <td class="mono">${s['mac-address'] || '—'}</td>
                        <td>${fmtUptime(s['uptime'])}</td>
                        <td>${fmtBytes(s['bytes-in'])}</td>
                        <td>${fmtBytes(s['bytes-out'])}</td>
                        <td><button class="btn-action btn-danger kick-btn" data-id="${s['.id']}" data-user="${s['user'] || ''}">⏹ Kick</button></td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        liveEl.innerHTML = '';
        liveEl.appendChild(table);

        liveEl.querySelectorAll('.kick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sessionId = btn.dataset.id;
                const username = btn.dataset.user;
                Modal(`<p>Disconnect <strong>${username}</strong> from the router?</p>`, {
                    title: 'Kick Session',
                    confirmLabel: 'Kick',
                    confirmClass: 'btn-danger',
                    onConfirm: async () => {
                        try {
                            await api.delete(`/mikrotik/hotspot/active/${encodeURIComponent(sessionId)}`);
                            success(`${username} disconnected`);
                            load();
                        } catch (err) { error(err.message); }
                    },
                });
            });
        });
    }

    async function load() {
        try {
            const sessions = await api.get('/mikrotik/hotspot/active');
            renderLiveSessions(sessions);
        } catch (err) {
            container.querySelector('#live-content').innerHTML =
                `<div class="alert alert-error" style="margin:16px">${err.message}</div>`;
            container.querySelector('#conn-count').textContent = '— online';
        }
    }

    // WebSocket live updates
    const ws = createWSClient('connections');
    ws.on('sessions_update', data => {
        if (data.sessions) renderLiveSessions(data.sessions);
        const countEl = container.querySelector('#conn-count');
        if (countEl) countEl.textContent = `${data.count ?? 0} online`;
    });

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    const interval = setInterval(load, 15000);
    const cleanup = () => {
        clearInterval(interval);
        ws.close();
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}
