import { renderSidebar } from '../../../components/Sidebar.js';
import { api } from '../../../api/client.js';

export async function renderSystemResources(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <main class="main-content">
                <div class="page-header">
                    <h2>System Resources</h2>
                    <button class="btn btn-ghost" id="refresh-btn">↻ Refresh</button>
                </div>
                <div id="resources-content">Loading...</div>
                <div class="card" style="margin-top:16px">
                    <div class="card-header"><h3>System Log</h3></div>
                    <div id="logs-content" class="log-view">Loading...</div>
                </div>
            </main>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));

    async function load() {
        try {
            const [res, logs] = await Promise.all([
                api.get('/mikrotik/system/resources'),
                api.get('/mikrotik/system/logs'),
            ]);

            const cpuPct = res['cpu-load'] || 0;
            const ramTotal = parseInt(res['total-memory'] || 0);
            const ramFree = parseInt(res['free-memory'] || 0);
            const ramUsed = ramTotal - ramFree;
            const ramPct = ramTotal ? Math.round(ramUsed / ramTotal * 100) : 0;

            container.querySelector('#resources-content').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Identity</div>
                        <div class="stat-value sm">${res['platform'] || 'MikroTik'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">RouterOS Version</div>
                        <div class="stat-value sm">${res['version'] || '—'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Uptime</div>
                        <div class="stat-value sm">${res['uptime'] || '—'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">CPU Load</div>
                        <div class="stat-value">${cpuPct}%</div>
                        <div class="progress-bar"><div class="progress-fill" style="width:${cpuPct}%;background:${cpuPct>80?'#ef4444':'#22c55e'}"></div></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">RAM Usage</div>
                        <div class="stat-value">${ramPct}%</div>
                        <div class="progress-bar"><div class="progress-fill" style="width:${ramPct}%;background:${ramPct>80?'#ef4444':'#3b82f6'}"></div></div>
                        <small>${(ramUsed/1024/1024).toFixed(0)} / ${(ramTotal/1024/1024).toFixed(0)} MB</small>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">HDD Free</div>
                        <div class="stat-value sm">${(parseInt(res['free-hdd-space']||0)/1024/1024).toFixed(0)} MB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Board Name</div>
                        <div class="stat-value sm">${res['board-name'] || '—'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Architecture</div>
                        <div class="stat-value sm">${res['architecture-name'] || '—'}</div>
                    </div>
                </div>
            `;

            container.querySelector('#logs-content').innerHTML =
                `<pre>${logs.slice(0, 50).map(l => `[${l.time}] ${l.topics} ${l.message}`).join('\n')}</pre>`;
        } catch (err) {
            container.querySelector('#resources-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();
}
