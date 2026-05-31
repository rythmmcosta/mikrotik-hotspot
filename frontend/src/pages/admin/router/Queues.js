import { renderSidebar } from '../../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../../components/Topbar.js';
import { DataTable } from '../../../components/DataTable.js';
import { Modal } from '../../../components/Modal.js';
import { success } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderQueues(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                <div class="page-header"><h2>Queue Management</h2>
                    <button class="btn btn-primary" id="add-queue-btn">+ Add Queue</button>
                </div>
                <div id="queues-content">Loading...</div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        try {
            const queues = await api.get('/mikrotik/queues/simple');
            const cols = [
                { key: 'name', label: 'Name' },
                { key: 'target', label: 'Target' },
                { key: 'max-limit', label: 'Max Limit' },
                { key: 'burst-limit', label: 'Burst Limit' },
                { key: 'disabled', label: 'Active', render: v => v !== 'true' ? '✅' : '⚠️' },
                { key: 'bytes', label: 'Traffic', render: v => v ? (parseInt(v)/1024/1024).toFixed(1)+' MB' : '—' },
            ];
            container.querySelector('#queues-content').innerHTML = '';
            container.querySelector('#queues-content').appendChild(DataTable(cols, queues, {
                actions: [{
                    label: '🗑 Remove', className: 'btn-danger',
                    onClick: async (row) => {
                        await api.delete(`/mikrotik/queues/simple/${row['.id']}`);
                        success('Queue removed');
                        load();
                    },
                }],
            }));
        } catch (err) {
            container.querySelector('#queues-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#add-queue-btn').addEventListener('click', () => {
        Modal({
            title: 'Add Simple Queue',
            content: `
                <div class="form-group"><label>Name</label><input type="text" id="q-name" class="input" placeholder="Guest-Queue-1"></div>
                <div class="form-group"><label>Target (IP or subnet)</label><input type="text" id="q-target" class="input" placeholder="192.168.1.100/32"></div>
                <div class="form-group"><label>Max Limit (rx/tx)</label><input type="text" id="q-limit" class="input" placeholder="5M/5M"></div>
            `,
            confirmLabel: 'Add Queue',
            onConfirm: async () => {
                await api.post(`/mikrotik/queues/simple?name=${document.getElementById('q-name').value}&target=${document.getElementById('q-target').value}&max_limit=${document.getElementById('q-limit').value}`, {});
                success('Queue added');
                load();
            },
        });
    });

    load();
}
