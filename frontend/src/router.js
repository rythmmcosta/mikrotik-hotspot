import { authStore } from './store/auth.js';
import { renderLogin } from './pages/Login.js';
import { renderDashboard } from './pages/Dashboard.js';
import { renderProfile } from './pages/Profile.js';
import { renderGuestQueue } from './pages/shared/GuestQueue.js';
import { renderActiveConnections } from './pages/shared/ActiveConnections.js';
import { renderConnectionHistory } from './pages/shared/ConnectionHistory.js';
import { renderEmployees } from './pages/admin/Employees.js';
import { renderSettings } from './pages/admin/Settings.js';
import { renderAuditLog } from './pages/admin/AuditLog.js';
import { renderAssets } from './pages/admin/Assets.js';
import { renderAssetDetail } from './pages/admin/AssetDetail.js';
import { renderBrowsingLog } from './pages/admin/BrowsingLog.js';
import { renderPolicies } from './pages/admin/Policies.js';
import { renderBandwidth } from './pages/admin/Bandwidth.js';
import { renderAnalytics } from './pages/admin/Analytics.js';
import { renderSystemHealth } from './pages/admin/SystemHealth.js';
import { renderVouchers } from './pages/admin/Vouchers.js';
import { renderInterfaces } from './pages/admin/router/Interfaces.js';
import { renderDHCP } from './pages/admin/router/DHCP.js';
import { renderFirewall } from './pages/admin/router/Firewall.js';
import { renderSystemResources } from './pages/admin/router/SystemResources.js';
import { renderHotspotServer } from './pages/admin/router/HotspotServer.js';
import { renderDNS } from './pages/admin/router/DNS.js';
import { renderQueues } from './pages/admin/router/Queues.js';
import { renderNotificationTemplates } from './pages/admin/NotificationTemplates.js';
import { renderNotificationInbox } from './pages/admin/NotificationInbox.js';
import { renderGuestBlacklist } from './pages/admin/GuestBlacklist.js';
import { renderDepartments } from './pages/admin/Departments.js';

const routes = {
    '/login':                      renderLogin,
    '/dashboard':                  renderDashboard,
    '/profile':                    renderProfile,
    '/guests/queue':               renderGuestQueue,
    '/connections/active':         renderActiveConnections,
    '/connections/history':        renderConnectionHistory,
    '/employees':                  renderEmployees,
    '/assets':                     renderAssets,
    '/browsing':                   renderBrowsingLog,
    '/policies':                   renderPolicies,
    '/bandwidth':                  renderBandwidth,
    '/analytics':                  renderAnalytics,
    '/system/health':              renderSystemHealth,
    '/vouchers':                   renderVouchers,
    '/settings':                   renderSettings,
    '/audit':                      renderAuditLog,
    '/router/interfaces':          renderInterfaces,
    '/router/dhcp':                renderDHCP,
    '/router/firewall':            renderFirewall,
    '/router/system':              renderSystemResources,
    '/router/hotspot':             renderHotspotServer,
    '/router/dns':                 renderDNS,
    '/router/queues':              renderQueues,
    '/notification-templates':     renderNotificationTemplates,
    '/notifications':              renderNotificationInbox,
    '/guests/blacklist':           renderGuestBlacklist,
    '/departments':                renderDepartments,
};

const ADMIN_ONLY = [
    '/employees', '/bandwidth', '/analytics', '/system/health', '/vouchers',
    '/settings', '/audit', '/policies', '/departments', '/guests/blacklist',
    '/notification-templates',
    '/router/interfaces', '/router/dhcp', '/router/firewall',
    '/router/system', '/router/hotspot', '/router/dns', '/router/queues',
];

export function navigate(path) {
    window.location.hash = '#' + path;
}

export function initRouter() {
    function render() {
        const hash = window.location.hash.slice(1) || '/dashboard';
        const app = document.getElementById('app');

        if (hash !== '/login' && !authStore.isLoggedIn()) {
            window.location.hash = '#/login';
            return;
        }

        if (ADMIN_ONLY.includes(hash) && !authStore.isAdmin()) {
            window.location.hash = '#/dashboard';
            return;
        }

        // Match asset detail route pattern /assets/{id}
        if (/^\/assets\/\d+$/.test(hash)) {
            app.innerHTML = '';
            renderAssetDetail(app);
            return;
        }

        const renderer = routes[hash] || _render404;
        app.innerHTML = '';
        renderer(app);
        _updateBottomNav(hash);
    }

    window.addEventListener('hashchange', render);
    _initBottomNav();
    render();
}

const BOTTOM_NAV = [
    { path: '/dashboard',       icon: 'tabler:layout-dashboard', label: 'Home' },
    { path: '/guests/queue',    icon: 'tabler:clock-hour-4',     label: 'Queue' },
    { path: '/assets',          icon: 'tabler:monitor',          label: 'Assets' },
    { path: '/notifications',   icon: 'tabler:bell',             label: 'Inbox' },
    { path: '/profile',         icon: 'tabler:user-circle',      label: 'Profile' },
];

function _initBottomNav() {
    let nav = document.getElementById('bottom-nav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'bottom-nav';
        nav.className = 'bottom-nav';
        nav.innerHTML = BOTTOM_NAV.map(item => `
            <a href="#${item.path}" class="bottom-nav-item" data-path="${item.path}">
                <iconify-icon icon="${item.icon}" width="22"></iconify-icon>
                <span>${item.label}</span>
            </a>
        `).join('');
        document.body.appendChild(nav);
    }
}

function _updateBottomNav(hash) {
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.path === hash);
    });
}

function _render404(container) {
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:var(--text-muted)">
            <iconify-icon icon="tabler:error-404" width="80" style="opacity:0.3"></iconify-icon>
            <h2 style="font-size:1.4rem;color:var(--text-main)">Page not found</h2>
            <p style="font-size:0.85rem">The page you're looking for doesn't exist.</p>
            <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
        </div>
    `;
}
