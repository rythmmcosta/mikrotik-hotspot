import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';
import { success, error } from '../../components/Toast.js';
import { pageEnter, rowsIn } from '../../core/anim.js';

const TYPE_ICON = { info: 'tabler:info-circle', success: 'tabler:circle-check', warning: 'tabler:alert-triangle', error: 'tabler:alert-circle' };
const TYPE_COLOR = { info: 'var(--accent-rx)', success: 'var(--accent-ok, #22c55e)', warning: 'var(--accent-warn)', error: 'var(--accent-err)' };

let _notifications = [];
let _tab = 'all';

export async function renderNotificationInbox(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h1>Notification Inbox</h1>
                        <div style="display:flex;gap:8px">
                            <button class="btn btn-sm btn-ghost" id="mark-all-read">
                                <iconify-icon icon="tabler:checks"></iconify-icon> Mark All Read
                            </button>
                        </div>
                    </div>
                    <div class="card" style="margin-bottom:16px">
                        <div class="tab-row" id="inbox-tabs">
                            <button class="tab-btn active" data-tab="all">All</button>
                            <button class="tab-btn" data-tab="unread">Unread</button>
                        </div>
                    </div>
                    <div id="inbox-body"><div class="loading-spinner" style="margin:60px auto"></div></div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    const main = container.querySelector('.main-content');

    container.querySelector('#inbox-tabs').addEventListener('click', e => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _tab = btn.dataset.tab;
        _renderList(main);
    });

    container.querySelector('#mark-all-read').addEventListener('click', async () => {
        try {
            await api.put('/notifications/read-all', {});
            _notifications.forEach(n => n.is_read = true);
            _renderList(main);
            success('All marked as read');
        } catch { error('Failed'); }
    });

    await _load(main);
    pageEnter(main);

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}

async function _load(main) {
    try {
        _notifications = await api.get('/notifications');
        _renderList(main);
    } catch {
        main.querySelector('#inbox-body').innerHTML = `<div class="empty-state"><p>Failed to load notifications</p></div>`;
    }
}

function _renderList(main) {
    const body = main.querySelector('#inbox-body');
    const filtered = _tab === 'unread' ? _notifications.filter(n => !n.is_read) : _notifications;

    if (!filtered.length) {
        body.innerHTML = `<div class="empty-state"><iconify-icon icon="tabler:bell-off" width="48"></iconify-icon><p>${_tab === 'unread' ? 'No unread notifications' : 'Your inbox is empty'}</p></div>`;
        return;
    }

    body.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden">
            <ul id="notif-list-ul" style="list-style:none;margin:0;padding:0">
                ${filtered.map(n => `
                <li class="inbox-item ${n.is_read ? '' : 'inbox-item--unread'}" data-id="${n.id}" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer">
                    <span style="flex-shrink:0;margin-top:2px;color:${TYPE_COLOR[n.type] || TYPE_COLOR.info}">
                        <iconify-icon icon="${TYPE_ICON[n.type] || TYPE_ICON.info}" width="20"></iconify-icon>
                    </span>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:${n.is_read?'400':'600'};font-size:0.88rem;margin-bottom:2px">${n.title}</div>
                        ${n.body ? `<div style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.body}</div>` : ''}
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${_timeAgo(n.created_at)}</div>
                    </div>
                    <button class="btn btn-sm btn-ghost notif-del" data-id="${n.id}" title="Delete" style="flex-shrink:0">
                        <iconify-icon icon="tabler:trash" width="14"></iconify-icon>
                    </button>
                </li>`).join('')}
            </ul>
        </div>
    `;

    rowsIn(body.querySelector('#notif-list-ul'));

    body.querySelectorAll('.inbox-item').forEach(item => {
        item.addEventListener('click', async e => {
            if (e.target.closest('.notif-del')) return;
            const id = item.dataset.id;
            const n = _notifications.find(n => String(n.id) === id);
            if (!n || n.is_read) return;
            try {
                await api.put(`/notifications/${id}/read`, {});
                n.is_read = true;
                item.classList.remove('inbox-item--unread');
                item.querySelector('div > div:first-child').style.fontWeight = '400';
            } catch { /* ignore */ }
        });
    });

    body.querySelectorAll('.notif-del').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
                await api.delete(`/notifications/${id}`);
                _notifications = _notifications.filter(n => String(n.id) !== id);
                _renderList(main);
            } catch { error('Failed to delete'); }
        });
    });
}

function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
