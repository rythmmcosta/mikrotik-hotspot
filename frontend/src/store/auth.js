const AUTH_KEY = 'hotspot_auth';

export const authStore = {
    get() {
        try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
        catch { return null; }
    },
    set(data) { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); },
    clear() { localStorage.removeItem(AUTH_KEY); },
    getAccessToken() { return this.get()?.access_token || null; },
    getRefreshToken() { return this.get()?.refresh_token || null; },
    getUser() { return this.get()?.user || null; },
    isAdmin() { return this.getUser()?.role === 'admin'; },
    isLoggedIn() { return !!this.getAccessToken(); },
};
