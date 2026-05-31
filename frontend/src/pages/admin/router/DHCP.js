import { renderSidebar } from '../../../components/Sidebar.js';
import { DataTable } from '../../../components/DataTable.js';
import { success, error } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderDHCP(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>DHCP Management</h2>
                    <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                </div>
                <div class="card">
                    <div class="card-header"><h3>DHCP Servers</h3></div>
                    <div id="servers-content">Loading...</div>
                </div>
                <div class="card" style="margin-top:16px">
                    <div class="card-header"><h3>Active Leases</h3>
                    <input type="text" id="lease-search" placeholder="Search IP or MAC..." class="input input-sm">
                    </div>
                    <div id="leases-content">Loading...</div>
                </div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    let allLeases = [];

    async function load() {
        try {
            const [servers, leases] = await Promise.all([
                api.get('/mikrotik/dhcp/servers'),
                api.get('/mikrotik/dhcp/leases'),
            ]);
            allLeases = leases;

            const serverCols = [
                { key: 'name', label: 'Name' },
                { key: 'interface', label: 'Interface' },
                { key: 'address-pool', label: 'Pool' },
                { key: 'lease-time', label: 'Lease Time' },
                { key: 'disabled', label: 'Active', render: v => v !== 'true' ? '✅' : '⚠️' },
            ];
            container.querySelector('#servers-content').innerHTML = '';
            container.querySelector('#servers-content').appendChild(DataTable(serverCols, servers));

            renderLeases(leases);
        } catch (err) {
            container.querySelector('#leases-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    function renderLeases(leases) {
        const leaseCols = [
            { key: 'address', label: 'IP Address' },
            { key: 'mac-address', label: 'MAC' },
            { key: 'host-name', label: 'Hostname' },
            { key: 'status', label: 'Status' },
            { key: 'expires-after', label: 'Expires' },
        ];
        container.querySelector('#leases-content').innerHTML = '';
        container.querySelector('#leases-content').appendChild(
            DataTable(leaseCols, leases, {
                actions: [
                    {
                        label: '📌 Make Static', className: 'btn-ghost',
                        onClick: async (row) => {
                            await api.post(`/mikrotik/dhcp/leases/${row['.id']}/make-static`, {});
                            success('Lease made static');
                            load();
                        },
                    },
                    {
                        label: '🗑 Release', className: 'btn-danger',
                        onClick: async (row) => {
                            await api.delete(`/mikrotik/dhcp/leases/${row['.id']}`);
                            success('Lease released');
                            load();
                        },
                    },
                ],
            })
        );
    }

    container.querySelector('#lease-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderLeases(allLeases.filter(l =>
            (l.address || '').toLowerCase().includes(q) ||
            (l['mac-address'] || '').toLowerCase().includes(q) ||
            (l['host-name'] || '').toLowerCase().includes(q)
        ));
    });

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();
}
