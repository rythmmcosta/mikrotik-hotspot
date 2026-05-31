import { renderSidebar } from '../../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../../components/Topbar.js';
import { DataTable, StatusBadge } from '../../../components/DataTable.js';
import { success } from '../../../components/Toast.js';
import { api } from '../../../api/client.js';

export async function renderHotspotServer(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                <div class="page-header"><h2>Hotspot Server</h2><button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button></div>
                <div class="card"><div class="card-header"><h3>Active Sessions (from Router)</h3></div><div id="active-content">Loading...</div></div>
                <div class="card" style="margin-top:16px"><div class="card-header"><h3>Hotspot Users</h3></div><div id="users-content">Loading...</div></div>
                <div class="card" style="margin-top:16px"><div class="card-header"><h3>User Profiles</h3></div><div id="profiles-content">Loading...</div></div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        try {
            const [active, users, profiles] = await Promise.all([
                api.get('/mikrotik/hotspot/active'),
                api.get('/mikrotik/hotspot/users'),
                api.get('/mikrotik/hotspot/profiles'),
            ]);

            const activeCols = [
                { key: 'user', label: 'Username' },
                { key: 'address', label: 'IP' },
                { key: 'mac-address', label: 'MAC' },
                { key: 'uptime', label: 'Uptime' },
                { key: 'bytes-in', label: '↓', render: v => v ? (parseInt(v)/1024/1024).toFixed(1)+' MB' : '—' },
                { key: 'bytes-out', label: '↑', render: v => v ? (parseInt(v)/1024/1024).toFixed(1)+' MB' : '—' },
            ];
            container.querySelector('#active-content').innerHTML = '';
            container.querySelector('#active-content').appendChild(DataTable(activeCols, active, {
                actions: [{
                    label: '⏹ Kick', className: 'btn-danger',
                    onClick: async (row) => {
                        await api.delete(`/mikrotik/hotspot/active/${row['.id']}`);
                        success(`${row.user} disconnected`);
                        load();
                    },
                }],
            }));

            const userCols = [
                { key: 'name', label: 'Username' },
                { key: 'profile', label: 'Profile' },
                { key: 'disabled', label: 'Active', render: v => v !== 'true' ? '✅' : '⚠️' },
                { key: 'comment', label: 'Comment' },
            ];
            container.querySelector('#users-content').innerHTML = '';
            container.querySelector('#users-content').appendChild(DataTable(userCols, users));

            const profCols = [
                { key: 'name', label: 'Profile' },
                { key: 'rate-limit', label: 'Rate Limit' },
                { key: 'shared-users', label: 'Shared Users' },
            ];
            container.querySelector('#profiles-content').innerHTML = '';
            container.querySelector('#profiles-content').appendChild(DataTable(profCols, profiles));
        } catch (err) {
            container.querySelector('#active-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();
}
