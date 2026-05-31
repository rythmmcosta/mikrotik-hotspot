import { renderSidebar } from '../../../components/Sidebar.js';
import { DataTable } from '../../../components/DataTable.js';
import { success, error } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderFirewall(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header"><h2>Firewall Rules</h2>
                <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button></div>
                <div class="tab-nav">
                    <button class="tab-btn active" data-tab="filter">Filter Rules</button>
                    <button class="tab-btn" data-tab="nat">NAT Rules</button>
                </div>
                <div id="filter-tab" class="tab-content">Loading...</div>
                <div id="nat-tab" class="tab-content" style="display:none">Loading...</div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            container.querySelector(`#${btn.dataset.tab}-tab`).style.display = 'block';
        });
    });

    async function load() {
        try {
            const [filter, nat] = await Promise.all([
                api.get('/mikrotik/firewall/filter'),
                api.get('/mikrotik/firewall/nat'),
            ]);

            const cols = [
                { key: '.id', label: '#' },
                { key: 'chain', label: 'Chain' },
                { key: 'action', label: 'Action', render: v => `<span class="badge ${v==='drop'||v==='reject'?'badge-red':'badge-green'}">${v||'—'}</span>` },
                { key: 'src-address', label: 'Src' },
                { key: 'dst-address', label: 'Dst' },
                { key: 'protocol', label: 'Protocol' },
                { key: 'dst-port', label: 'Port' },
                { key: 'disabled', label: 'Disabled', render: v => v === 'true' ? '⚠️' : '✅' },
                { key: 'comment', label: 'Comment' },
            ];

            const filterTable = DataTable(cols, filter, {
                actions: [{
                    label: 'Toggle', className: 'btn-ghost',
                    onClick: async (row) => {
                        await api.post(`/mikrotik/firewall/filter/${row['.id']}/toggle?disabled=${row.disabled !== 'true'}`, {});
                        success('Rule toggled');
                        load();
                    },
                }, {
                    label: '🗑', className: 'btn-danger',
                    onClick: async (row) => {
                        await api.delete(`/mikrotik/firewall/filter/${row['.id']}`);
                        success('Rule removed');
                        load();
                    },
                }],
            });

            const natCols = [
                { key: '.id', label: '#' },
                { key: 'chain', label: 'Chain' },
                { key: 'action', label: 'Action' },
                { key: 'src-address', label: 'Src' },
                { key: 'dst-address', label: 'Dst' },
                { key: 'to-addresses', label: 'To Address' },
                { key: 'to-ports', label: 'To Port' },
                { key: 'disabled', label: 'Disabled', render: v => v === 'true' ? '⚠️' : '✅' },
            ];

            container.querySelector('#filter-tab').innerHTML = '';
            container.querySelector('#filter-tab').appendChild(filterTable);
            container.querySelector('#nat-tab').innerHTML = '';
            container.querySelector('#nat-tab').appendChild(DataTable(natCols, nat));
        } catch (err) {
            container.querySelector('#filter-tab').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();
}
