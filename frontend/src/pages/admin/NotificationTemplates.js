import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';
import { showModal, closeModal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { pageEnter, rowsIn } from '../../core/anim.js';

const CHANNEL_LABELS = { email: 'Email', sms: 'SMS', telegram: 'Telegram' };
const CHANNEL_ICONS  = { email: 'tabler:mail', sms: 'tabler:message', telegram: 'tabler:brand-telegram' };
const TYPE_COLORS    = { email: 'var(--accent-rx)', sms: 'var(--accent-warn)', telegram: '#2AABEE' };

let _templates = [];
let _filter = { channel: 'all', search: '' };

export async function renderNotificationTemplates(container) {
    container.innerHTML = '';
    renderSidebar(container);
    const main = document.createElement('div');
    main.className = 'main-content';
    main.innerHTML = `
        <div class="page-header">
            <h1>Notification Templates</h1>
            <span class="badge" style="background:var(--accent-rx)20;color:var(--accent-rx);padding:4px 10px;border-radius:20px;font-size:0.75rem" id="tpl-count">Loading…</span>
        </div>
        <div class="card" style="margin-bottom:16px">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                <div class="tab-row" id="channel-tabs">
                    ${['all','email','sms','telegram'].map(c => `
                        <button class="tab-btn ${c==='all'?'active':''}" data-channel="${c}">${c==='all'?'All':CHANNEL_LABELS[c]}</button>
                    `).join('')}
                </div>
                <input type="search" id="tpl-search" placeholder="Search templates…" class="form-input" style="flex:1;min-width:200px;max-width:320px">
            </div>
        </div>
        <div id="tpl-body"><div class="loading-spinner" style="margin:60px auto"></div></div>
    `;
    container.appendChild(main);
    renderTopbar(main);

    main.querySelector('#channel-tabs').addEventListener('click', e => {
        const btn = e.target.closest('[data-channel]');
        if (!btn) return;
        main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter.channel = btn.dataset.channel;
        _renderTable(main);
    });

    main.querySelector('#tpl-search').addEventListener('input', e => {
        _filter.search = e.target.value.toLowerCase();
        _renderTable(main);
    });

    try {
        _templates = await api.get('/notification-templates');
        main.querySelector('#tpl-count').textContent = `${_templates.length} templates`;
        _renderTable(main);
    } catch (e) {
        main.querySelector('#tpl-body').innerHTML = `<div class="empty-state"><p>Failed to load templates</p></div>`;
    }

    pageEnter(main);
}

function _renderTable(main) {
    const body = main.querySelector('#tpl-body');
    const filtered = _templates.filter(t => {
        if (_filter.channel !== 'all' && t.channel !== _filter.channel) return false;
        if (_filter.search && !t.label.toLowerCase().includes(_filter.search) && !t.slug.includes(_filter.search) && !t.event.includes(_filter.search)) return false;
        return true;
    });

    if (!filtered.length) {
        body.innerHTML = `<div class="empty-state"><iconify-icon icon="tabler:mail-off" width="48"></iconify-icon><p>No templates found</p></div>`;
        return;
    }

    body.innerHTML = `
        <div class="table-card">
            <table class="data-table">
                <thead><tr>
                    <th>Channel</th><th>Event</th><th>Label</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody id="tpl-tbody">
                    ${filtered.map(t => `
                    <tr data-id="${t.id}">
                        <td>
                            <span style="display:flex;align-items:center;gap:6px">
                                <iconify-icon icon="${CHANNEL_ICONS[t.channel]}" style="color:${TYPE_COLORS[t.channel]}"></iconify-icon>
                                <span style="color:${TYPE_COLORS[t.channel]};font-size:0.78rem;font-weight:600">${CHANNEL_LABELS[t.channel]}</span>
                            </span>
                        </td>
                        <td><code style="font-size:0.72rem">${t.event}</code></td>
                        <td style="font-weight:500">${t.label}</td>
                        <td>
                            <label class="toggle-switch" title="${t.is_enabled?'Disable':'Enable'} template">
                                <input type="checkbox" class="tpl-toggle" data-id="${t.id}" ${t.is_enabled?'checked':''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </td>
                        <td>
                            <div style="display:flex;gap:6px">
                                <button class="btn btn-sm btn-ghost tpl-edit" data-id="${t.id}" title="Edit template">
                                    <iconify-icon icon="tabler:edit"></iconify-icon>
                                </button>
                                <button class="btn btn-sm btn-ghost tpl-test" data-id="${t.id}" title="Test send">
                                    <iconify-icon icon="tabler:send"></iconify-icon>
                                </button>
                                <button class="btn btn-sm btn-ghost tpl-preview" data-id="${t.id}" title="Preview">
                                    <iconify-icon icon="tabler:eye"></iconify-icon>
                                </button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;

    rowsIn(body.querySelector('#tpl-tbody'));

    body.querySelectorAll('.tpl-toggle').forEach(chk => {
        chk.addEventListener('change', async () => {
            const id = chk.dataset.id;
            try {
                await api.post(`/notification-templates/${id}/toggle`, {});
                const tpl = _templates.find(t => String(t.id) === id);
                if (tpl) tpl.is_enabled = chk.checked;
                success(chk.checked ? 'Template enabled' : 'Template disabled');
            } catch {
                chk.checked = !chk.checked;
                error('Failed to toggle template');
            }
        });
    });

    body.querySelectorAll('.tpl-edit').forEach(btn => {
        btn.addEventListener('click', () => _openEditModal(_templates.find(t => String(t.id) === btn.dataset.id)));
    });

    body.querySelectorAll('.tpl-test').forEach(btn => {
        btn.addEventListener('click', () => _testSend(btn.dataset.id, btn));
    });

    body.querySelectorAll('.tpl-preview').forEach(btn => {
        btn.addEventListener('click', () => _openPreview(_templates.find(t => String(t.id) === btn.dataset.id)));
    });
}

function _openEditModal(tpl) {
    if (!tpl) return;
    const vars = (tpl.variables || []).map(v => `<span class="var-chip">{${v}}</span>`).join('');
    showModal(`Edit: ${tpl.label}`, `
        <div style="display:flex;flex-direction:column;gap:14px">
            ${tpl.channel === 'email' ? `
            <div>
                <label class="form-label">Subject</label>
                <input id="tpl-subject" class="form-input" value="${(tpl.subject||'').replace(/"/g,'&quot;')}" placeholder="Email subject…">
            </div>` : ''}
            <div>
                <label class="form-label">Body</label>
                <textarea id="tpl-body-ta" class="form-input" rows="12" style="font-family:var(--font-mono);font-size:0.8rem">${tpl.body || ''}</textarea>
            </div>
            ${vars ? `<div><label class="form-label">Variables</label><div style="display:flex;flex-wrap:wrap;gap:6px">${vars}</div></div>` : ''}
        </div>
    `, [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Save Changes', class: 'btn-primary', action: async () => {
            const body = document.getElementById('tpl-body-ta')?.value;
            const subject = document.getElementById('tpl-subject')?.value;
            try {
                const updated = await api.put(`/notification-templates/${tpl.id}`, { body, subject });
                const idx = _templates.findIndex(t => t.id === tpl.id);
                if (idx >= 0) _templates[idx] = { ..._templates[idx], ...updated };
                success('Template saved');
                closeModal();
            } catch {
                error('Failed to save template');
            }
        }},
    ]);
}

async function _testSend(id, btn) {
    btn.disabled = true;
    try {
        await api.post(`/notification-templates/${id}/test`, {});
        success('Test message sent!');
    } catch {
        error('Test send failed');
    } finally {
        btn.disabled = false;
    }
}

function _openPreview(tpl) {
    if (!tpl) return;
    const vars = tpl.variables || [];
    const sampleBody = vars.reduce((b, v) => b.replaceAll(`{${v}}`, `<b>[${v}]</b>`), tpl.body || '');
    showModal(`Preview: ${tpl.label}`, `
        <div style="display:flex;flex-direction:column;gap:10px">
            ${tpl.subject ? `<div style="font-weight:600;font-size:0.9rem">Subject: ${tpl.subject}</div>` : ''}
            <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:16px;font-size:0.83rem;line-height:1.7;white-space:pre-wrap;overflow-y:auto;max-height:360px">${sampleBody}</div>
        </div>
    `, [{ label: 'Close', class: 'btn-ghost', action: closeModal }]);
}
