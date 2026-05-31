import { authStore } from '../store/auth.js';
import { navigate } from '../router.js';
import { api } from '../api/client.js';

export function renderSidebar(container) {
    const isAdmin = authStore.isAdmin();
    const user = authStore.getUser();

    const nav = [
        { path: '/dashboard', icon: '⊞', label: 'Dashboard', roles: ['admin','operator'] },
        { path: '/guests/queue', icon: '⏳', label: 'Guest Queue', roles: ['admin','operator'] },
        { path: '/connections/active', icon: '📡', label: 'Active Connections', roles: ['admin','operator'] },
        { path: '/connections/history', icon: '📋', label: 'History', roles: ['admin','operator'] },
        null, // divider
        { path: '/employees', icon: '👥', label: 'Employees', roles: ['admin'] },
        { path: '/settings', icon: '⚙️', label: 'Settings', roles: ['admin'] },
        { path: '/audit', icon: '📜', label: 'Audit Log', roles: ['admin'] },
        null,
        { path: '/router/interfaces', icon: '🔌', label: 'Interfaces', roles: ['admin'] },
        { path: '/router/dhcp', icon: '🏷️', label: 'DHCP', roles: ['admin'] },
        { path: '/router/firewall', icon: '🛡️', label: 'Firewall', roles: ['admin'] },
        { path: '/router/dns', icon: '🌐', label: 'DNS', roles: ['admin'] },
        { path: '/router/queues', icon: '⏱️', label: 'Queues', roles: ['admin'] },
        { path: '/router/hotspot', icon: '📶', label: 'Hotspot Server', roles: ['admin'] },
        { path: '/router/system', icon: '💻', label: 'System Resources', roles: ['admin'] },
    ];

    const currentPath = window.location.hash.slice(1) || '/dashboard';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <span class="logo-icon">📶</span>
                <span class="logo-text">HotspotMgr</span>
            </div>
            <div class="sidebar-user">
                <span class="user-badge ${user?.role}">${user?.role?.toUpperCase()}</span>
                <span class="user-name">${user?.username || ''}</span>
            </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
            <button class="btn-logout" id="logout-btn">Sign Out</button>
        </div>
    `;

    const navEl = sidebar.querySelector('#sidebar-nav');
    nav.forEach(item => {
        if (item === null) {
            navEl.insertAdjacentHTML('beforeend', '<hr class="nav-divider">');
            return;
        }
        if (!item.roles.includes(user?.role)) return;
        const a = document.createElement('a');
        a.href = '#' + item.path;
        a.className = 'nav-item' + (item.path === currentPath ? ' active' : '');
        a.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
        navEl.appendChild(a);
    });

    sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
        try { await api.post('/auth/logout', {}); } catch {}
        authStore.clear();
        navigate('/login');
    });

    container.appendChild(sidebar);
}
