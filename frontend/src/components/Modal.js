/**
 * Modal(content, options) — new API
 * Modal({title, content, onConfirm, ...}) — legacy API
 */
export function Modal(contentOrOpts, opts = {}) {
    let title, content, onConfirm, confirmLabel, confirmClass, cancelLabel;

    if (typeof contentOrOpts === 'string') {
        // New API: Modal(content, { title, onConfirm, ... })
        content = contentOrOpts;
        title = opts.title || '';
        onConfirm = opts.onConfirm;
        confirmLabel = opts.confirmLabel || 'Confirm';
        confirmClass = opts.confirmClass || 'btn-primary';
        cancelLabel = opts.cancelLabel || 'Cancel';
    } else {
        // Legacy API: Modal({ title, content, onConfirm, ... })
        title = contentOrOpts.title || '';
        content = contentOrOpts.content || '';
        onConfirm = contentOrOpts.onConfirm;
        confirmLabel = contentOrOpts.confirmLabel || 'Confirm';
        confirmClass = contentOrOpts.confirmClass || 'btn-primary';
        cancelLabel = contentOrOpts.cancelLabel || 'Cancel';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const showFooter = onConfirm || cancelLabel !== 'Cancel';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                <button class="btn btn-ghost modal-cancel">${cancelLabel}</button>
                ${onConfirm ? `<button class="btn ${confirmClass} modal-confirm">${confirmLabel}</button>` : ''}
            </div>
        </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-cancel').addEventListener('click', close);
    const confirmBtn = overlay.querySelector('.modal-confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            try { await onConfirm(); } catch {}
        });
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.body.appendChild(overlay);
    return overlay;
}

// showModal(title, content, buttons) — flexible multi-button API
let _currentModal = null;

export function showModal(title, content, buttons = []) {
    if (_currentModal) _currentModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const footerBtns = buttons.map((b, i) => `<button class="btn ${b.class || 'btn-ghost'} modal-action-btn" data-idx="${i}">${b.label}</button>`).join('');

    overlay.innerHTML = `
        <div class="modal modal-dialog">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">✕</button>
            </div>
            <div class="modal-body">${content}</div>
            ${footerBtns ? `<div class="modal-footer">${footerBtns}</div>` : ''}
        </div>
    `;

    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    overlay.querySelectorAll('.modal-action-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.idx);
        btn.addEventListener('click', () => buttons[idx]?.action?.());
    });

    document.body.appendChild(overlay);
    _currentModal = overlay;
    return overlay;
}

export function closeModal() {
    if (_currentModal) { _currentModal.remove(); _currentModal = null; }
}
