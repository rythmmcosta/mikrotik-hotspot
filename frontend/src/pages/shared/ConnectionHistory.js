import { renderSidebar } from '../../components/Sidebar.js';
import { DataTable, StatusBadge } from '../../components/DataTable.js';
import { api } from '../../api/client.js';

export async function renderConnectionHistory(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header"><h2>Connection History</h2></div>
                <div class="card">
                    <div id="history-content">Loading...</div>
                    <div class="pagination" id="pagination"></div>
                </div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    let page = 1;

    async function load() {
        try {
            const data = await api.get(`/connections/history?page=${page}&per_page=50`);
            const cols = [
                { key: 'hotspot_username', label: 'User' },
                { key: 'user_type', label: 'Type', render: v => StatusBadge(v) },
                { key: 'ip_address', label: 'IP' },
                { key: 'mac_address', label: 'MAC' },
                { key: 'connected_at', label: 'Connected', render: v => new Date(v).toLocaleString() },
                { key: 'disconnected_at', label: 'Disconnected', render: v => v ? new Date(v).toLocaleString() : '—' },
                { key: 'disconnect_reason', label: 'Reason', render: v => v ? StatusBadge(v) : '—' },
            ];

            const content = container.querySelector('#history-content');
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
            container.querySelector('#history-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    load();
}
