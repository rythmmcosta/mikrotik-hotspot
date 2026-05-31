import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { Modal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

export async function renderPolicies(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header">
                        <h2>Usage Policies</h2>
                        <button class="btn btn-primary" id="add-policy-btn">+ New Policy</button>
                    </div>
                    <div id="policies-list">Loading...</div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    async function loadPolicies() {
        try {
            const policies = await api.get('/policies');
            renderPolicies_inner(policies);
        } catch (e) {
            document.getElementById('policies-list').innerHTML =
                `<div class="alert alert-error">${e.message}</div>`;
        }
    }

    function renderPolicies_inner(policies) {
        const list = document.getElementById('policies-list');
        if (!policies.length) {
            list.innerHTML = '<div class="card" style="padding:32px;text-align:center;opacity:.5">No policies yet</div>';
            return;
        }
        list.innerHTML = policies.map(p => `
            <div class="card" style="margin-bottom:14px" id="policy-${p.id}">
                <div class="card-header">
                    <div style="display:flex;align-items:center;gap:10px">
                        <span>${p.name}</span>
                        <span class="badge ${p.is_active ? 'badge-green' : 'badge-gray'}">${p.is_active ? 'active' : 'disabled'}</span>
                        <span class="badge badge-blue">${p.scope}</span>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-primary btn-sm sync-btn" data-id="${p.id}">Sync to Router</button>
                        <button class="btn btn-ghost btn-sm rule-btn" data-id="${p.id}">+ Rule</button>
                        <button class="btn btn-danger btn-sm del-policy-btn" data-id="${p.id}">Delete</button>
                    </div>
                </div>
                <div style="padding:12px">
                    ${p.description ? `<p style="font-size:13px;opacity:.6;margin-bottom:8px">${p.description}</p>` : ''}
                    <div id="rules-${p.id}">
                        ${_renderRules(p.rules)}
                    </div>
                </div>
            </div>
        `).join('');

        // Bind sync buttons
        list.querySelectorAll('.sync-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                try {
                    btn.disabled = true;
                    btn.textContent = 'Syncing...';
                    const result = await api.post(`/policies/${id}/sync`, {});
                    if (result.success) {
                        success(`Synced ${result.domains_synced} domains to ${result.address_list}`);
                    } else {
                        error(result.error || 'Sync failed');
                    }
                } catch (e) { error(e.message); }
                finally {
                    btn.disabled = false;
                    btn.textContent = 'Sync to Router';
                }
            });
        });

        // Bind add rule buttons
        list.querySelectorAll('.rule-btn').forEach(btn => {
            btn.addEventListener('click', () => showAddRuleModal(parseInt(btn.dataset.id)));
        });

        // Bind delete policy buttons
        list.querySelectorAll('.del-policy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const policyEl = document.getElementById(`policy-${id}`);
                const name = policyEl?.querySelector('.card-header span')?.textContent || '';
                if (!confirm(`Delete policy "${name}"?`)) return;
                try {
                    await api.delete(`/policies/${id}`);
                    success('Policy deleted');
                    loadPolicies();
                } catch (e) { error(e.message); }
            });
        });

        // Bind delete rule buttons
        list.querySelectorAll('.del-rule-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const policyId = parseInt(btn.dataset.policy);
                const ruleId = parseInt(btn.dataset.rule);
                try {
                    await api.delete(`/policies/${policyId}/rules/${ruleId}`);
                    success('Rule deleted');
                    loadPolicies();
                } catch (e) { error(e.message); }
            });
        });
    }

    function _renderRules(rules) {
        if (!rules?.length) return '<p style="font-size:12px;opacity:.5">No rules — add rules to define what to block/allow</p>';
        return `
            <table class="data-table" style="margin-top:4px">
                <thead><tr><th>Type</th><th>Value</th><th>Action</th><th></th></tr></thead>
                <tbody>
                    ${rules.map(r => `<tr>
                        <td>${r.rule_type}</td>
                        <td><code style="font-size:12px">${r.value}</code></td>
                        <td><span class="badge ${r.action === 'block' ? 'badge-red' : 'badge-green'}">${r.action}</span></td>
                        <td><button class="btn-action del-rule-btn" data-policy="${r.policy_id}" data-rule="${r.id}" style="background:rgba(231,74,59,.1);color:#e74a3b">✕</button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `;
    }

    function showAddPolicyModal() {
        const modal = Modal(`
            <div class="form-group"><label>Policy Name</label><input class="input" id="pol-name" placeholder="Social Media Block"></div>
            <div class="form-group"><label>Description</label><input class="input" id="pol-desc"></div>
            <div class="form-group"><label>Scope</label>
                <select class="input" id="pol-scope">
                    <option value="global">Global (all users)</option>
                    <option value="employee">Employees only</option>
                    <option value="guest">Guests only</option>
                    <option value="asset">Asset only</option>
                </select>
            </div>
            <div class="form-group"><label>Priority (1=high, 10=low)</label>
                <input class="input" id="pol-priority" type="number" min="1" max="10" value="5">
            </div>
        `, {
            title: 'New Policy',
            confirmLabel: 'Create',
            onConfirm: async () => {
                try {
                    await api.post('/policies', {
                        name: document.getElementById('pol-name').value.trim(),
                        description: document.getElementById('pol-desc').value.trim() || null,
                        scope: document.getElementById('pol-scope').value,
                        priority: parseInt(document.getElementById('pol-priority').value) || 5,
                    });
                    success('Policy created');
                    modal.remove();
                    loadPolicies();
                } catch (e) { error(e.message); }
            },
        });
    }

    function showAddRuleModal(policyId) {
        const modal = Modal(`
            <div class="form-group"><label>Rule Type</label>
                <select class="input" id="rule-type">
                    <option value="domain">Domain</option>
                    <option value="ip">IP Address</option>
                </select>
            </div>
            <div class="form-group"><label>Value</label>
                <input class="input" id="rule-value" placeholder="example.com or 192.168.1.0/24">
            </div>
            <div class="form-group"><label>Action</label>
                <select class="input" id="rule-action">
                    <option value="block">Block</option>
                    <option value="allow">Allow</option>
                </select>
            </div>
            <div class="form-group"><label>Description</label>
                <input class="input" id="rule-desc" placeholder="optional">
            </div>
        `, {
            title: 'Add Rule',
            confirmLabel: 'Add Rule',
            onConfirm: async () => {
                try {
                    await api.post(`/policies/${policyId}/rules`, {
                        rule_type: document.getElementById('rule-type').value,
                        value: document.getElementById('rule-value').value.trim(),
                        action: document.getElementById('rule-action').value,
                        description: document.getElementById('rule-desc').value.trim() || null,
                    });
                    success('Rule added');
                    modal.remove();
                    loadPolicies();
                } catch (e) { error(e.message); }
            },
        });
    }

    document.getElementById('add-policy-btn').addEventListener('click', showAddPolicyModal);
    await loadPolicies();

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
