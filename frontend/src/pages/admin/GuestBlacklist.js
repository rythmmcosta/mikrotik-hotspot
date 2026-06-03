import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';
import { showModal, closeModal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { pageEnter, rowsIn } from '../../core/anim.js';

const TYPE_COLOR = { email: 'var(--accent-rx)', mobile: 'var(--accent-warn)', ip: 'var(--accent-err)' };
const TYPE_ICON  = { email: 'tabler:mail', mobile: 'tabler:phone', ip: 'tabler:network' };

let _entries = [];

export async function renderGuestBlacklist(container) {
    container.innerHTML = '';
    renderSidebar(container);
    const main = document.createElement('div');
    main.className = 'main-content';
    main.innerHTML = `
        <div class="page-header">
            <h1>Guest Blacklist</h1>
            <button class="btn btn-primary" id="add-blacklist">
                <iconify-icon icon="tabler:plus"></iconify-icon> Add Entry
            </button>
        </div>
        <div id="bl-body"><div class="loading-spinner" style="margin:60px auto"></div></div>
    `;
    container.appendChild(main);
    renderTopbar(main);

    main.querySelector('#add-blacklist').addEventListener('click', _openAddModal);

    await _load(main);
    pageEnter(main);
}

async function _load(main) {
    try {
        _entries = await api.get('/guests/blacklist');
        _renderTable(main);
    } catch {
        main.querySelector('#bl-body').innerHTML = `<div class="empty-state"><p>Failed to load blacklist</p></div>`;
    }
}

function _renderTable(main) {
    const body = main.querySelector('#bl-body');
    if (!_entries.length) {
        body.innerHTML = `<div class="empty-state"><iconify-icon icon="tabler:ban" width="48"></iconify-icon><p>No blacklisted entries</p><p style="color:var(--text-muted);font-size:0.8rem">Blocked guests will be rejected automatically</p></div>`;
        return;
    }
    body.innerHTML = `
        <div class="table-card">
            <table class="data-table">
                <thead><tr><th>Type</th><th>Value</th><th>Reason</th><th>Added</th><th>Action</th></tr></thead>
                <tbody id="bl-tbody">
                    ${_entries.map(e => `
                    <tr>
                        <td><span style="display:flex;align-items:center;gap:6px;color:${TYPE_COLOR[e.type] || '#888'}">
                            <iconify-icon icon="${TYPE_ICON[e.type] || 'tabler:circle'}"></iconify-icon>
                            <span style="font-weight:600;text-transform:capitalize;font-size:0.78rem">${e.type}</span>
                        </span></td>
                        <td><code style="font-size:0.82rem">${e.value}</code></td>
                        <td style="color:var(--text-muted);font-size:0.82rem">${e.reason || '—'}</td>
                        <td style="font-size:0.78rem;color:var(--text-muted)">${_fmt(e.created_at)}</td>
                        <td><button class="btn btn-sm btn-ghost bl-del" data-id="${e.id}" title="Remove from blacklist">
                            <iconify-icon icon="tabler:trash" width="14"></iconify-icon>
                        </button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
    rowsIn(body.querySelector('#bl-tbody'));

    body.querySelectorAll('.bl-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Remove this entry from the blacklist?')) return;
            try {
                await api.delete(`/guests/blacklist/${btn.dataset.id}`);
                _entries = _entries.filter(e => String(e.id) !== btn.dataset.id);
                _renderTable(main);
                success('Entry removed');
            } catch { error('Failed to remove'); }
        });
    });
}

function _openAddModal() {
    showModal('Add to Blacklist', `
        <div style="display:flex;flex-direction:column;gap:14px">
            <div>
                <label class="form-label">Type</label>
                <select id="bl-type" class="form-input">
                    <option value="email">Email</option>
                    <option value="mobile">Mobile</option>
                    <option value="ip">IP Address</option>
                </select>
            </div>
            <div>
                <label class="form-label">Value</label>
                <input id="bl-value" class="form-input" placeholder="e.g. user@example.com">
            </div>
            <div>
                <label class="form-label">Reason (optional)</label>
                <input id="bl-reason" class="form-input" placeholder="Why is this being blocked?">
            </div>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Add to Blacklist', class: 'btn-danger', action: async () => {
            const type  = document.getElementById('bl-type')?.value;
            const value = document.getElementById('bl-value')?.value?.trim();
            const reason= document.getElementById('bl-reason')?.value?.trim();
            if (!value) { error('Please enter a value'); return; }
            try {
                const entry = await api.post('/guests/blacklist', { type, value, reason: reason || null });
                _entries.unshift(entry);
                closeModal();
                const main = document.querySelector('.main-content');
                if (main) _renderTable(main);
                success('Entry added to blacklist');
            } catch (err) {
                error(err?.detail || 'Failed to add entry');
            }
        }},
    ]);
}

function _fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}
