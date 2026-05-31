import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

export async function renderBrowsingLog(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Browsing Log</h2>
                        <a class="btn btn-ghost" id="export-btn" href="#">Export CSV</a>
                    </div>

                    <div class="toolbar">
                        <input class="input input-sm" id="filter-user" placeholder="Filter by username">
                        <input class="input input-sm" id="filter-domain" placeholder="Filter by domain">
                        <input class="input input-sm" id="filter-from" type="datetime-local">
                        <input class="input input-sm" id="filter-to" type="datetime-local">
                        <button class="btn btn-primary" id="search-btn">Search</button>
                    </div>

                    <div class="dashboard-grid" style="margin-bottom:16px">
                        <div class="card" id="stats-card">
                            <div class="card-header">Top Domains (24h)</div>
                            <div id="top-domains" style="padding:8px">Loading...</div>
                        </div>
                        <div class="card">
                            <div class="card-header">Top Users (24h)</div>
                            <div id="top-users" style="padding:8px">Loading...</div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <span>Browsing Activity</span>
                            <span id="total-label" class="badge badge-blue">—</span>
                        </div>
                        <div id="table-mount">Loading...</div>
                        <div class="pagination" id="pagination"></div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    let currentPage = 1;

    async function loadStats() {
        try {
            const stats = await api.get('/browsing/stats?hours=24');
            document.getElementById('top-domains').innerHTML = stats.top_domains.slice(0, 10).map(d => `
                <div class="metric-row">
                    <span>${d.domain}</span>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div class="metric-bar-bg"><div class="metric-bar-fill" style="width:${Math.min(100, d.count / (stats.top_domains[0]?.count || 1) * 100).toFixed(0)}%;background:var(--primary)"></div></div>
                        <span style="font-size:11px;opacity:.7;min-width:30px;text-align:right">${d.count}</span>
                    </div>
                </div>
            `).join('') || '<p class="muted center" style="padding:12px">No data</p>';

            document.getElementById('top-users').innerHTML = stats.top_users.map(u => `
                <div class="metric-row">
                    <span>${u.username}</span>
                    <span class="badge badge-blue">${u.count}</span>
                </div>
            `).join('') || '<p class="muted center" style="padding:12px">No data</p>';
        } catch {}
    }

    async function loadLogs(page = 1) {
        currentPage = page;
        const params = new URLSearchParams({ page, per_page: 50 });
        const user = document.getElementById('filter-user').value.trim();
        const domain = document.getElementById('filter-domain').value.trim();
        const from = document.getElementById('filter-from').value;
        const to = document.getElementById('filter-to').value;
        if (user) params.set('username', user);
        if (domain) params.set('domain', domain);
        if (from) params.set('date_from', from);
        if (to) params.set('date_to', to);

        try {
            const data = await api.get('/browsing?' + params.toString());
            document.getElementById('total-label').textContent = `${data.total} records`;

            const mount = document.getElementById('table-mount');
            if (!data.items.length) {
                mount.innerHTML = '<p class="muted center" style="padding:24px">No records found</p>';
            } else {
                mount.innerHTML = `
                    <table class="data-table">
                        <thead><tr>
                            <th>Username</th><th>Domain</th><th>Type</th>
                            <th>IP</th><th>MAC</th><th>Time</th>
                        </tr></thead>
                        <tbody>
                            ${data.items.map(r => `<tr>
                                <td>${r.hotspot_username || '—'}</td>
                                <td>${r.domain}</td>
                                <td>${r.query_type || '—'}</td>
                                <td>${r.ip_address || '—'}</td>
                                <td>${r.mac_address || '—'}</td>
                                <td>${r.queried_at ? new Date(r.queried_at).toLocaleString() : '—'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                `;
            }

            const pages = Math.ceil(data.total / 50);
            const pEl = document.getElementById('pagination');
            if (pages > 1) {
                pEl.innerHTML = `
                    <button class="btn btn-ghost" ${page <= 1 ? 'disabled' : ''} id="prev-page">← Prev</button>
                    <span>Page ${page} of ${pages}</span>
                    <button class="btn btn-ghost" ${page >= pages ? 'disabled' : ''} id="next-page">Next →</button>
                `;
                document.getElementById('prev-page')?.addEventListener('click', () => loadLogs(page - 1));
                document.getElementById('next-page')?.addEventListener('click', () => loadLogs(page + 1));
            } else {
                pEl.innerHTML = '';
            }
        } catch (e) { error(e.message); }
    }

    document.getElementById('search-btn').addEventListener('click', () => loadLogs(1));
    document.getElementById('export-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        const user = document.getElementById('filter-user').value.trim();
        const domain = document.getElementById('filter-domain').value.trim();
        if (user) params.set('username', user);
        if (domain) params.set('domain', domain);
        window.open('/api/v1/browsing/export?' + params.toString(), '_blank');
    });

    await Promise.all([loadStats(), loadLogs(1)]);

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
