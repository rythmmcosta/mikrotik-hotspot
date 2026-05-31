import { renderSidebar } from '../../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../../components/Topbar.js';
import { DataTable, StatusBadge } from '../../../components/DataTable.js';
import { success, error } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderInterfaces(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                <div class="page-header">
                    <h2>Network Interfaces</h2>
                    <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                </div>
                <div id="interfaces-content">Loading...</div>
                <div class="card" style="margin-top:16px">
                    <div class="card-header"><h3>IP Addresses</h3></div>
                    <div id="ip-content">Loading...</div>
                </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        try {
            const [ifaces, ips] = await Promise.all([
                api.get('/mikrotik/interfaces'),
                api.get('/mikrotik/ip/addresses'),
            ]);

            const cols = [
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'running', label: 'Running', render: v => v === 'true' ? '🟢 Yes' : '🔴 No' },
                { key: 'disabled', label: 'Disabled', render: v => v === 'true' ? '⚠️ Yes' : '✅ No' },
                { key: 'mac-address', label: 'MAC' },
                { key: 'mtu', label: 'MTU' },
                { key: 'tx-byte', label: '↑ TX', render: v => v ? (parseInt(v)/1024/1024).toFixed(1)+' MB' : '—' },
                { key: 'rx-byte', label: '↓ RX', render: v => v ? (parseInt(v)/1024/1024).toFixed(1)+' MB' : '—' },
            ];

            const ifaceTable = DataTable(cols, ifaces, {
                actions: [
                    {
                        label: 'Toggle', className: 'btn-ghost',
                        onClick: async (row) => {
                            try {
                                if (row.disabled === 'true') {
                                    await api.post(`/mikrotik/interfaces/${row.name}/enable`, {});
                                    success(`${row.name} enabled`);
                                } else {
                                    await api.post(`/mikrotik/interfaces/${row.name}/disable`, {});
                                    success(`${row.name} disabled`);
                                }
                                load();
                            } catch (err) { error(err.message); }
                        },
                    },
                ],
            });

            const ipCols = [
                { key: 'address', label: 'Address' },
                { key: 'interface', label: 'Interface' },
                { key: 'network', label: 'Network' },
                { key: 'disabled', label: 'Disabled', render: v => v === 'true' ? 'Yes' : 'No' },
            ];

            container.querySelector('#interfaces-content').innerHTML = '';
            container.querySelector('#interfaces-content').appendChild(ifaceTable);
            container.querySelector('#ip-content').innerHTML = '';
            container.querySelector('#ip-content').appendChild(DataTable(ipCols, ips));
        } catch (err) {
            container.querySelector('#interfaces-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();
}
