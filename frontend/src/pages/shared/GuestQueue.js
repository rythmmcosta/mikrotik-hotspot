import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { DataTable } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

export async function renderGuestQueue(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Guest Approval Queue</h2>
                        <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                    </div>
                    <div class="card">
                        <div id="queue-content">Loading...</div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        const content = container.querySelector('#queue-content');
        try {
            const queue = await api.get('/guests/queue');

            if (!queue.length) {
                content.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending approvals</p></div>';
                return;
            }

            const cols = [
                { key: 'full_name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'mobile', label: 'Mobile' },
                { key: 'submitted_at', label: 'Requested', render: v => new Date(v).toLocaleString() },
                { key: 'priority', label: 'Priority' },
            ];

            const table = DataTable(cols, queue, {
                actions: [
                    {
                        label: '✓ Approve', className: 'btn-success',
                        onClick: (row) => {
                            const modal = Modal(`
                                <p>Approve WiFi access for <strong>${row.full_name}</strong>?</p>
                                <div class="form-group" style="margin-top:12px">
                                    <label>Access Duration (hours, 0 = default)</label>
                                    <input type="number" id="access-hours" value="0" min="0" max="720" class="input">
                                </div>
                            `, {
                                title: 'Approve Guest',
                                confirmLabel: 'Approve',
                                confirmClass: 'btn-success',
                                onConfirm: async () => {
                                    const hours = parseInt(document.getElementById('access-hours')?.value) || null;
                                    await api.post(`/guests/${row.guest_id}/approve`, { access_hours: hours || null });
                                    success(`${row.full_name} approved`);
                                    modal.remove();
                                    load();
                                },
                            });
                        },
                    },
                    {
                        label: '✗ Reject', className: 'btn-danger',
                        onClick: (row) => {
                            const modal = Modal(`
                                <p>Reject access for <strong>${row.full_name}</strong>?</p>
                                <div class="form-group" style="margin-top:12px">
                                    <label>Reason (optional)</label>
                                    <input type="text" id="reject-notes" class="input" placeholder="Reason...">
                                </div>
                            `, {
                                title: 'Reject Guest',
                                confirmLabel: 'Reject',
                                confirmClass: 'btn-danger',
                                onConfirm: async () => {
                                    const notes = document.getElementById('reject-notes')?.value || null;
                                    await api.post(`/guests/${row.guest_id}/reject`, { notes });
                                    error(`${row.full_name} rejected`);
                                    modal.remove();
                                    load();
                                },
                            });
                        },
                    },
                ],
            });

            content.innerHTML = '';
            content.appendChild(table);
        } catch (err) {
            content.innerHTML = `<div class="alert alert-error" style="margin:16px">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    const interval = setInterval(load, 30000);
    const cleanup = () => {
        clearInterval(interval);
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}
