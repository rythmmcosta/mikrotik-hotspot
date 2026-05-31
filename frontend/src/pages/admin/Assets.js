import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { DataTable, StatusBadge } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

const STATUS_COLORS = { active: 'green', offline: 'gray', blocked: 'red' };

export async function renderAssets(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Office Assets</h2>
                        <button class="btn btn-primary" id="add-asset-btn">+ Add Asset</button>
                    </div>
                    <div class="toolbar">
                        <select class="input input-sm" id="filter-status">
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="offline">Offline</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <select class="input input-sm" id="filter-type">
                            <option value="">All Types</option>
                            <option value="wifi">WiFi</option>
                            <option value="lan">LAN</option>
                        </select>
                    </div>
                    <div class="card">
                        <div id="table-mount">Loading...</div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    let assets = [];

    async function loadAssets() {
        const status = document.getElementById('filter-status')?.value;
        const connType = document.getElementById('filter-type')?.value;
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (connType) params.set('connection_type', connType);
        try {
            const qs = params.toString();
            assets = await api.get('/assets' + (qs ? '?' + qs : ''));
            renderTable();
        } catch (err) {
            document.getElementById('table-mount').innerHTML =
                `<div class="alert alert-error" style="margin:16px">${err.message}</div>`;
        }
    }

    function renderTable() {
        const mount = document.getElementById('table-mount');
        if (!mount) return;
        mount.innerHTML = '';
        const table = DataTable(
            [
                { key: 'name', label: 'Name' },
                { key: 'asset_type', label: 'Type' },
                { key: 'mac_address', label: 'MAC Address' },
                { key: 'ip_address', label: 'IP' },
                { key: 'connection_type', label: 'Connection' },
                { key: 'status', label: 'Status', render: v => `<span class="badge badge-${STATUS_COLORS[v] || 'gray'}">${v}</span>` },
                { key: 'agent_installed', label: 'Agent', render: v => v ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">None</span>' },
                { key: 'agent_last_seen', label: 'Last Seen', render: v => v ? new Date(v).toLocaleString() : '—' },
            ],
            assets,
            {
                actions: [
                    { label: 'Detail', className: 'btn-ghost', onClick: (row) => { window.location.hash = `#/assets/${row.id}`; } },
                    { label: 'Token', className: 'btn-ghost', onClick: (row) => generateToken(row) },
                    { label: 'Block', className: 'btn-danger', onClick: (row) => toggleBlock(row) },
                    { label: 'Delete', className: 'btn-danger', onClick: (row) => deleteAsset(row) },
                ],
            }
        );
        mount.appendChild(table);
    }

    async function generateToken(asset) {
        try {
            const result = await api.post('/assets/generate-token', { asset_id: asset.id });
            Modal(`
                <p style="margin-bottom:12px">Agent token for <strong>${asset.name}</strong>:</p>
                <div class="code-block" style="word-break:break-all;font-size:12px">${result.token}</div>
                <p style="margin-top:10px;font-size:12px;opacity:.6">Copy this into agent_config.ini — it won't be shown again.</p>
            `, { title: 'Agent Token', cancelLabel: 'Close' });
        } catch (e) { error(e.message); }
    }

    async function toggleBlock(asset) {
        const endpoint = asset.status === 'blocked' ? 'unblock' : 'block';
        try {
            await api.post(`/assets/${asset.id}/${endpoint}`, {});
            success(`Asset ${endpoint}ed`);
            loadAssets();
        } catch (e) { error(e.message); }
    }

    async function deleteAsset(asset) {
        if (!confirm(`Delete asset "${asset.name}"?`)) return;
        try {
            await api.delete(`/assets/${asset.id}`);
            success('Asset deleted');
            loadAssets();
        } catch (e) { error(e.message); }
    }

    function showAddModal() {
        const content = `
            <div class="form-group"><label>Name</label><input class="input" id="asset-name" placeholder="John's Laptop"></div>
            <div class="form-group"><label>MAC Address</label><input class="input" id="asset-mac" placeholder="AA:BB:CC:DD:EE:FF"></div>
            <div class="form-group"><label>Connection Type</label>
                <select class="input" id="asset-conn">
                    <option value="wifi">WiFi (MAC auto-auth)</option>
                    <option value="lan">LAN (Static DHCP)</option>
                </select>
            </div>
            <div class="form-group" id="ip-group" style="display:none"><label>IP Address (for LAN)</label><input class="input" id="asset-ip" placeholder="192.168.1.100"></div>
            <div class="form-group"><label>Device Type</label>
                <select class="input" id="asset-type">
                    <option value="laptop">Laptop</option>
                    <option value="desktop">Desktop</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group"><label>OS</label>
                <select class="input" id="asset-os">
                    <option value="">Unknown</option>
                    <option value="windows">Windows</option>
                    <option value="linux">Linux</option>
                    <option value="macos">macOS</option>
                </select>
            </div>
            <div class="form-group"><label>Hostname</label><input class="input" id="asset-hostname" placeholder="OFFICE-PC-01"></div>
            <div class="form-group"><label>Notes</label><input class="input" id="asset-notes"></div>
        `;
        const modal = Modal(content, {
            title: 'Add Asset',
            confirmLabel: 'Add',
            onConfirm: async () => {
                const conn = document.getElementById('asset-conn').value;
                const body = {
                    name: document.getElementById('asset-name').value.trim(),
                    mac_address: document.getElementById('asset-mac').value.trim(),
                    connection_type: conn,
                    asset_type: document.getElementById('asset-type').value,
                    os_type: document.getElementById('asset-os').value || null,
                    hostname: document.getElementById('asset-hostname').value.trim() || null,
                    notes: document.getElementById('asset-notes').value.trim() || null,
                };
                if (conn === 'lan') body.ip_address = document.getElementById('asset-ip').value.trim();
                try {
                    await api.post('/assets', body);
                    success('Asset added');
                    modal.remove();
                    loadAssets();
                } catch (e) { error(e.message); }
            },
        });
        // Show/hide IP field
        document.getElementById('asset-conn').addEventListener('change', (e) => {
            document.getElementById('ip-group').style.display = e.target.value === 'lan' ? 'block' : 'none';
        });
    }

    document.getElementById('add-asset-btn').addEventListener('click', showAddModal);
    document.getElementById('filter-status').addEventListener('change', loadAssets);
    document.getElementById('filter-type').addEventListener('change', loadAssets);

    await loadAssets();

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
