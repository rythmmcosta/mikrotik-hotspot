import { renderSidebar } from '../../components/Sidebar.js';
import { DataTable, StatusBadge } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

export async function renderGuestQueue(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>Guest Approval Queue</h2>
                    <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                </div>
                <div id="queue-content">Loading...</div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    async function load() {
        const content = container.querySelector('#queue-content');
        try {
            const [queue, guests] = await Promise.all([
                api.get('/guests/queue'),
                api.get('/guests?status=pending_approval&per_page=100'),
            ]);

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
                        onClick: async (row) => {
                            Modal({
                                title: 'Approve Guest',
                                content: `<p>Approve WiFi access for <strong>${row.full_name}</strong>?</p>
                                    <div class="form-group" style="margin-top:12px">
                                        <label>Access Duration (hours, 0 = default)</label>
                                        <input type="number" id="access-hours" value="0" min="0" max="720" class="input">
                                    </div>`,
                                confirmLabel: 'Approve',
                                confirmClass: 'btn-success',
                                onConfirm: async () => {
                                    const hours = parseInt(document.getElementById('access-hours')?.value) || null;
                                    await api.post(`/guests/${row.guest_id}/approve`, { access_hours: hours || null });
                                    success(`${row.full_name} approved`);
                                    load();
                                },
                            });
                        },
                    },
                    {
                        label: '✗ Reject', className: 'btn-danger',
                        onClick: async (row) => {
                            Modal({
                                title: 'Reject Guest',
                                content: `<p>Reject access for <strong>${row.full_name}</strong>?</p>
                                    <div class="form-group" style="margin-top:12px">
                                        <label>Reason (optional)</label>
                                        <input type="text" id="reject-notes" class="input" placeholder="Reason...">
                                    </div>`,
                                confirmLabel: 'Reject',
                                confirmClass: 'btn-danger',
                                onConfirm: async () => {
                                    const notes = document.getElementById('reject-notes')?.value || null;
                                    await api.post(`/guests/${row.guest_id}/reject`, { notes });
                                    error(`${row.full_name} rejected`);
                                    load();
                                },
                            });
                        },
                    },
                ],
            });

            content.innerHTML = '';
            if (!queue.length) {
                content.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending approvals</p></div>';
            } else {
                content.appendChild(table);
            }
        } catch (err) {
            content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    // Auto-refresh every 30s
    const interval = setInterval(load, 30000);
    const observer = new MutationObserver(() => {
        if (!document.contains(container)) { clearInterval(interval); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
}
