/**
 * Renders a sortable data table.
 * @param {Array} columns - [{key, label, render?}]
 * @param {Array} rows - data rows
 * @param {Object} options - {actions: [{label, onClick, className}]}
 */
export function DataTable(columns, rows, options = {}) {
    const table = document.createElement('table');
    table.className = 'data-table';

    // Header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        headerRow.appendChild(th);
    });
    if (options.actions?.length) {
        const th = document.createElement('th');
        th.textContent = 'Actions';
        headerRow.appendChild(th);
    }

    // Body
    const tbody = table.createTBody();
    if (!rows.length) {
        const tr = tbody.insertRow();
        const td = tr.insertCell();
        td.colSpan = columns.length + (options.actions?.length ? 1 : 0);
        td.className = 'empty-row';
        td.textContent = 'No records found';
    }

    rows.forEach(row => {
        const tr = tbody.insertRow();
        columns.forEach(col => {
            const td = tr.insertCell();
            td.innerHTML = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—');
        });
        if (options.actions?.length) {
            const td = tr.insertCell();
            td.className = 'action-cell';
            options.actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'btn-action ' + (action.className || '');
                btn.textContent = action.label;
                btn.addEventListener('click', () => action.onClick(row));
                td.appendChild(btn);
            });
        }
    });

    return table;
}

export function StatusBadge(status) {
    const colors = {
        active: 'green', approved: 'green', online: 'green',
        suspended: 'yellow', pending_approval: 'yellow', pending_otp: 'blue',
        deleted: 'red', rejected: 'red', expired: 'gray',
        disabled: 'red',
    };
    const color = colors[status] || 'gray';
    return `<span class="badge badge-${color}">${status.replace(/_/g,' ')}</span>`;
}
