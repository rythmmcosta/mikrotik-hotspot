import { authStore } from '../store/auth.js';

const BASE = '/api/v1';

async function request(method, path, body = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = authStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    let res = await fetch(BASE + path, opts);

    if (res.status === 401 && retry) {
        const refreshed = await tryRefresh();
        if (refreshed) return request(method, path, body, false);
        authStore.clear();
        window.location.hash = '#/login';
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw Object.assign(new Error(err.detail || 'Request failed'), { status: res.status, body: err });
    }

    if (res.status === 204) return null;
    return res.json();
}

async function tryRefresh() {
    const rt = authStore.getRefreshToken();
    if (!rt) return false;
    try {
        const res = await fetch(BASE + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        const existing = authStore.get();
        authStore.set({ ...existing, ...data });
        return true;
    } catch { return false; }
}

export const api = {
    get:    (path)         => request('GET', path),
    post:   (path, body)   => request('POST', path, body),
    put:    (path, body)   => request('PUT', path, body),
    delete: (path)         => request('DELETE', path),
    patch:  (path, body)   => request('PATCH', path, body),
};
