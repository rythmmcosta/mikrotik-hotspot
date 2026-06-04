import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';

function _statusDot(status) {
    const colors = { ok: '#34d399', warning: '#f59f00', error: '#f87171' };
    const labels = { ok: 'Online', warning: 'Warning', error: 'Offline' };
    const c = colors[status] || colors.warning;
    return `<span style="display:inline-flex;align-items:center;gap:6px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c};box-shadow:0 0 6px ${c};flex-shrink:0"></span>
        <span style="color:${c};font-weight:500">${labels[status] || status}</span>
    </span>`;
}

function _bar(pct, color = '#38bdf8') {
    const c = pct > 85 ? '#f87171' : pct > 70 ? '#f59f00' : color;
    return `
        <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--border);border-radius:3px;height:6px">
                <div style="background:${c};width:${pct}%;height:100%;border-radius:3px;transition:width .5s"></div>
            </div>
            <span style="font-size:12px;color:var(--text-muted);width:36px;text-align:right">${pct.toFixed(1)}%</span>
        </div>
    `;
}

export async function renderSystemHealth(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>System Health</h2>
                        <button class="btn btn-ghost" id="refresh-btn">
                            <iconify-icon icon="tabler:refresh" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>Refresh
                        </button>
                    </div>

                    <div id="health-content" style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px">
                        <div class="card" style="grid-column:1/-1">
                            <div style="display:flex;justify-content:center;padding:32px">
                                <iconify-icon icon="eos-icons:loading" width="32" style="color:var(--accent-rx)"></iconify-icon>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        const el = container.querySelector('#health-content');
        try {
            const data = await api.get('/system/health');
            const { services, system } = data;

            const serviceCards = Object.entries(services).map(([name, info]) => `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title" style="text-transform:capitalize">${name}</h3>
                        ${_statusDot(info.status)}
                    </div>
                    <p style="font-size:13px;color:var(--text-muted);margin-top:8px">${info.message || ''}</p>
                </div>
            `).join('');

            const mikrotikDetails = services.mikrotik?.details;
            el.innerHTML = `
                <div class="card" style="grid-column:1/-1">
                    <div class="card-header"><h3 class="card-title">Server Resources (This Machine)</h3></div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding-top:8px">
                        <div>
                            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">CPU Usage</div>
                            ${_bar(system.cpu_percent, '#38bdf8')}
                        </div>
                        <div>
                            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">RAM (${system.ram_used_mb} / ${system.ram_total_mb} MB)</div>
                            ${_bar(system.ram_percent, '#34d399')}
                        </div>
                        <div>
                            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Disk (${system.disk_used_gb} / ${system.disk_total_gb} GB)</div>
                            ${_bar(system.disk_percent, '#f59f00')}
                        </div>
                    </div>
                </div>

                ${serviceCards}

                ${mikrotikDetails ? `
                <div class="card" style="grid-column:1/-1">
                    <div class="card-header"><h3 class="card-title">Router Details</h3></div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-top:8px">
                        <div class="stat-card" style="border:none;box-shadow:none">
                            <div class="stat-label">Identity</div>
                            <div class="stat-value sm">${mikrotikDetails.identity || '—'}</div>
                        </div>
                        <div class="stat-card" style="border:none;box-shadow:none">
                            <div class="stat-label">RouterOS Version</div>
                            <div class="stat-value sm">${mikrotikDetails.version || '—'}</div>
                        </div>
                        <div class="stat-card" style="border:none;box-shadow:none">
                            <div class="stat-label">Router CPU Load</div>
                            <div class="stat-value">${mikrotikDetails.cpu_load || '—'}</div>
                        </div>
                    </div>
                </div>` : ''}
            `;
        } catch (err) {
            el.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="alert alert-error">${err.message}</div></div>`;
        }
    }

    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
