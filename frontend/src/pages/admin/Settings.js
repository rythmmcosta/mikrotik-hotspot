import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

const CATEGORIES = [
    { key: 'mikrotik', label: 'MikroTik Router', icon: 'tabler:router' },
    { key: 'otp',      label: 'OTP Settings',    icon: 'tabler:key' },
    { key: 'smtp',     label: 'Email (SMTP)',     icon: 'tabler:mail' },
    { key: 'sms',      label: 'SMS (Twilio)',     icon: 'tabler:device-mobile' },
    { key: 'telegram', label: 'Telegram Bot',     icon: 'tabler:brand-telegram' },
    { key: 'system',   label: 'System',           icon: 'tabler:settings' },
];

export async function renderSettings(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header"><h2>System Settings</h2></div>
                    <div class="settings-tabs">
                        ${CATEGORIES.map((c, i) => `<button class="tab-btn ${i===0?'active':''}" data-cat="${c.key}"><iconify-icon icon="${c.icon}" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>${c.label}</button>`).join('')}
                    </div>
                    <div id="settings-content">Loading...</div>
                </main>
            </div>
        </div>
    `;

    renderSidebar(container.querySelector('#sidebar-mount'));
    renderTopbar(container.querySelector('#topbar-mount'));

    let activeCategory = 'mikrotik';

    async function loadCategory(cat) {
        const content = container.querySelector('#settings-content');
        content.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const data = await api.get(`/settings/${cat}`);
            const settings = data.settings || [];

            const form = document.createElement('form');
            form.className = 'settings-form';
            form.innerHTML = settings.map(s => `
                <div class="form-group">
                    <label>${s.key_name.replace(/_/g, ' ')}</label>
                    ${s.description ? `<small class="hint">${s.description}</small>` : ''}
                    <input type="${s.is_encrypted ? 'password' : s.key_name.includes('port') ? 'number' : 'text'}"
                           name="${s.key_name}"
                           value="${s.is_encrypted ? '' : (s.value || '')}"
                           placeholder="${s.is_encrypted ? '(encrypted — leave blank to keep)' : ''}"
                           class="input">
                </div>
            `).join('') + `
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save ${CATEGORIES.find(c=>c.key===cat)?.label}</button>
                    ${cat === 'mikrotik'  ? `<button type="button" id="test-mikrotik" class="btn btn-ghost"><iconify-icon icon="tabler:plug-connected" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Test Connection</button>` : ''}
                    ${cat === 'smtp'     ? `<button type="button" id="test-smtp" class="btn btn-ghost"><iconify-icon icon="tabler:send" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test Email</button>` : ''}
                    ${cat === 'sms'      ? `<button type="button" id="test-sms" class="btn btn-ghost"><iconify-icon icon="tabler:message" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test SMS</button>` : ''}
                    ${cat === 'telegram' ? `<button type="button" id="test-telegram" class="btn btn-ghost"><iconify-icon icon="tabler:brand-telegram" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test Message</button>` : ''}
                </div>
            `;

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const updates = {};
                settings.forEach(s => {
                    const input = form.querySelector(`[name="${s.key_name}"]`);
                    if (input && !(s.is_encrypted && !input.value)) {
                        updates[s.key_name] = input.value || null;
                    }
                });
                try {
                    await api.put(`/settings/${cat}`, { settings: updates });
                    success('Settings saved');
                } catch (err) {
                    error(err.message);
                }
            });

            form.querySelector('#test-mikrotik')?.addEventListener('click', async () => {
                try {
                    const res = await api.post('/settings/mikrotik/test', {});
                    res.success ? success(res.message) : error(res.message);
                } catch (err) { error(err.message); }
            });

            form.querySelector('#test-smtp')?.addEventListener('click', async () => {
                const to = prompt('Send test email to:');
                if (!to) return;
                try {
                    const res = await api.post(`/settings/smtp/test?to_email=${encodeURIComponent(to)}`, {});
                    res.success ? success(res.message) : error(res.message);
                } catch (err) { error(err.message); }
            });

            form.querySelector('#test-sms')?.addEventListener('click', async () => {
                const to = prompt('Send test SMS to (with country code):');
                if (!to) return;
                try {
                    const res = await api.post(`/settings/sms/test?to_number=${encodeURIComponent(to)}`, {});
                    res.success ? success(res.message) : error(res.message);
                } catch (err) { error(err.message); }
            });

            form.querySelector('#test-telegram')?.addEventListener('click', async () => {
                try {
                    const res = await api.post('/settings/telegram/test', {});
                    res.success ? success(res.message) : error(res.message);
                } catch (err) { error(err.message); }
            });

            content.innerHTML = '';
            content.appendChild(form);
        } catch (err) {
            content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.cat;
            loadCategory(activeCategory);
        });
    });

    loadCategory(activeCategory);
}
