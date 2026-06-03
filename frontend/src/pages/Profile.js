import { renderSidebar } from '../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../components/Topbar.js';
import { success, error } from '../components/Toast.js';
import { api } from '../api/client.js';
import { authStore } from '../store/auth.js';

const AVATAR_STYLES = [
    { id: 'avataaars',  label: 'Avataaars' },
    { id: 'bottts',     label: 'Bottts' },
    { id: 'fun-emoji',  label: 'Fun Emoji' },
    { id: 'identicon',  label: 'Identicon' },
    { id: 'lorelei',    label: 'Lorelei' },
    { id: 'micah',      label: 'Micah' },
    { id: 'pixel-art',  label: 'Pixel Art' },
    { id: 'initials',   label: 'Initials' },
];

function _dicebearUrl(style, seed) {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export async function renderProfile(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header"><h2>My Profile</h2></div>
                    <div id="profile-body">
                        <div class="skeleton" style="height:200px;border-radius:10px;margin-bottom:16px"></div>
                    </div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    // Load latest profile from API to ensure fresh data
    let user;
    try {
        user = await api.get('/auth/me');
        authStore.updateUser(user);
    } catch {
        user = authStore.getUser() || {};
    }

    const seed = user.username || 'user';
    let selectedStyle = _detectStyle(user.avatar_url, seed) || 'identicon';
    let currentAvatarUrl = user.avatar_url || _dicebearUrl('identicon', seed);

    const body = container.querySelector('#profile-body');
    body.innerHTML = `
        <div class="profile-grid">
            <!-- Avatar card -->
            <div class="card">
                <div class="card-header">
                    <span><iconify-icon icon="tabler:user-circle" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Avatar</span>
                </div>
                <div class="card-body" style="display:flex;flex-direction:column;align-items:center;gap:14px">
                    <img id="avatar-preview" src="${currentAvatarUrl}" alt="avatar"
                         style="width:90px;height:90px;border-radius:50%;border:3px solid var(--accent-rx);background:var(--bg-input)"
                         onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=${seed}'">
                    <div style="text-align:center">
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">Choose a style:</div>
                        <div class="avatar-picker" id="avatar-picker" style="justify-content:center">
                            ${AVATAR_STYLES.map(s => `
                                <div class="avatar-option ${s.id === selectedStyle ? 'selected' : ''}"
                                     data-style="${s.id}" title="${s.label}">
                                    <img src="${_dicebearUrl(s.id, seed)}" alt="${s.label}" style="width:100%;height:100%"
                                         loading="lazy" onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=${seed}'">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <button class="btn btn-primary" id="save-avatar-btn" style="width:100%">
                        <iconify-icon icon="tabler:check" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                        Save Avatar
                    </button>
                </div>
            </div>

            <!-- Personal info card -->
            <div class="card">
                <div class="card-header">
                    <span><iconify-icon icon="tabler:id" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Personal Info</span>
                </div>
                <div class="card-body">
                    <form id="profile-form">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="full_name" value="${user.full_name || ''}" placeholder="Your full name">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value="${user.email || ''}" placeholder="admin@company.com">
                        </div>
                        <div class="form-group">
                            <label>Mobile</label>
                            <input type="text" name="mobile" value="${user.mobile || ''}" placeholder="+1234567890">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <iconify-icon icon="tabler:device-floppy" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                                Save Info
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Telegram card -->
            <div class="card">
                <div class="card-header">
                    <span><iconify-icon icon="tabler:brand-telegram" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Telegram Notifications</span>
                </div>
                <div class="card-body">
                    <div class="alert alert-info" style="margin-bottom:14px;font-size:0.78rem">
                        Get personal alerts via Telegram. Start a chat with your bot and paste your Chat ID here.
                        You can find your Chat ID by messaging <strong>@userinfobot</strong> on Telegram.
                    </div>
                    <form id="telegram-form">
                        <div class="form-group">
                            <label>Your Telegram Chat ID</label>
                            <input type="text" name="telegram_chat_id"
                                   value="${user.telegram_chat_id || ''}" placeholder="e.g. 123456789">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <iconify-icon icon="tabler:device-floppy" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                                Save
                            </button>
                            <button type="button" id="test-telegram-btn" class="btn btn-ghost">
                                <iconify-icon icon="tabler:send" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                                Test Notification
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Security card -->
            <div class="card">
                <div class="card-header">
                    <span><iconify-icon icon="tabler:lock" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Change Password</span>
                </div>
                <div class="card-body">
                    <form id="password-form">
                        <div class="form-group">
                            <label>Current Password</label>
                            <input type="password" name="current_password" placeholder="••••••••" required>
                        </div>
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" name="new_password" placeholder="Min 8 characters" required>
                        </div>
                        <div class="form-group">
                            <label>Confirm New Password</label>
                            <input type="password" name="confirm_password" placeholder="Repeat new password" required>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <iconify-icon icon="tabler:key" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                                Change Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Two-Factor Auth card -->
            <div class="card" id="totp-card">
                <div class="card-header">
                    <span><iconify-icon icon="tabler:shield-lock" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Two-Factor Authentication</span>
                </div>
                <div class="card-body" id="totp-body"></div>
            </div>
        </div>

        <!-- Session info card -->
        <div class="card" style="margin-top:16px">
            <div class="card-header">
                <span><iconify-icon icon="tabler:info-circle" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Account Info</span>
            </div>
            <div class="card-body">
                <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:0.8rem">
                    <div><span style="color:var(--text-muted)">Username: </span><span class="mono">${user.username}</span></div>
                    <div><span style="color:var(--text-muted)">Role: </span><span style="color:var(--accent-rx);font-weight:600;text-transform:uppercase">${user.role}</span></div>
                    <div><span style="color:var(--text-muted)">Last Login: </span><span class="mono">${user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'N/A'}</span></div>
                    <div><span style="color:var(--text-muted)">Account Since: </span><span class="mono">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span></div>
                </div>
            </div>
        </div>
    `;

    // Avatar picker
    const preview = body.querySelector('#avatar-preview');
    body.querySelector('#avatar-picker').addEventListener('click', (e) => {
        const opt = e.target.closest('.avatar-option');
        if (!opt) return;
        body.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedStyle = opt.dataset.style;
        currentAvatarUrl = _dicebearUrl(selectedStyle, seed);
        preview.src = currentAvatarUrl;
    });

    body.querySelector('#save-avatar-btn').addEventListener('click', async () => {
        try {
            const updated = await api.put('/auth/me', { avatar_url: currentAvatarUrl });
            authStore.updateUser(updated);
            success('Avatar saved');
        } catch (err) { error(err.message); }
    });

    // Personal info form
    body.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const updated = await api.put('/auth/me', {
                full_name: fd.get('full_name') || null,
                email: fd.get('email') || null,
                mobile: fd.get('mobile') || null,
            });
            authStore.updateUser(updated);
            success('Profile updated');
        } catch (err) { error(err.message); }
    });

    // Telegram form
    body.querySelector('#telegram-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const updated = await api.put('/auth/me', { telegram_chat_id: fd.get('telegram_chat_id') || null });
            authStore.updateUser(updated);
            success('Telegram Chat ID saved');
        } catch (err) { error(err.message); }
    });

    body.querySelector('#test-telegram-btn').addEventListener('click', async () => {
        try {
            const res = await api.post('/settings/telegram/test-me', {});
            res.success ? success(res.message) : error(res.message);
        } catch (err) { error(err.message); }
    });

    // Password form
    body.querySelector('#password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const np = fd.get('new_password');
        const cp = fd.get('confirm_password');
        if (np !== cp) { error('New passwords do not match'); return; }
        if (np.length < 8) { error('Password must be at least 8 characters'); return; }
        try {
            await api.put('/auth/password', {
                current_password: fd.get('current_password'),
                new_password: np,
            });
            success('Password changed successfully');
            e.target.reset();
        } catch (err) { error(err.message); }
    });

    // TOTP card
    _initTotpCard(body, !!user.totp_enabled);

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}

function _initTotpCard(body, enabled) {
    const cardBody = body.querySelector('#totp-body');
    if (!cardBody) return;

    if (enabled) {
        cardBody.innerHTML = `
            <div class="alert alert-success" style="margin-bottom:14px;font-size:0.82rem">
                <iconify-icon icon="tabler:shield-check" width="16" style="vertical-align:middle;margin-right:6px"></iconify-icon>
                <strong>Active</strong> — Your account is protected with two-factor authentication.
            </div>
            <form id="totp-disable-form">
                <div class="form-group">
                    <label>Current Password (required to disable 2FA)</label>
                    <input type="password" name="current_password" placeholder="••••••••" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" style="background:var(--accent-err,#e55)">
                        <iconify-icon icon="tabler:shield-off" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                        Disable 2FA
                    </button>
                </div>
            </form>
        `;
        cardBody.querySelector('#totp-disable-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = new FormData(e.target).get('current_password');
            try {
                await fetch('/api/v1/auth/totp', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authStore.getAccessToken()}`
                    },
                    body: JSON.stringify({ current_password: pw }),
                }).then(async r => { if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); } });
                authStore.updateUser({ totp_enabled: false });
                success('Two-factor authentication disabled');
                _initTotpCard(body, false);
            } catch (err) { error(err.message); }
        });
    } else {
        cardBody.innerHTML = `
            <div class="alert alert-info" style="margin-bottom:14px;font-size:0.78rem">
                <iconify-icon icon="tabler:info-circle" width="16" style="vertical-align:middle;margin-right:6px"></iconify-icon>
                Add an extra layer of security. Scan the QR code with Google Authenticator or any TOTP app.
            </div>
            <div id="totp-setup-area"></div>
            <div class="form-actions">
                <button class="btn btn-primary" id="totp-setup-btn">
                    <iconify-icon icon="tabler:shield-plus" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                    Set Up 2FA
                </button>
            </div>
        `;
        cardBody.querySelector('#totp-setup-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = '<iconify-icon icon="tabler:loader" width="14" style="vertical-align:middle;margin-right:4px;animation:spin .8s linear infinite"></iconify-icon> Loading…';
            try {
                const data = await api.post('/auth/totp/setup', {});
                _showTotpSetupForm(body, cardBody, data);
            } catch (err) {
                error(err.message);
                btn.disabled = false;
                btn.innerHTML = '<iconify-icon icon="tabler:shield-plus" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon> Set Up 2FA';
            }
        });
    }
}

function _showTotpSetupForm(body, cardBody, { secret, qr_data_url }) {
    cardBody.innerHTML = `
        <div style="text-align:center;margin-bottom:16px">
            <img src="${qr_data_url}" alt="QR Code"
                 style="width:180px;height:180px;border:2px solid var(--border,#333);border-radius:8px;padding:4px;background:#fff">
            <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted)">Scan with your authenticator app</div>
            <div style="margin-top:6px;font-family:monospace;font-size:0.78rem;background:var(--bg-input,#1a1a2e);padding:8px 12px;border-radius:6px;word-break:break-all;color:var(--text-main)">${secret}</div>
        </div>
        <form id="totp-confirm-form">
            <div class="form-group">
                <label>Enter verification code from app</label>
                <input type="text" name="code" inputmode="numeric" maxlength="6"
                       placeholder="000000" autocomplete="one-time-code"
                       style="text-align:center;font-size:1.2rem;letter-spacing:0.25em;font-family:monospace" required>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                    <iconify-icon icon="tabler:check" width="14" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                    Activate 2FA
                </button>
                <button type="button" class="btn btn-ghost" id="totp-cancel-btn">Cancel</button>
            </div>
        </form>
    `;
    setTimeout(() => cardBody.querySelector('[name=code]')?.focus(), 50);
    cardBody.querySelector('#totp-cancel-btn').addEventListener('click', () => _initTotpCard(body, false));
    cardBody.querySelector('#totp-confirm-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = new FormData(e.target).get('code');
        try {
            const result = await api.post('/auth/totp/confirm', { code });
            authStore.updateUser({ totp_enabled: true });
            success('Two-factor authentication enabled!');
            _showTotpBackupCodes(body, cardBody, result.backup_codes || []);
        } catch (err) { error(err.message); }
    });
}

function _showTotpBackupCodes(body, cardBody, backupCodes) {
    cardBody.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:14px;font-size:0.82rem">
            <iconify-icon icon="tabler:shield-check" width="16" style="vertical-align:middle;margin-right:6px"></iconify-icon>
            <strong>2FA is now active!</strong> Save these backup codes in a safe place.
        </div>
        <div style="background:var(--bg-input,#1a1a2e);border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;letter-spacing:.05em">BACKUP CODES — each can be used once if you lose your device</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px">
                ${backupCodes.map(c => `<code style="font-family:monospace;font-size:0.82rem;color:var(--text-main)">${c}</code>`).join('')}
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-primary" id="totp-done-btn">Done</button>
        </div>
    `;
    cardBody.querySelector('#totp-done-btn').addEventListener('click', () => _initTotpCard(body, true));
}

function _detectStyle(avatarUrl, seed) {
    if (!avatarUrl) return null;
    const match = avatarUrl.match(/dicebear\.com\/[^/]+\/([^/]+)\//);
    return match ? match[1] : null;
}
