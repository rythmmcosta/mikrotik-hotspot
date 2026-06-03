import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar } from '../../components/Topbar.js';
import { api } from '../../api/client.js';
import { showModal, closeModal } from '../../components/Modal.js';
import { success, error } from '../../components/Toast.js';
import { pageEnter, rowsIn } from '../../core/anim.js';

let _departments = [];
let _profiles    = [];

export async function renderDepartments(container) {
    container.innerHTML = '';
    renderSidebar(container);
    const main = document.createElement('div');
    main.className = 'main-content';
    main.innerHTML = `
        <div class="page-header">
            <h1>Departments</h1>
            <button class="btn btn-primary" id="add-dept">
                <iconify-icon icon="tabler:plus"></iconify-icon> Add Department
            </button>
        </div>
        <div id="dept-body"><div class="loading-spinner" style="margin:60px auto"></div></div>
    `;
    container.appendChild(main);
    renderTopbar(main);

    main.querySelector('#add-dept').addEventListener('click', () => _openModal(null, main));

    const [depts, profs] = await Promise.all([
        api.get('/departments').catch(() => []),
        api.get('/bandwidth').catch(() => []),
    ]);
    _departments = depts;
    _profiles    = profs;
    _render(main);
    pageEnter(main);
}

function _render(main) {
    const body = main.querySelector('#dept-body');
    if (!_departments.length) {
        body.innerHTML = `<div class="empty-state"><iconify-icon icon="tabler:building" width="48"></iconify-icon><p>No departments yet</p></div>`;
        return;
    }
    body.innerHTML = `
        <div class="table-card">
            <table class="data-table">
                <thead><tr><th>#</th><th>Name</th><th>Bandwidth Profile</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody id="dept-tbody">
                    ${_departments.map(d => {
                        const prof = _profiles.find(p => p.id === d.bandwidth_profile_id);
                        return `<tr>
                            <td>${d.id}</td>
                            <td style="font-weight:600">${d.name}</td>
                            <td>${prof ? `<span class="badge-chip">${prof.name}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                            <td style="font-size:0.78rem;color:var(--text-muted)">${_fmt(d.created_at)}</td>
                            <td>
                                <div style="display:flex;gap:6px">
                                    <button class="btn btn-sm btn-ghost dept-edit" data-id="${d.id}" title="Edit">
                                        <iconify-icon icon="tabler:edit" width="14"></iconify-icon>
                                    </button>
                                    <button class="btn btn-sm btn-ghost dept-del" data-id="${d.id}" title="Delete">
                                        <iconify-icon icon="tabler:trash" width="14"></iconify-icon>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    rowsIn(body.querySelector('#dept-tbody'));

    body.querySelectorAll('.dept-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const dept = _departments.find(d => String(d.id) === btn.dataset.id);
            _openModal(dept, main);
        });
    });

    body.querySelectorAll('.dept-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this department?')) return;
            try {
                await api.delete(`/departments/${btn.dataset.id}`);
                _departments = _departments.filter(d => String(d.id) !== btn.dataset.id);
                _render(main);
                success('Department deleted');
            } catch { error('Failed to delete'); }
        });
    });
}

function _openModal(dept, main) {
    const isEdit = !!dept;
    const profOptions = _profiles.map(p =>
        `<option value="${p.id}" ${dept?.bandwidth_profile_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    showModal(isEdit ? 'Edit Department' : 'Add Department', `
        <div style="display:flex;flex-direction:column;gap:14px">
            <div>
                <label class="form-label">Name</label>
                <input id="dept-name" class="form-input" value="${dept?.name || ''}" placeholder="e.g. IT Department">
            </div>
            <div>
                <label class="form-label">Bandwidth Profile (optional)</label>
                <select id="dept-prof" class="form-input">
                    <option value="">— None —</option>
                    ${profOptions}
                </select>
            </div>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
            const name = document.getElementById('dept-name')?.value?.trim();
            const bwId = document.getElementById('dept-prof')?.value;
            if (!name) { error('Name is required'); return; }
            const payload = { name, bandwidth_profile_id: bwId ? parseInt(bwId) : null };
            try {
                if (isEdit) {
                    const updated = await api.put(`/departments/${dept.id}`, payload);
                    const idx = _departments.findIndex(d => d.id === dept.id);
                    if (idx >= 0) _departments[idx] = updated;
                } else {
                    const created = await api.post('/departments', payload);
                    _departments.push(created);
                }
                closeModal();
                _render(main);
                success(isEdit ? 'Department updated' : 'Department created');
            } catch { error('Failed to save department'); }
        }},
    ]);
}

function _fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}
