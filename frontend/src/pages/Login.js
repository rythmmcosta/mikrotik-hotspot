import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';
import { navigate } from '../router.js';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-wrapper">
            <div class="login-card">
                <div class="login-header">
                    <div class="login-logo" style="color:var(--primary,#4e73df)">◈</div>
                    <h1>Hotspot Manager</h1>
                    <p>Sign in to your account</p>
                </div>
                <form id="login-form" autocomplete="on">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="username" name="username" placeholder="admin" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password">
                    </div>
                    <div id="login-error" class="alert alert-error" style="display:none"></div>
                    <button type="submit" class="btn btn-primary btn-full" id="login-btn">Sign In</button>
                </form>
            </div>
        </div>
    `;

    container.querySelector('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#login-btn');
        const errEl = container.querySelector('#login-error');
        btn.disabled = true;
        btn.textContent = 'Signing in...';
        errEl.style.display = 'none';

        try {
            const tokens = await api.post('/auth/login', {
                username: container.querySelector('#username').value,
                password: container.querySelector('#password').value,
            });
            const user = await fetch('/api/v1/auth/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            }).then(r => r.json());

            authStore.set({ ...tokens, user });
            navigate('/dashboard');
        } catch (err) {
            errEl.textContent = err.message || 'Login failed';
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });
}
