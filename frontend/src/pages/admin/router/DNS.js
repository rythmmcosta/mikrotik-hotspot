import { renderSidebar } from '../../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../../components/Topbar.js';
import { DataTable } from '../../../components/DataTable.js';
import { Modal } from '../../../components/Modal.js';
import { success } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderDNS(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                <div class="page-header"><h2>DNS Management</h2>
                    <button class="btn btn-primary" id="add-dns-btn">+ Add Static Entry</button>
                </div>
                <div class="card"><div class="card-header"><h3>DNS Settings</h3></div><div id="dns-settings">Loading...</div></div>
                <div class="card" style="margin-top:16px"><div class="card-header"><h3>Static DNS Entries</h3></div><div id="dns-content">Loading...</div></div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        try {
            const [settings, entries] = await Promise.all([
                api.get('/mikrotik/dns/settings'),
                api.get('/mikrotik/dns/static'),
            ]);

            container.querySelector('#dns-settings').innerHTML = `
                <div class="info-grid">
                    <div><strong>Servers:</strong> ${settings['servers'] || '—'}</div>
                    <div><strong>Allow Remote Requests:</strong> ${settings['allow-remote-requests'] || '—'}</div>
                    <div><strong>Cache Max TTL:</strong> ${settings['cache-max-ttl'] || '—'}</div>
                    <div><strong>Cache Used:</strong> ${settings['cache-used'] || '—'}</div>
                </div>
            `;

            const cols = [
                { key: 'name', label: 'Hostname' },
                { key: 'address', label: 'IP Address' },
                { key: 'ttl', label: 'TTL' },
                { key: 'disabled', label: 'Active', render: v => v !== 'true' ? '✅' : '⚠️' },
            ];
            container.querySelector('#dns-content').innerHTML = '';
            container.querySelector('#dns-content').appendChild(DataTable(cols, entries, {
                actions: [{
                    label: '🗑 Remove', className: 'btn-danger',
                    onClick: async (row) => {
                        await api.delete(`/mikrotik/dns/static/${row['.id']}`);
                        success('DNS entry removed');
                        load();
                    },
                }],
            }));
        } catch (err) {
            container.querySelector('#dns-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#add-dns-btn').addEventListener('click', () => {
        Modal({
            title: 'Add Static DNS Entry',
            content: `
                <div class="form-group"><label>Hostname</label><input type="text" id="dns-name" class="input" placeholder="example.local"></div>
                <div class="form-group"><label>IP Address</label><input type="text" id="dns-addr" class="input" placeholder="192.168.1.100"></div>
            `,
            confirmLabel: 'Add Entry',
            onConfirm: async () => {
                const name = document.getElementById('dns-name').value;
                const address = document.getElementById('dns-addr').value;
                await api.post('/mikrotik/dns/static', { name, address });
                success('DNS entry added');
                load();
            },
        });
    });

    load();
}
