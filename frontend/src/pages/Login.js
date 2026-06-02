import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';
import { navigate } from '../router.js';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-bg">
            <div class="login-card">
                <div class="login-header">
                    <div class="login-logo-row">
                        <iconify-icon icon="tabler:router" width="32" style="color:var(--accent-rx)"></iconify-icon>
                        <span class="login-app-name">HotspotMgr</span>
                    </div>
                    <p class="login-subtitle">MikroTik Hotspot Management System</p>
                </div>

                <form id="login-form" autocomplete="on">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="username" name="username"
                               placeholder="admin" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" name="password"
                               placeholder="••••••••" required autocomplete="current-password">
                    </div>

                    <div id="login-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>

                    <button type="submit" class="login-btn" id="login-btn">
                        <div class="login-spinner" id="login-spinner"></div>
                        <span id="login-btn-text">Sign In</span>
                    </button>
                </form>

                <p style="text-align:center;margin-top:20px;font-size:0.72rem;color:var(--text-muted)">
                    UI inspired by
                    <a href="https://github.com/SecOps-7/MikroDash" target="_blank"
                       style="color:var(--accent-rx);text-decoration:none">MikroDash</a>
                </p>
            </div>
        </div>
    `;

    container.querySelector('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn     = container.querySelector('#login-btn');
        const spinner = container.querySelector('#login-spinner');
        const btnText = container.querySelector('#login-btn-text');
        const errEl   = container.querySelector('#login-error');

        btn.disabled = true;
        spinner.style.display = 'block';
        btnText.textContent = 'Signing in…';
        errEl.style.display = 'none';

        try {
            const tokens = await api.post('/auth/login', {
                username: container.querySelector('#username').value.trim(),
                password: container.querySelector('#password').value,
            });
            const user = await fetch('/api/v1/auth/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            }).then(r => r.json());

            authStore.set({ ...tokens, user });
            navigate('/dashboard');
        } catch (err) {
            errEl.textContent = err.message || 'Invalid username or password';
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Sign In';
        }
    });
}
