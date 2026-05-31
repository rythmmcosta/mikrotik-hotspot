import { renderSidebar } from '../components/Sidebar.js';
import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';

export async function renderDashboard(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>Dashboard</h2>
                    <span class="badge badge-green" id="router-status">Checking router...</span>
                </div>
                <div class="stats-grid" id="stats-grid">
                    <div class="stat-card skeleton"></div>
                    <div class="stat-card skeleton"></div>
                    <div class="stat-card skeleton"></div>
                    <div class="stat-card skeleton"></div>
                </div>
                <div class="dashboard-grid">
                    <div class="card">
                        <div class="card-header"><h3>Guest Queue</h3><a href="#/guests/queue" class="btn-link">View All →</a></div>
                        <div id="queue-preview">Loading...</div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>Active Connections</h3><a href="#/connections/active" class="btn-link">View All →</a></div>
                        <div id="active-preview">Loading...</div>
                    </div>
                </div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    // Load stats
    try {
        const [stats, queue, active] = await Promise.all([
            api.get('/connections/stats'),
            api.get('/guests/queue'),
            api.get('/connections/active'),
        ]);

        container.querySelector('#stats-grid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">📡</div>
                <div class="stat-value">${stats.active_count}</div>
                <div class="stat-label">Active Connections</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏳</div>
                <div class="stat-value">${queue.length}</div>
                <div class="stat-label">Pending Approvals</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${stats.total_sessions_today}</div>
                <div class="stat-label">Sessions Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👤</div>
                <div class="stat-value">${stats.unique_users_today}</div>
                <div class="stat-label">Unique Users Today</div>
            </div>
        `;

        // Queue preview
        const qEl = container.querySelector('#queue-preview');
        if (!queue.length) {
            qEl.innerHTML = '<p class="muted center">No pending approvals</p>';
        } else {
            qEl.innerHTML = queue.slice(0, 5).map(q => `
                <div class="list-item">
                    <div>
                        <strong>${q.full_name}</strong>
                        <small>${q.email}</small>
                    </div>
                    <a href="#/guests/queue" class="badge badge-yellow">Pending</a>
                </div>
            `).join('');
        }

        // Active preview
        const aEl = container.querySelector('#active-preview');
        if (!active.length) {
            aEl.innerHTML = '<p class="muted center">No active connections</p>';
        } else {
            aEl.innerHTML = active.slice(0, 5).map(c => `
                <div class="list-item">
                    <div>
                        <strong>${c.hotspot_username}</strong>
                        <small>${c.ip_address} · ${c.mac_address}</small>
                    </div>
                    <span class="badge badge-green">${c.user_type}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        container.querySelector('#stats-grid').innerHTML = `<div class="alert alert-error col-span-4">${err.message}</div>`;
    }

    // Check router status (admin only)
    if (authStore.isAdmin()) {
        try {
            const res = await api.post('/settings/mikrotik/test', {});
            const el = container.querySelector('#router-status');
            el.textContent = res.success ? `Router: ${res.details?.identity || 'Connected'}` : 'Router: Disconnected';
            el.className = `badge ${res.success ? 'badge-green' : 'badge-red'}`;
        } catch { /* not critical */ }
    } else {
        container.querySelector('#router-status').style.display = 'none';
    }
}
