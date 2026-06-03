import { authStore } from '../store/auth.js';
import { navigate } from '../router.js';
import { api } from '../api/client.js';

const ICONS = {
    dashboard:   'tabler:layout-dashboard',
    queue:       'tabler:clock-hour-4',
    connections: 'tabler:wifi',
    history:     'tabler:history',
    assets:      'tabler:monitor',
    browsing:    'tabler:globe',
    policies:    'tabler:shield-check',
    employees:   'tabler:users',
    bandwidth:   'tabler:antenna-bars-5',
    analytics:   'tabler:chart-bar',
    vouchers:    'tabler:ticket',
    health:      'tabler:heart-rate-monitor',
    settings:    'tabler:settings',
    audit:       'tabler:file-analytics',
    interfaces:  'tabler:cpu',
    dhcp:        'tabler:server',
    firewall:    'tabler:shield-lock',
    dns:         'tabler:network',
    queues:      'tabler:filter',
    hotspot:     'tabler:wifi-2',
    system:      'tabler:device-desktop-analytics',
    profile:     'tabler:user-circle',
    logout:      'tabler:logout',
    theme:       'tabler:palette',
};

const THEMES = [
    { id: 'dark',       label: 'Dark',       dot: '#38bdf8' },
    { id: 'light',      label: 'Light',      dot: '#0ea5e9' },
    { id: 'nord',       label: 'Nord',       dot: '#88c0d0' },
    { id: 'catppuccin', label: 'Catppuccin', dot: '#cba6f7' },
    { id: 'dracula',    label: 'Dracula',    dot: '#bd93f9' },
    { id: 'tokyo',      label: 'Tokyo Night',dot: '#7aa2f7' },
];

const NAV_SECTIONS = [
    {
        title: 'Monitor',
        items: [
            { path: '/dashboard',          icon: ICONS.dashboard,   label: 'Dashboard',          roles: ['admin', 'operator'] },
            { path: '/guests/queue',        icon: ICONS.queue,       label: 'Guest Queue',         roles: ['admin', 'operator'] },
            { path: '/connections/active',  icon: ICONS.connections, label: 'Active Connections',  roles: ['admin', 'operator'] },
            { path: '/connections/history', icon: ICONS.history,     label: 'History',             roles: ['admin', 'operator'] },
        ],
    },
    {
        title: 'Assets',
        items: [
            { path: '/assets',   icon: ICONS.assets,   label: 'Office Assets',  roles: ['admin', 'operator'] },
            { path: '/browsing', icon: ICONS.browsing, label: 'Browsing Log',   roles: ['admin', 'operator'] },
            { path: '/policies', icon: ICONS.policies, label: 'Usage Policies', roles: ['admin'] },
        ],
    },
    {
        title: 'Management',
        items: [
            { path: '/employees',  icon: ICONS.employees,  label: 'Employees',  roles: ['admin'] },
            { path: '/bandwidth',  icon: ICONS.bandwidth,  label: 'Bandwidth',  roles: ['admin'] },
            { path: '/vouchers',   icon: ICONS.vouchers,   label: 'Vouchers',   roles: ['admin'] },
            { path: '/analytics',  icon: ICONS.analytics,  label: 'Analytics',  roles: ['admin'] },
            { path: '/settings',   icon: ICONS.settings,   label: 'Settings',   roles: ['admin'] },
            { path: '/audit',      icon: ICONS.audit,      label: 'Audit Log',  roles: ['admin'] },
            { path: '/system/health', icon: ICONS.health,  label: 'Sys Health', roles: ['admin'] },
        ],
    },
    {
        title: 'Router',
        items: [
            { path: '/router/interfaces', icon: ICONS.interfaces, label: 'Interfaces',     roles: ['admin'] },
            { path: '/router/dhcp',       icon: ICONS.dhcp,       label: 'DHCP',           roles: ['admin'] },
            { path: '/router/firewall',   icon: ICONS.firewall,   label: 'Firewall',       roles: ['admin'] },
            { path: '/router/dns',        icon: ICONS.dns,        label: 'DNS',            roles: ['admin'] },
            { path: '/router/queues',     icon: ICONS.queues,     label: 'Queues',         roles: ['admin'] },
            { path: '/router/hotspot',    icon: ICONS.hotspot,    label: 'Hotspot Server', roles: ['admin'] },
            { path: '/router/system',     icon: ICONS.system,     label: 'System',         roles: ['admin'] },
        ],
    },
];

function _icon(name, size = 18) {
    return `<iconify-icon icon="${name}" width="${size}" height="${size}" style="flex-shrink:0"></iconify-icon>`;
}

export function renderSidebar(container) {
    const user = authStore.getUser();
    const role = user?.role || 'operator';
    const currentPath = window.location.hash.slice(1) || '/dashboard';
    const avatarUrl = authStore.getAvatar();
    const displayName = authStore.getDisplayName();

    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo-icon">${_icon('tabler:router', 22)}</div>
            <span class="sidebar-logo-text">HotspotMgr</span>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav"></nav>

        <div class="sidebar-footer">
            <!-- Theme toggle -->
            <div style="position:relative">
                <button class="nav-item" id="theme-toggle-btn" title="Change Theme">
                    ${_icon(ICONS.theme, 18)}
                    <span class="nav-item-label">Theme</span>
                </button>
                <div class="theme-menu" id="theme-menu">
                    ${THEMES.map(t => `
                        <button class="theme-opt ${document.documentElement.getAttribute('data-theme') === t.id ? 'active' : ''}" data-theme="${t.id}">
                            <span style="width:10px;height:10px;border-radius:50%;background:${t.dot};flex-shrink:0"></span>
                            ${t.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Profile link -->
            <a href="#/profile" class="sidebar-user-chip nav-item ${currentPath === '/profile' ? 'active' : ''}">
                <img src="${avatarUrl}" alt="avatar" class="avatar-img" style="width:26px;height:26px;border-radius:50%;flex-shrink:0" onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=user'">
                <div class="sidebar-user-info">
                    <div class="sidebar-user-name">${displayName}</div>
                    <div class="sidebar-user-role">${role}</div>
                </div>
            </a>

            <!-- Logout -->
            <button class="nav-item" id="logout-btn" title="Sign Out">
                ${_icon(ICONS.logout, 18)}
                <span class="nav-item-label">Sign Out</span>
            </button>

            <!-- Credit -->
            <div class="sidebar-credit">
                UI inspired by <a href="https://github.com/SecOps-7/MikroDash" target="_blank" rel="noopener">MikroDash</a>
            </div>
        </div>
    `;

    // Build nav items
    const navEl = sidebar.querySelector('#sidebar-nav');
    NAV_SECTIONS.forEach(section => {
        const visibleItems = section.items.filter(item => item.roles.includes(role));
        if (!visibleItems.length) return;

        const titleEl = document.createElement('div');
        titleEl.className = 'nav-section-title';
        titleEl.textContent = section.title;
        navEl.appendChild(titleEl);

        visibleItems.forEach(item => {
            const a = document.createElement('a');
            a.href = '#' + item.path;
            a.className = 'nav-item' + (_isActive(item.path, currentPath) ? ' active' : '');
            a.innerHTML = `${_icon(item.icon, 18)}<span class="nav-item-label">${item.label}</span>`;
            navEl.appendChild(a);
        });
    });

    // Logout
    sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
        try { await api.post('/auth/logout', {}); } catch {}
        authStore.clear();
        navigate('/login');
    });

    // Theme toggle
    const themeBtn = sidebar.querySelector('#theme-toggle-btn');
    const themeMenu = sidebar.querySelector('#theme-menu');
    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle('open');
    });
    themeMenu.querySelectorAll('.theme-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('mikrodash_theme', theme);
            themeMenu.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            themeMenu.classList.remove('open');
        });
    });
    document.addEventListener('click', () => themeMenu.classList.remove('open'));

    // Active state on navigation
    window.addEventListener('hashchange', _updateActive.bind(null, navEl, sidebar));

    container.appendChild(sidebar);
}

function _isActive(itemPath, currentPath) {
    if (itemPath === '/dashboard') return currentPath === '/dashboard' || currentPath === '/';
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
}

function _updateActive(navEl, sidebar) {
    const path = window.location.hash.slice(1) || '/dashboard';
    navEl.querySelectorAll('.nav-item[href]').forEach(a => {
        const href = a.getAttribute('href')?.slice(1) || '';
        a.classList.toggle('active', _isActive(href, path));
    });
    // Also update profile chip active state
    const chip = sidebar.querySelector('.sidebar-user-chip');
    if (chip) chip.classList.toggle('active', path === '/profile');
}
