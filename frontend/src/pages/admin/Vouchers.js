import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

function _copyToClipboard(text) {
    navigator.clipboard?.writeText(text).catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    });
}

function _qrUrl(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
}

export async function renderVouchers(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Guest Vouchers</h2>
                        <button class="btn btn-primary" id="create-vouchers-btn">
                            <iconify-icon icon="tabler:ticket" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>Generate Vouchers
                        </button>
                    </div>
                    <div class="card">
                        <div class="toolbar" style="margin-bottom:12px">
                            <span id="vouchers-stats" style="font-size:13px;color:var(--text-muted)">Loading...</span>
                            <button class="btn btn-ghost btn-sm" id="refresh-btn">↻ Refresh</button>
                        </div>
                        <div id="vouchers-content">Loading...</div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function load() {
        const el = container.querySelector('#vouchers-content');
        const stats = container.querySelector('#vouchers-stats');
        try {
            const items = await api.get('/vouchers');
            const active = items.filter(v => v.is_active).length;
            const used = items.reduce((a, v) => a + v.used_count, 0);
            stats.textContent = `${items.length} total · ${active} active · ${used} used`;

            if (!items.length) {
                el.innerHTML = '<div class="empty-state"><div class="empty-icon"><iconify-icon icon="tabler:ticket-off" width="40"></iconify-icon></div><p>No vouchers yet</p></div>';
                return;
            }

            el.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Uses</th>
                            <th>Session</th>
                            <th>Expires</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                    ${items.map(v => `
                        <tr class="${!v.is_active ? 'text-muted' : ''}">
                            <td>
                                <code style="font-size:13px;font-weight:600;letter-spacing:1px">${v.code}</code>
                                <button class="btn btn-ghost btn-sm" data-copy="${v.code}" title="Copy code" style="padding:2px 6px;margin-left:4px">
                                    <iconify-icon icon="tabler:copy" width="12"></iconify-icon>
                                </button>
                                <button class="btn btn-ghost btn-sm" data-qr="${v.code}" title="Show QR code" style="padding:2px 6px">
                                    <iconify-icon icon="tabler:qrcode" width="12"></iconify-icon>
                                </button>
                            </td>
                            <td style="color:var(--text-muted)">${v.description || '—'}</td>
                            <td>
                                <span style="font-family:var(--font-mono)">${v.used_count}/${v.max_uses === 0 ? '∞' : v.max_uses}</span>
                                <div style="background:var(--border);border-radius:2px;height:4px;width:60px;margin-top:3px">
                                    <div style="background:var(--accent-rx);width:${v.max_uses > 0 ? Math.min(100, v.used_count/v.max_uses*100) : 0}%;height:100%;border-radius:2px"></div>
                                </div>
                            </td>
                            <td>${v.session_hours}h</td>
                            <td style="font-size:12px;color:var(--text-muted)">${v.expires_at ? new Date(v.expires_at).toLocaleDateString() : 'Never'}</td>
                            <td>${v.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Used/Disabled</span>'}</td>
                            <td>
                                ${v.is_active ? `<button class="btn btn-danger btn-sm" data-del="${v.id}" title="Deactivate">
                                    <iconify-icon icon="tabler:ban" width="12"></iconify-icon>
                                </button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                    </tbody>
                </table>
            `;

            el.querySelectorAll('[data-copy]').forEach(btn => {
                btn.addEventListener('click', () => { _copyToClipboard(btn.dataset.copy); success('Copied!'); });
            });

            el.querySelectorAll('[data-qr]').forEach(btn => {
                btn.addEventListener('click', () => {
                    Modal(`
                        <div style="text-align:center">
                            <p style="margin-bottom:12px">Voucher code: <strong>${btn.dataset.qr}</strong></p>
                            <img src="${_qrUrl(btn.dataset.qr)}" alt="QR Code" style="border-radius:8px;max-width:200px">
                            <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">Scan to autofill code on portal</p>
                        </div>
                    `, { title: 'Voucher QR Code', confirmLabel: 'Close', onConfirm: async () => {} });
                });
            });

            el.querySelectorAll('[data-del]').forEach(btn => {
                btn.addEventListener('click', () => {
                    Modal('<p>Deactivate this voucher? It can no longer be used.</p>', {
                        title: 'Deactivate Voucher',
                        confirmLabel: 'Deactivate',
                        confirmClass: 'btn-danger',
                        onConfirm: async () => {
                            await api.delete(`/vouchers/${btn.dataset.del}`);
                            success('Voucher deactivated');
                            load();
                        },
                    });
                });
            });
        } catch (err) {
            el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    function openCreateModal() {
        const modal = Modal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                    <label>Number to Generate</label>
                    <input type="number" id="v-count" class="input" value="1" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>Code Prefix</label>
                    <input type="text" id="v-prefix" class="input" value="WIFI" maxlength="8">
                </div>
            </div>
            <div class="form-group">
                <label>Description (optional)</label>
                <input type="text" id="v-desc" class="input" placeholder="e.g. Conference Room B guests">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                    <label>Session Duration (hours)</label>
                    <input type="number" id="v-hours" class="input" value="4" min="1" max="720">
                </div>
                <div class="form-group">
                    <label>Max Uses per Code</label>
                    <input type="number" id="v-uses" class="input" value="1" min="0" placeholder="0 = unlimited">
                </div>
            </div>
            <div class="form-group">
                <label>Expiry Date (optional)</label>
                <input type="datetime-local" id="v-expires" class="input">
            </div>
        `, {
            title: 'Generate Vouchers',
            confirmLabel: 'Generate',
            onConfirm: async () => {
                const body = {
                    count: parseInt(document.getElementById('v-count').value) || 1,
                    prefix: document.getElementById('v-prefix').value.trim() || 'WIFI',
                    description: document.getElementById('v-desc').value.trim() || null,
                    session_hours: parseInt(document.getElementById('v-hours').value) || 4,
                    max_uses: parseInt(document.getElementById('v-uses').value) || 1,
                    expires_at: document.getElementById('v-expires').value || null,
                };
                const result = await api.post('/vouchers', body);
                modal.remove();
                success(`Generated ${result.length} voucher(s)`);
                if (result.length === 1) {
                    _copyToClipboard(result[0].code);
                    success(`Code ${result[0].code} copied to clipboard`);
                }
                load();
            },
        });
    }

    container.querySelector('#create-vouchers-btn').addEventListener('click', openCreateModal);
    container.querySelector('#refresh-btn').addEventListener('click', load);
    load();

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
