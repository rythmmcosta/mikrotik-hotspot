const AUTH_KEY = 'hotspot_auth';

const AVATAR_STYLES = ['avataaars', 'bottts', 'fun-emoji', 'identicon', 'lorelei', 'micah', 'pixel-art', 'initials'];

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

    getDisplayName() {
        const user = this.getUser();
        return user?.full_name || user?.username || 'User';
    },

    getAvatar() {
        const user = this.getUser();
        if (user?.avatar_url) return user.avatar_url;
        const seed = encodeURIComponent(user?.username || 'user');
        return `https://api.dicebear.com/9.x/identicon/svg?seed=${seed}`;
    },

    updateUser(updatedUser) {
        const auth = this.get();
        if (auth) {
            auth.user = { ...auth.user, ...updatedUser };
            this.set(auth);
        }
    },

    getAvatarStyles: () => AVATAR_STYLES,
};
