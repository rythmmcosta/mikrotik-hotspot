import { authStore } from './store/auth.js';
import { renderLogin } from './pages/Login.js';
import { renderDashboard } from './pages/Dashboard.js';
import { renderGuestQueue } from './pages/shared/GuestQueue.js';
import { renderActiveConnections } from './pages/shared/ActiveConnections.js';
import { renderConnectionHistory } from './pages/shared/ConnectionHistory.js';
import { renderEmployees } from './pages/admin/Employees.js';
import { renderSettings } from './pages/admin/Settings.js';
import { renderAuditLog } from './pages/admin/AuditLog.js';
import { renderInterfaces } from './pages/admin/router/Interfaces.js';
import { renderDHCP } from './pages/admin/router/DHCP.js';
import { renderFirewall } from './pages/admin/router/Firewall.js';
import { renderSystemResources } from './pages/admin/router/SystemResources.js';
import { renderHotspotServer } from './pages/admin/router/HotspotServer.js';
import { renderDNS } from './pages/admin/router/DNS.js';
import { renderQueues } from './pages/admin/router/Queues.js';

const routes = {
    '/login':                renderLogin,
    '/dashboard':            renderDashboard,
    '/guests/queue':         renderGuestQueue,
    '/connections/active':   renderActiveConnections,
    '/connections/history':  renderConnectionHistory,
    '/employees':            renderEmployees,
    '/settings':             renderSettings,
    '/audit':                renderAuditLog,
    '/router/interfaces':    renderInterfaces,
    '/router/dhcp':          renderDHCP,
    '/router/firewall':      renderFirewall,
    '/router/system':        renderSystemResources,
    '/router/hotspot':       renderHotspotServer,
    '/router/dns':           renderDNS,
    '/router/queues':        renderQueues,
};

const ADMIN_ONLY = ['/employees', '/settings', '/audit', '/router/interfaces',
                    '/router/dhcp', '/router/firewall', '/router/system',
                    '/router/hotspot', '/router/dns', '/router/queues'];

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

        const renderer = routes[hash] || renderDashboard;
        app.innerHTML = '';
        renderer(app);
    }

    window.addEventListener('hashchange', render);
    render();
}
