let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

export function toast(message, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">✕</button>`;
    getContainer().appendChild(el);
    setTimeout(() => el.remove(), duration);
}

export const success = (msg) => toast(msg, 'success');
export const error   = (msg) => toast(msg, 'error');
export const info    = (msg) => toast(msg, 'info');
export const warn    = (msg) => toast(msg, 'warning');
