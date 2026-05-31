import { authStore } from '../store/auth.js';
import { navigate } from '../router.js';
import { api } from '../api/client.js';

const NAV_SECTIONS = [
    {
        title: 'Monitor',
        items: [
            { path: '/dashboard',           icon: '▦',  label: 'Dashboard',           roles: ['admin', 'operator'] },
            { path: '/guests/queue',         icon: '⏳', label: 'Guest Queue',          roles: ['admin', 'operator'] },
            { path: '/connections/active',   icon: '⬡',  label: 'Active Connections',  roles: ['admin', 'operator'] },
            { path: '/connections/history',  icon: '≡',  label: 'History',             roles: ['admin', 'operator'] },
        ],
    },
    {
        title: 'Assets',
        items: [
            { path: '/assets',   icon: '⊟', label: 'Office Assets',  roles: ['admin', 'operator'] },
            { path: '/browsing', icon: '◉',  label: 'Browsing Log',   roles: ['admin', 'operator'] },
            { path: '/policies', icon: '⊗',  label: 'Usage Policies', roles: ['admin'] },
        ],
    },
    {
        title: 'Management',
        items: [
            { path: '/employees', icon: '◎', label: 'Employees',  roles: ['admin'] },
            { path: '/settings',  icon: '⚙', label: 'Settings',   roles: ['admin'] },
            { path: '/audit',     icon: '≋',  label: 'Audit Log',  roles: ['admin'] },
        ],
    },
    {
        title: 'Router',
        items: [
            { path: '/router/interfaces', icon: '⊡', label: 'Interfaces',      roles: ['admin'] },
            { path: '/router/dhcp',       icon: '◫', label: 'DHCP',            roles: ['admin'] },
            { path: '/router/firewall',   icon: '⊞', label: 'Firewall',        roles: ['admin'] },
            { path: '/router/dns',        icon: '◌', label: 'DNS',             roles: ['admin'] },
            { path: '/router/queues',     icon: '⊟', label: 'Queues',          roles: ['admin'] },
            { path: '/router/hotspot',    icon: '◈', label: 'Hotspot Server',  roles: ['admin'] },
            { path: '/router/system',     icon: '▣', label: 'System',          roles: ['admin'] },
        ],
    },
];

export function renderSidebar(container) {
    const user = authStore.getUser();
    const currentPath = window.location.hash.slice(1) || '/dashboard';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <span class="logo-icon" style="margin-right:8px">◈</span>
                <span class="logo-text">HotspotMgr</span>
            </div>
        </div>
        <div class="sidebar-user">
            <span class="user-badge ${user?.role}">${(user?.role || '').toUpperCase()}</span>
            <span class="user-name" style="margin-left:6px">${user?.username || ''}</span>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
            <button class="btn-logout" id="logout-btn">Sign Out</button>
        </div>
    `;

    const navEl = sidebar.querySelector('#sidebar-nav');

    NAV_SECTIONS.forEach(section => {
        const visibleItems = section.items.filter(item => item.roles.includes(user?.role));
        if (!visibleItems.length) return;

        const titleEl = document.createElement('div');
        titleEl.className = 'nav-section-title';
        titleEl.textContent = section.title;
        navEl.appendChild(titleEl);

        visibleItems.forEach(item => {
            const a = document.createElement('a');
            a.href = '#' + item.path;
            a.className = 'nav-item' + (item.path === currentPath ? ' active' : '');
            a.innerHTML = `<span class="nav-icon" style="font-size:12px;width:18px;display:inline-block">${item.icon}</span><span>${item.label}</span>`;
            navEl.appendChild(a);
        });
    });

    sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
        try { await api.post('/auth/logout', {}); } catch {}
        authStore.clear();
        navigate('/login');
    });

    // Update active state on navigation
    window.addEventListener('hashchange', () => {
        const path = window.location.hash.slice(1) || '/dashboard';
        navEl.querySelectorAll('.nav-item').forEach(a => {
            const href = a.getAttribute('href')?.slice(1);
            a.classList.toggle('active', href === path);
        });
    });

    container.appendChild(sidebar);
}
