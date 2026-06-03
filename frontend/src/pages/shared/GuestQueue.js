import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { DataTable } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success, error, info } from '../../components/Toast.js';
import { api } from '../../api/client.js';
import { createWSClient } from '../../core/ws.js';
import { authStore } from '../../store/auth.js';

export async function renderGuestQueue(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Guest Approval Queue</h2>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="ws-indicator" style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)">
                                <span id="ws-dot" style="width:8px;height:8px;border-radius:50%;background:var(--accent-warn);flex-shrink:0"></span>
                                Connecting...
                            </span>
                            <div id="bulk-actions" style="display:none;gap:8px">
                                <button class="btn btn-success btn-sm" id="bulk-approve-btn">✓ Approve Selected (<span id="sel-count">0</span>)</button>
                                <button class="btn btn-danger btn-sm" id="bulk-reject-btn">✗ Reject Selected</button>
                            </div>
                            <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                        </div>
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

    let selectedIds = new Set();

    function updateBulkBar() {
        const bar = container.querySelector('#bulk-actions');
        const countEl = container.querySelector('#sel-count');
        countEl.textContent = selectedIds.size;
        bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
    }

    async function load() {
        const content = container.querySelector('#queue-content');
        selectedIds.clear();
        updateBulkBar();
        try {
            const queue = await api.get('/guests/queue');

            if (!queue.length) {
                content.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending approvals</p></div>';
                return;
            }

            const wrapper = document.createElement('div');

            // Select-all header
            const selectBar = document.createElement('div');
            selectBar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border)';
            selectBar.innerHTML = `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                    <input type="checkbox" id="select-all"> Select All (${queue.length})
                </label>
            `;
            wrapper.appendChild(selectBar);

            const cols = [
                {
                    key: 'guest_id',
                    label: '',
                    render: (v, row) => `<input type="checkbox" class="row-checkbox" data-id="${row.guest_id}" style="cursor:pointer">`,
                },
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

            wrapper.appendChild(table);
            content.innerHTML = '';
            content.appendChild(wrapper);

            // Checkbox logic
            content.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (cb.checked) selectedIds.add(parseInt(cb.dataset.id));
                    else selectedIds.delete(parseInt(cb.dataset.id));
                    updateBulkBar();
                });
            });

            content.querySelector('#select-all').addEventListener('change', (e) => {
                content.querySelectorAll('.row-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) selectedIds.add(parseInt(cb.dataset.id));
                    else selectedIds.delete(parseInt(cb.dataset.id));
                });
                updateBulkBar();
            });
        } catch (err) {
            content.innerHTML = `<div class="alert alert-error" style="margin:16px">${err.message}</div>`;
        }
    }

    // Bulk approve
    container.querySelector('#bulk-approve-btn').addEventListener('click', () => {
        const ids = [...selectedIds];
        const modal = Modal(`
            <p>Approve <strong>${ids.length}</strong> guests?</p>
            <div class="form-group" style="margin-top:12px">
                <label>Access Duration (hours, 0 = default)</label>
                <input type="number" id="bulk-hours" value="0" min="0" max="720" class="input">
            </div>
        `, {
            title: `Bulk Approve ${ids.length} Guests`,
            confirmLabel: 'Approve All',
            confirmClass: 'btn-success',
            onConfirm: async () => {
                const hours = parseInt(document.getElementById('bulk-hours')?.value) || null;
                const result = await api.post('/guests/bulk-approve', { guest_ids: ids, access_hours: hours });
                success(`${result.approved} guests approved`);
                modal.remove();
                load();
            },
        });
    });

    // Bulk reject
    container.querySelector('#bulk-reject-btn').addEventListener('click', () => {
        const ids = [...selectedIds];
        const modal = Modal(`
            <p>Reject <strong>${ids.length}</strong> guests?</p>
            <div class="form-group" style="margin-top:12px">
                <label>Reason (optional)</label>
                <input type="text" id="bulk-notes" class="input" placeholder="Reason...">
            </div>
        `, {
            title: `Bulk Reject ${ids.length} Guests`,
            confirmLabel: 'Reject All',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                const notes = document.getElementById('bulk-notes')?.value || null;
                const result = await api.post('/guests/bulk-reject', { guest_ids: ids, notes });
                error(`${result.rejected} guests rejected`);
                modal.remove();
                load();
            },
        });
    });

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    // WebSocket for real-time queue updates
    const wsIndicator = container.querySelector('#ws-indicator');
    const wsDot = container.querySelector('#ws-dot');
    let wsClient = null;

    try {
        const token = authStore.getToken?.() || JSON.parse(localStorage.getItem('hotspot_auth') || '{}')?.access_token;
        wsClient = createWSClient('queue', token, {
            onOpen: () => {
                wsDot.style.background = '#34d399';
                wsDot.style.boxShadow = '0 0 6px #34d399';
                wsIndicator.querySelector('span:last-child') && (wsIndicator.childNodes[1] ? wsIndicator.childNodes[1].textContent = ' Live' : null);
            },
            onMessage: (msg) => {
                if (msg.type === 'new_guest') {
                    info(`New guest: ${msg.data?.name}`);
                    load();
                }
            },
            onClose: () => {
                wsDot.style.background = 'var(--accent-warn)';
                wsDot.style.boxShadow = 'none';
            },
        });
    } catch {}

    const cleanup = () => {
        wsClient?.close?.();
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}
