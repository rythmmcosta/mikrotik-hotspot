import { renderSidebar } from '../../components/Sidebar.js';
import { DataTable, StatusBadge } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

export async function renderEmployees(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>Employees</h2>
                    <button class="btn btn-primary" id="add-employee-btn">+ Add Employee</button>
                </div>
                <div class="toolbar">
                    <select id="status-filter" class="input input-sm">
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                </div>
                <div id="employees-content">Loading...</div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    async function load() {
        const status = container.querySelector('#status-filter').value;
        try {
            const data = await api.get(`/employees?per_page=50${status ? '&status=' + status : ''}`);
            const cols = [
                { key: 'full_name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'hotspot_username', label: 'Hotspot User' },
                { key: 'status', label: 'Status', render: v => StatusBadge(v) },
                { key: 'mikrotik_synced', label: 'Router Synced', render: v => v ? '✅' : '⚠️' },
                { key: 'created_at', label: 'Added', render: v => new Date(v).toLocaleDateString() },
            ];

            const table = DataTable(cols, data.items, {
                actions: [
                    {
                        label: '⏸ Suspend', className: 'btn-warning',
                        onClick: async (row) => {
                            if (row.status === 'suspended') {
                                await api.post(`/employees/${row.id}/activate`, {});
                                success(`${row.full_name} activated`);
                            } else {
                                await api.post(`/employees/${row.id}/suspend`, {});
                                success(`${row.full_name} suspended`);
                            }
                            load();
                        },
                    },
                    {
                        label: '🔑 Reset Pass', className: 'btn-ghost',
                        onClick: async (row) => {
                            const result = await api.post(`/employees/${row.id}/reset-password`, {});
                            Modal({
                                title: 'New Hotspot Password',
                                content: `<p>New password for <strong>${row.full_name}</strong>:</p>
                                    <div class="code-block">${result.new_hotspot_password}</div>`,
                                confirmLabel: 'Done',
                                onConfirm: async () => {},
                            });
                        },
                    },
                    {
                        label: '🗑 Delete', className: 'btn-danger',
                        onClick: (row) => {
                            Modal({
                                title: 'Delete Employee',
                                content: `<p>Remove <strong>${row.full_name}</strong> from the system? This will revoke their WiFi access.</p>`,
                                confirmLabel: 'Delete',
                                confirmClass: 'btn-danger',
                                onConfirm: async () => {
                                    await api.delete(`/employees/${row.id}`);
                                    success(`${row.full_name} removed`);
                                    load();
                                },
                            });
                        },
                    },
                ],
            });

            const content = container.querySelector('#employees-content');
            content.innerHTML = '';
            content.appendChild(table);
        } catch (err) {
            container.querySelector('#employees-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    container.querySelector('#status-filter').addEventListener('change', load);

    container.querySelector('#add-employee-btn').addEventListener('click', () => {
        Modal({
            title: 'Add Employee',
            content: `
                <div class="form-group"><label>Full Name</label><input type="text" id="m-name" class="input" required></div>
                <div class="form-group"><label>Work Email</label><input type="email" id="m-email" class="input" required></div>
                <div class="form-group"><label>Portal Password</label><input type="password" id="m-pass" class="input" required minlength="8"></div>
                <div class="form-group"><label>Notes (optional)</label><input type="text" id="m-notes" class="input"></div>
            `,
            confirmLabel: 'Add Employee',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                const name = document.getElementById('m-name').value;
                const email = document.getElementById('m-email').value;
                const password = document.getElementById('m-pass').value;
                const notes = document.getElementById('m-notes').value;
                if (!name || !email || !password) throw new Error('All required fields must be filled');
                await api.post('/employees', { full_name: name, email, password, notes: notes || null });
                success(`Employee ${name} added successfully`);
                load();
            },
        });
    });

    load();
}
