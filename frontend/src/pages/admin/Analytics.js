import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';

function _fmt(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

export async function renderAnalytics(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Analytics</h2>
                        <select id="days-select" class="input input-sm" style="width:auto">
                            <option value="7">Last 7 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="90">Last 90 days</option>
                        </select>
                    </div>

                    <!-- Overview KPI cards -->
                    <div id="overview-cards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
                        <div class="stat-card"><div class="stat-icon"><iconify-icon icon="line-md:account-multiple" width="28"></iconify-icon></div><div class="stat-value" id="kpi-guests">—</div><div class="stat-label">Total Guests</div></div>
                        <div class="stat-card"><div class="stat-icon"><iconify-icon icon="line-md:wifi-loop" width="28"></iconify-icon></div><div class="stat-value" id="kpi-active">—</div><div class="stat-label">Active Now</div></div>
                        <div class="stat-card"><div class="stat-icon"><iconify-icon icon="line-md:check-all" width="28"></iconify-icon></div><div class="stat-value" id="kpi-approved">—</div><div class="stat-label">Approved</div></div>
                        <div class="stat-card"><div class="stat-icon"><iconify-icon icon="line-md:globe-twotone" width="28"></iconify-icon></div><div class="stat-value" id="kpi-domains">—</div><div class="stat-label">Domains Today</div></div>
                    </div>

                    <!-- Charts row 1 -->
                    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Guest Registrations</h3></div>
                            <div class="chart-container" style="height:200px"><canvas id="registrations-chart"></canvas></div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Approval Rate</h3></div>
                            <div class="chart-container" style="height:200px"><canvas id="approval-chart"></canvas></div>
                        </div>
                    </div>

                    <!-- Charts row 2 -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Top Users by Bandwidth</h3></div>
                            <div id="bandwidth-top-content">Loading...</div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Top Domains Visited</h3></div>
                            <div id="domains-top-content">Loading...</div>
                        </div>
                    </div>

                    <!-- Peak hours heatmap -->
                    <div class="card" style="margin-bottom:20px">
                        <div class="card-header"><h3 class="card-title">Peak Usage Hours</h3><span class="text-muted" style="font-size:12px">Connections by day and hour</span></div>
                        <div id="heatmap-content" style="padding:12px;overflow-x:auto">Loading...</div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    const charts = {};
    const days = () => container.querySelector('#days-select').value;

    async function loadOverview() {
        try {
            const data = await api.get('/analytics/overview');
            container.querySelector('#kpi-guests').textContent = data.guests.total;
            container.querySelector('#kpi-approved').textContent = data.guests.approved;
            container.querySelector('#kpi-domains').textContent = data.browsing.unique_domains_today;
            // Use DB active count as initial value; live MikroTik fetch below will override
            container.querySelector('#kpi-active').textContent = data.connections.active;
        } catch {}

        // Active sessions: prefer live MikroTik count over DB count
        try {
            const sessions = await api.get('/mikrotik/hotspot/active');
            const liveCount = Array.isArray(sessions) ? sessions.length : 0;
            container.querySelector('#kpi-active').textContent = liveCount;
        } catch {}
    }

    async function loadRegistrations() {
        try {
            const data = await api.get(`/analytics/registrations?days=${days()}`);
            const labels = data.map(d => d.date.slice(5)); // MM-DD
            const values = data.map(d => d.count);

            const ctx = container.querySelector('#registrations-chart').getContext('2d');
            if (charts.reg) charts.reg.destroy();
            charts.reg = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Registrations',
                        data: values,
                        backgroundColor: 'rgba(78,115,223,0.6)',
                        borderColor: '#4e73df',
                        borderWidth: 1,
                        borderRadius: 3,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(99,130,190,.1)' }, ticks: { color: 'rgba(200,215,240,.6)', maxTicksLimit: 10 } },
                        y: { grid: { color: 'rgba(99,130,190,.1)' }, ticks: { color: 'rgba(200,215,240,.6)' } },
                    },
                },
            });
        } catch {}
    }

    async function loadApprovalRate() {
        try {
            const data = await api.get('/analytics/overview');
            const { approved, rejected, pending } = data.guests;
            const ctx = container.querySelector('#approval-chart').getContext('2d');
            if (charts.approval) charts.approval.destroy();
            charts.approval = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Approved', 'Rejected', 'Pending'],
                    datasets: [{
                        data: [approved, rejected, pending],
                        backgroundColor: ['#34d399', '#f87171', '#f59f00'],
                        borderWidth: 0,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: 'rgba(200,215,240,.7)', padding: 12, font: { size: 11 } } } },
                    cutout: '65%',
                },
            });
        } catch {}
    }

    async function loadBandwidthTop() {
        const el = container.querySelector('#bandwidth-top-content');
        try {
            const data = await api.get(`/analytics/bandwidth-top?days=${days()}&limit=8`);
            if (!data.length) { el.innerHTML = '<div class="empty-state" style="padding:16px"><p>No data</p></div>'; return; }
            const max = Math.max(...data.map(d => d.total_bytes)) || 1;
            el.innerHTML = `<div style="padding:12px 16px">
                ${data.map(d => `
                    <div style="margin-bottom:10px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                            <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-main)">${d.username}</span>
                            <span style="font-size:11px;color:var(--text-muted)">${_fmt(d.total_bytes)}</span>
                        </div>
                        <div style="background:var(--border);border-radius:3px;height:5px">
                            <div style="background:var(--accent-rx);width:${Math.round(d.total_bytes/max*100)}%;height:100%;border-radius:3px"></div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        } catch (err) { el.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    }

    async function loadDomainsTop() {
        const el = container.querySelector('#domains-top-content');
        try {
            const data = await api.get(`/analytics/domains-top?days=${days()}&limit=8`);
            if (!data.length) { el.innerHTML = '<div class="empty-state" style="padding:16px"><p>No data</p></div>'; return; }
            const max = Math.max(...data.map(d => d.count)) || 1;
            el.innerHTML = `<div style="padding:12px 16px">
                ${data.map(d => `
                    <div style="margin-bottom:10px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                            <span style="font-size:12px;font-family:var(--font-mono);color:var(--text-main)">${d.domain}</span>
                            <span style="font-size:11px;color:var(--text-muted)">${d.count} queries</span>
                        </div>
                        <div style="background:var(--border);border-radius:3px;height:5px">
                            <div style="background:var(--accent-tx);width:${Math.round(d.count/max*100)}%;height:100%;border-radius:3px"></div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        } catch (err) { el.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    }

    async function loadHeatmap() {
        const el = container.querySelector('#heatmap-content');
        try {
            const data = await api.get(`/analytics/peak-hours?days=${days()}`);
            // Build 7×24 matrix
            const matrix = Array.from({length: 7}, () => Array(24).fill(0));
            data.forEach(d => { if (d.dow >= 1 && d.dow <= 7) matrix[d.dow - 1][d.hour] = d.count; });
            const maxVal = Math.max(...matrix.flat()) || 1;
            const days_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const hours = Array.from({length: 24}, (_, i) => i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i-12}p`);

            el.innerHTML = `
                <div style="display:flex;gap:4px;align-items:flex-start;min-width:600px">
                    <div style="display:flex;flex-direction:column;gap:3px;padding-top:20px">
                        ${days_labels.map(d => `<div style="height:18px;line-height:18px;font-size:11px;color:var(--text-muted);text-align:right;padding-right:6px;width:32px">${d}</div>`).join('')}
                    </div>
                    <div style="flex:1">
                        <div style="display:flex;gap:3px;margin-bottom:3px">
                            ${hours.map(h => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text-muted)">${h}</div>`).join('')}
                        </div>
                        ${matrix.map(row => `
                            <div style="display:flex;gap:3px;margin-bottom:3px">
                                ${row.map(val => {
                                    const intensity = val / maxVal;
                                    const alpha = 0.1 + intensity * 0.85;
                                    const bg = val === 0 ? 'rgba(99,130,190,.05)' : `rgba(56,189,248,${alpha.toFixed(2)})`;
                                    return `<div style="flex:1;height:18px;border-radius:2px;background:${bg}" title="${val} connections"></div>`;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:var(--text-muted)">
                    <span>Low</span>
                    ${Array.from({length: 5}, (_, i) => {
                        const a = 0.1 + (i/4)*0.85;
                        return `<div style="width:14px;height:14px;border-radius:2px;background:rgba(56,189,248,${a.toFixed(2)})"></div>`;
                    }).join('')}
                    <span>High</span>
                </div>
            `;
        } catch (err) { el.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    }

    async function loadAll() {
        await Promise.all([loadOverview(), loadRegistrations(), loadApprovalRate(), loadBandwidthTop(), loadDomainsTop(), loadHeatmap()]);
    }

    container.querySelector('#days-select').addEventListener('change', loadAll);
    loadAll();

    const cleanup = () => {
        Object.values(charts).forEach(c => c.destroy());
        destroyTopbar();
        window.removeEventListener('hashchange', cleanup);
    };
    window.addEventListener('hashchange', cleanup, { once: true });
}
