import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

function _fmt(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

export async function renderBandwidth(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Bandwidth Management</h2>
                        <button class="btn btn-primary" id="add-profile-btn">
                            <iconify-icon icon="tabler:plus" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>New Profile
                        </button>
                    </div>

                    <div class="grid" style="grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Bandwidth Profiles</h3></div>
                            <div id="profiles-content">Loading...</div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Top Users Today</h3>
                                <select id="usage-days" class="input input-sm" style="width:auto">
                                    <option value="1">Today</option>
                                    <option value="7">7 days</option>
                                    <option value="30">30 days</option>
                                </select>
                            </div>
                            <div id="usage-content">Loading...</div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function loadProfiles() {
        const el = container.querySelector('#profiles-content');
        try {
            const profiles = await api.get('/bandwidth-profiles');
            if (!profiles.length) {
                el.innerHTML = '<div class="empty-state"><p>No profiles yet</p></div>';
                return;
            }
            el.innerHTML = `
                <table class="table">
                    <thead><tr><th>Name</th><th>RX / TX</th><th>Default</th><th>Router</th><th></th></tr></thead>
                    <tbody>
                    ${profiles.map(p => `
                        <tr>
                            <td><strong>${p.name}</strong>${p.description ? `<br><small class="text-muted">${p.description}</small>` : ''}</td>
                            <td><code>${p.rate_limit_rx} / ${p.rate_limit_tx}</code></td>
                            <td>
                                ${p.is_default_employee ? '<span class="badge badge-primary">Employee</span>' : ''}
                                ${p.is_default_guest ? '<span class="badge badge-success">Guest</span>' : ''}
                            </td>
                            <td>${p.mikrotik_profile_name ? `<span class="badge badge-success">Synced</span>` : `<span class="badge badge-warning">Not Synced</span>`}</td>
                            <td style="white-space:nowrap">
                                <button class="btn btn-ghost btn-sm" data-sync="${p.id}">
                                    <iconify-icon icon="tabler:refresh" width="13"></iconify-icon>
                                </button>
                                <button class="btn btn-ghost btn-sm" data-edit="${p.id}" data-name="${p.name}" data-rx="${p.rate_limit_rx}" data-tx="${p.rate_limit_tx}" data-desc="${p.description || ''}" data-emp="${p.is_default_employee}" data-guest="${p.is_default_guest}">
                                    <iconify-icon icon="tabler:edit" width="13"></iconify-icon>
                                </button>
                                <button class="btn btn-danger btn-sm" data-del="${p.id}">
                                    <iconify-icon icon="tabler:trash" width="13"></iconify-icon>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                    </tbody>
                </table>
            `;

            el.querySelectorAll('[data-sync]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await api.post(`/bandwidth-profiles/${btn.dataset.sync}/sync`, {});
                        success('Synced to router');
                        loadProfiles();
                    } catch (err) { error(err.message); }
                });
            });

            el.querySelectorAll('[data-edit]').forEach(btn => {
                btn.addEventListener('click', () => openProfileModal(btn.dataset));
            });

            el.querySelectorAll('[data-del]').forEach(btn => {
                btn.addEventListener('click', () => {
                    Modal('<p>Deactivate this bandwidth profile?</p>', {
                        title: 'Delete Profile',
                        confirmLabel: 'Delete',
                        confirmClass: 'btn-danger',
                        onConfirm: async () => {
                            await api.delete(`/bandwidth-profiles/${btn.dataset.del}`);
                            success('Profile removed');
                            loadProfiles();
                        },
                    });
                });
            });
        } catch (err) {
            el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    async function loadUsage() {
        const el = container.querySelector('#usage-content');
        const days = container.querySelector('#usage-days').value;
        try {
            const data = await api.get(`/connections/bandwidth-usage?days=${days}&limit=10`);
            if (!data.length) {
                el.innerHTML = '<div class="empty-state"><p>No data yet</p></div>';
                return;
            }
            const max = Math.max(...data.map(d => d.bytes_in + d.bytes_out)) || 1;
            el.innerHTML = `
                <div style="padding:12px 0">
                ${data.map(d => {
                    const total = d.bytes_in + d.bytes_out;
                    const pct = Math.round(total / max * 100);
                    return `
                        <div style="margin-bottom:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                                <span style="font-size:13px;font-family:var(--font-mono)">${d.username}</span>
                                <span style="font-size:12px;color:var(--text-muted)">${_fmt(total)}</span>
                            </div>
                            <div style="background:var(--border);border-radius:4px;height:6px">
                                <div style="background:var(--accent-rx);width:${pct}%;height:100%;border-radius:4px;transition:width .3s"></div>
                            </div>
                            <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted);margin-top:2px">
                                <span>↓ ${_fmt(d.bytes_in)}</span>
                                <span>↑ ${_fmt(d.bytes_out)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
                </div>
            `;
        } catch (err) {
            el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    function openProfileModal(data = {}) {
        const isEdit = !!data.edit;
        const modal = Modal(`
            <div class="form-group">
                <label>Profile Name *</label>
                <input type="text" id="pname" class="input" value="${data.name || ''}" placeholder="e.g. Employee Premium">
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" id="pdesc" class="input" value="${data.desc || ''}" placeholder="Optional description">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                    <label>Download Rate (RX) *</label>
                    <input type="text" id="prx" class="input" value="${data.rx || '10M'}" placeholder="e.g. 10M">
                </div>
                <div class="form-group">
                    <label>Upload Rate (TX) *</label>
                    <input type="text" id="ptx" class="input" value="${data.tx || '10M'}" placeholder="e.g. 10M">
                </div>
            </div>
            <div style="display:flex;gap:16px;margin-top:8px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" id="pemp" ${data.emp === 'true' ? 'checked' : ''}>
                    Default for Employees
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" id="pguest" ${data.guest === 'true' ? 'checked' : ''}>
                    Default for Guests
                </label>
            </div>
        `, {
            title: isEdit ? 'Edit Profile' : 'New Bandwidth Profile',
            confirmLabel: isEdit ? 'Update' : 'Create',
            onConfirm: async () => {
                const body = {
                    name: document.getElementById('pname').value.trim(),
                    description: document.getElementById('pdesc').value.trim() || null,
                    rate_limit_rx: document.getElementById('prx').value.trim(),
                    rate_limit_tx: document.getElementById('ptx').value.trim(),
                    is_default_employee: document.getElementById('pemp').checked,
                    is_default_guest: document.getElementById('pguest').checked,
                };
                if (!body.name || !body.rate_limit_rx || !body.rate_limit_tx) {
                    error('Name and rates are required');
                    return;
                }
                if (isEdit) {
                    await api.put(`/bandwidth-profiles/${data.edit}`, body);
                    success('Profile updated');
                } else {
                    await api.post('/bandwidth-profiles', body);
                    success('Profile created');
                }
                modal.remove();
                loadProfiles();
            },
        });
    }

    container.querySelector('#add-profile-btn').addEventListener('click', () => openProfileModal());
    container.querySelector('#usage-days').addEventListener('change', loadUsage);

    loadProfiles();
    loadUsage();

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
