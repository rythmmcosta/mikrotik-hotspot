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

            if (tokens.requires_totp) {
                btn.disabled = false;
                spinner.style.display = 'none';
                btnText.textContent = 'Sign In';
                _showTotpStep(container, tokens.totp_token);
                return;
            }

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

function _showTotpStep(container, totpToken) {
    const card = container.querySelector('.login-card');
    card.innerHTML = `
        <div class="login-header">
            <div class="login-logo-row">
                <iconify-icon icon="tabler:shield-check" width="32" style="color:var(--accent-rx)"></iconify-icon>
                <span class="login-app-name">2FA Verification</span>
            </div>
            <p class="login-subtitle">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div id="totp-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>

        <div class="form-group" style="margin-bottom:20px">
            <label>Authentication Code</label>
            <input type="text" id="totp-code" inputmode="numeric" pattern="[0-9]*"
                   maxlength="6" placeholder="000000" autocomplete="one-time-code"
                   style="text-align:center;font-size:1.4rem;letter-spacing:0.3em;font-family:monospace">
        </div>

        <button type="button" class="login-btn" id="totp-submit-btn">
            <div class="login-spinner" id="totp-spinner" style="display:none"></div>
            <span id="totp-btn-text">Verify</span>
        </button>

        <div style="text-align:center;margin-top:16px">
            <button type="button" id="totp-back-btn"
                    style="background:none;border:none;color:var(--text-muted);font-size:0.8rem;cursor:pointer;text-decoration:underline">
                ← Back to login
            </button>
        </div>

        <p style="text-align:center;margin-top:20px;font-size:0.72rem;color:var(--text-muted)">
            UI inspired by
            <a href="https://github.com/SecOps-7/MikroDash" target="_blank"
               style="color:var(--accent-rx);text-decoration:none">MikroDash</a>
        </p>
    `;

    setTimeout(() => card.querySelector('#totp-code')?.focus(), 50);

    card.querySelector('#totp-back-btn').addEventListener('click', () => renderLogin(container));

    const submitBtn = card.querySelector('#totp-submit-btn');
    const codeInput = card.querySelector('#totp-code');
    const errEl     = card.querySelector('#totp-error');

    async function doVerify() {
        const code = codeInput.value.trim();
        if (code.length !== 6) { errEl.textContent = 'Enter a 6-digit code'; errEl.style.display = 'block'; return; }

        submitBtn.disabled = true;
        card.querySelector('#totp-spinner').style.display = 'block';
        card.querySelector('#totp-btn-text').textContent = 'Verifying…';
        errEl.style.display = 'none';

        try {
            const tokens = await api.post('/auth/totp/verify', { totp_token: totpToken, code });
            const user = await fetch('/api/v1/auth/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            }).then(r => r.json());
            authStore.set({ ...tokens, user });
            navigate('/dashboard');
        } catch (err) {
            errEl.textContent = err.message || 'Invalid or expired code';
            errEl.style.display = 'block';
            codeInput.value = '';
            codeInput.focus();
        } finally {
            submitBtn.disabled = false;
            card.querySelector('#totp-spinner').style.display = 'none';
            card.querySelector('#totp-btn-text').textContent = 'Verify';
        }
    }

    submitBtn.addEventListener('click', doVerify);
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doVerify(); });
}
