export function Modal({ title, content, onConfirm, confirmLabel = 'Confirm', confirmClass = 'btn-primary' }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                <button class="btn btn-ghost modal-cancel">Cancel</button>
                <button class="btn ${confirmClass} modal-confirm">${confirmLabel}</button>
            </div>
        </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', close);
    overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
        try { await onConfirm(); } catch {}
        close();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.body.appendChild(overlay);
    return overlay;
}
