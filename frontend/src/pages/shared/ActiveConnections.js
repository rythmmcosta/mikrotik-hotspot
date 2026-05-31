import { renderSidebar } from '../../components/Sidebar.js';
import { DataTable, StatusBadge } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success } from '../../components/Toast.js';
import { api } from '../../api/client.js';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, b = bytes;
    while (b >= 1024 && i < 3) { b /= 1024; i++; }
    return b.toFixed(1) + ' ' + units[i];
}

function formatUptime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m}m ${s}s`;
}

export async function renderActiveConnections(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>Active Connections</h2>
                    <div class="flex gap-2">
                        <span id="conn-count" class="badge badge-blue">0 online</span>
                        <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                    </div>
                </div>
                <div id="connections-content">Loading...</div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    async function load() {
        try {
            const connections = await api.get('/connections/active');
            container.querySelector('#conn-count').textContent = `${connections.length} online`;

            const cols = [
                { key: 'hotspot_username', label: 'Username' },
                { key: 'user_type', label: 'Type', render: v => StatusBadge(v) },
                { key: 'ip_address', label: 'IP Address' },
                { key: 'mac_address', label: 'MAC' },
                { key: 'bytes_in', label: '↓ Downloaded', render: v => formatBytes(v) },
                { key: 'bytes_out', label: '↑ Uploaded', render: v => formatBytes(v) },
                { key: 'uptime_seconds', label: 'Uptime', render: v => formatUptime(v) },
                { key: 'connected_at', label: 'Connected At', render: v => new Date(v).toLocaleTimeString() },
            ];

            const table = DataTable(cols, connections, {
                actions: [{
                    label: '⏹ Terminate', className: 'btn-danger',
                    onClick: (row) => {
                        Modal({
                            title: 'Terminate Connection',
                            content: `<p>Disconnect <strong>${row.hotspot_username}</strong> (${row.ip_address})?</p>`,
                            confirmLabel: 'Terminate',
                            confirmClass: 'btn-danger',
                            onConfirm: async () => {
                                await api.post(`/connections/${row.id}/terminate`, {});
                                success(`${row.hotspot_username} disconnected`);
                                load();
                            },
                        });
                    },
                }],
            });

            const content = container.querySelector('#connections-content');
            content.innerHTML = '';
            content.appendChild(table);
        } catch (err) {
            container.querySelector('#connections-content').innerHTML =
                `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    const interval = setInterval(load, 15000);
    const obs = new MutationObserver(() => {
        if (!document.contains(container)) { clearInterval(interval); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true });
}
