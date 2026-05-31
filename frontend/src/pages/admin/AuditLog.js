import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { DataTable } from '../../components/DataTable.js';
import { api } from '../../api/client.js';

export async function renderAuditLog(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header"><h2>Audit Log</h2></div>
                    <div class="card">
                        <div id="audit-content">Loading...</div>
                        <div class="pagination" id="pagination"></div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    let page = 1;

    async function load() {
        try {
            const data = await api.get(`/audit?page=${page}&per_page=50`);
            const cols = [
                { key: 'created_at', label: 'Time', render: v => new Date(v).toLocaleString() },
                { key: 'username', label: 'User' },
                { key: 'action', label: 'Action', render: v => `<code class="action-code">${v}</code>` },
                { key: 'resource_type', label: 'Resource' },
                { key: 'resource_id', label: 'ID' },
                { key: 'ip_address', label: 'IP' },
            ];

            const content = container.querySelector('#audit-content');
            content.innerHTML = '';
            content.appendChild(DataTable(cols, data.items));

            const pag = container.querySelector('#pagination');
            const totalPages = Math.ceil(data.total / 50);
            pag.innerHTML = `
                <button ${page <= 1 ? 'disabled' : ''} id="prev-btn">← Prev</button>
                <span>Page ${page} of ${totalPages}</span>
                <button ${page >= totalPages ? 'disabled' : ''} id="next-btn">Next →</button>
            `;
            pag.querySelector('#prev-btn')?.addEventListener('click', () => { page--; load(); });
            pag.querySelector('#next-btn')?.addEventListener('click', () => { page++; load(); });
        } catch (err) {
            container.querySelector('#audit-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    load();
}
