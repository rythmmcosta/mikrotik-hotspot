import { renderSidebar } from '../../components/Sidebar.js';
import { renderTopbar, destroyTopbar } from '../../components/Topbar.js';
import { success, error } from '../../components/Toast.js';
import { api } from '../../api/client.js';

const CATEGORIES = [
    { key: 'mikrotik',       label: 'MikroTik Router',       icon: 'tabler:router' },
    { key: 'otp',            label: 'OTP Settings',           icon: 'tabler:key' },
    { key: 'smtp',           label: 'Email (SMTP)',           icon: 'tabler:mail' },
    { key: 'sms',            label: 'SMS Gateway',            icon: 'tabler:device-mobile' },
    { key: 'telegram',       label: 'Telegram Bot',           icon: 'tabler:brand-telegram' },
    { key: 'portal',         label: 'Portal Branding',        icon: 'tabler:paint' },
    { key: 'notifications',  label: 'Notification Templates', icon: 'tabler:template' },
    { key: 'system',         label: 'System & Retention',     icon: 'tabler:settings' },
];

const SMS_PROVIDER_FIELDS = {
    ssl_wireless: ['ssl_wireless_api_token', 'ssl_wireless_sender_id'],
    bulksmsbd:    ['bulksmsbd_api_key', 'bulksmsbd_sender_id'],
    twilio:       ['account_sid', 'auth_token', 'from_number'],
    custom_http:  ['custom_http_url', 'custom_http_method', 'custom_http_auth_header'],
};

const TEXTAREA_KEYS = new Set([
    'custom_css', 'email_otp_body', 'telegram_guest_register', 'telegram_guest_approved',
    'telegram_guest_rejected', 'telegram_employee_created', 'telegram_hotspot_login',
]);

function _inputType(s) {
    if (s.is_encrypted) return 'password';
    if (TEXTAREA_KEYS.has(s.key_name)) return 'textarea';
    if (s.key_name === 'accent_color' || s.key_name === 'bg_color') return 'color';
    if (/(_days|_seconds|_hours|_minutes|_port|port)$/.test(s.key_name)) return 'number';
    return 'text';
}

function _fieldLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function renderSettings(container) {
    container.innerHTML = `
        <div class="app-layout">
            <div id="sidebar-mount"></div>
            <div class="main-area">
                <div id="topbar-mount"></div>
                <main class="main-content">
                    <div class="page-header"><h2>System Settings</h2></div>
                    <div class="settings-tabs">
                        ${CATEGORIES.map((c, i) => `<button class="tab-btn ${i===0?'active':''}" data-cat="${c.key}">
                            <iconify-icon icon="${c.icon}" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>${c.label}
                        </button>`).join('')}
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
        content.innerHTML = '<div class="loading"><iconify-icon icon="eos-icons:loading" width="24"></iconify-icon></div>';
        try {
            const data = await api.get(`/settings/${cat}`);
            const settings = data.settings || [];

            const form = document.createElement('form');
            form.className = 'settings-form';

            if (cat === 'sms') {
                _buildSmsForm(form, settings);
            } else {
                settings.forEach(s => {
                    const type = _inputType(s);
                    const div = document.createElement('div');
                    div.className = 'form-group';
                    const val = s.is_encrypted ? '' : (s.value || '');
                    div.innerHTML = `
                        <label>${_fieldLabel(s.key_name)}</label>
                        ${s.description ? `<small class="hint">${s.description}</small>` : ''}
                        ${type === 'textarea'
                            ? `<textarea name="${s.key_name}" class="input" rows="3" style="min-height:80px;resize:vertical">${val}</textarea>`
                            : `<input type="${type}" name="${s.key_name}"
                                   value="${type === 'color' ? (s.value || '#4e73df') : val}"
                                   placeholder="${s.is_encrypted ? '(encrypted — leave blank to keep)' : ''}"
                                   class="input">`
                        }
                    `;
                    form.appendChild(div);
                });
            }

            const actions = document.createElement('div');
            actions.className = 'form-actions';
            actions.innerHTML = `
                <button type="submit" class="btn btn-primary">
                    <iconify-icon icon="tabler:device-floppy" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>
                    Save ${CATEGORIES.find(c=>c.key===cat)?.label}
                </button>
                ${cat === 'mikrotik'  ? `<button type="button" id="test-mikrotik" class="btn btn-ghost"><iconify-icon icon="tabler:plug-connected" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Test Connection</button>` : ''}
                ${cat === 'smtp'      ? `<button type="button" id="test-smtp" class="btn btn-ghost"><iconify-icon icon="tabler:send" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test Email</button>` : ''}
                ${cat === 'sms'       ? `<button type="button" id="test-sms" class="btn btn-ghost"><iconify-icon icon="tabler:message" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test SMS</button>` : ''}
                ${cat === 'telegram'  ? `<button type="button" id="test-telegram" class="btn btn-ghost"><iconify-icon icon="tabler:brand-telegram" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Send Test Message</button>` : ''}
            `;
            if (cat === 'mikrotik') {
                const statusEl = document.createElement('div');
                statusEl.id = 'mikrotik-test-status';
                statusEl.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;display:none';
                actions.appendChild(statusEl);
            }
            form.appendChild(actions);

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
                } catch (err) { error(err.message); }
            });

            form.querySelector('#test-mikrotik')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const statusEl = form.querySelector('#mikrotik-test-status');
                btn.disabled = true;
                btn.textContent = 'Testing…';
                if (statusEl) { statusEl.style.display = 'none'; }
                try {
                    const res = await api.post('/settings/mikrotik/test', null);
                    if (res.success) {
                        success(res.message);
                        if (statusEl) {
                            statusEl.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;display:block;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);color:#34d399';
                            statusEl.textContent = '✓ ' + res.message;
                        }
                    } else {
                        error(res.message);
                        if (statusEl) {
                            statusEl.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;display:block;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171';
                            statusEl.textContent = '✗ ' + res.message;
                        }
                    }
                } catch (err) {
                    const msg = err.message || 'Connection failed';
                    error(msg);
                    if (statusEl) {
                        statusEl.style.cssText = 'margin-top:10px;padding:8px 12px;border-radius:6px;font-size:13px;display:block;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171';
                        statusEl.textContent = '✗ ' + msg;
                    }
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<iconify-icon icon="tabler:plug-connected" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Test Connection';
                }
            });

            form.querySelector('#test-smtp')?.addEventListener('click', async () => {
                const to = prompt('Send test email to:');
                if (!to) return;
                try { const res = await api.post(`/settings/smtp/test?to_email=${encodeURIComponent(to)}`, {}); res.success ? success(res.message) : error(res.message); }
                catch (err) { error(err.message); }
            });

            form.querySelector('#test-sms')?.addEventListener('click', async () => {
                const to = prompt('Send test SMS to (with country code, e.g. +8801XXXXXXXXX):');
                if (!to) return;
                try { const res = await api.post(`/settings/sms/test?to_number=${encodeURIComponent(to)}`, {}); res.success ? success(res.message) : error(res.message); }
                catch (err) { error(err.message); }
            });

            form.querySelector('#test-telegram')?.addEventListener('click', async () => {
                try { const res = await api.post('/settings/telegram/test', {}); res.success ? success(res.message) : error(res.message); }
                catch (err) { error(err.message); }
            });

            content.innerHTML = '';
            content.appendChild(form);

            // Append export section under system tab
            if (cat === 'system') {
                const exportCard = document.createElement('div');
                exportCard.className = 'card';
                exportCard.style.marginTop = '20px';
                exportCard.innerHTML = `
                    <div class="card-header"><h3 class="card-title">Export Data</h3><small class="text-muted">Download as Excel (.xlsx)</small></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:8px">
                        <a href="/api/v1/export/connections?days=30" class="btn btn-ghost btn-sm">
                            <iconify-icon icon="tabler:file-spreadsheet" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Connections (30d)
                        </a>
                        <a href="/api/v1/export/guests" class="btn btn-ghost btn-sm">
                            <iconify-icon icon="tabler:file-spreadsheet" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>All Guests
                        </a>
                        <a href="/api/v1/export/employees" class="btn btn-ghost btn-sm">
                            <iconify-icon icon="tabler:file-spreadsheet" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Employees
                        </a>
                        <a href="/api/v1/export/audit?days=30" class="btn btn-ghost btn-sm">
                            <iconify-icon icon="tabler:file-spreadsheet" width="13" style="vertical-align:middle;margin-right:4px"></iconify-icon>Audit Log (30d)
                        </a>
                    </div>
                `;
                content.appendChild(exportCard);
            }
        } catch (err) {
            content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    }

    function _buildSmsForm(form, settings) {
        const byKey = Object.fromEntries(settings.map(s => [s.key_name, s]));
        const currentProvider = byKey.provider?.value || 'ssl_wireless';

        const providerDiv = document.createElement('div');
        providerDiv.className = 'form-group';
        providerDiv.innerHTML = `
            <label>SMS Provider</label>
            <small class="hint">Select your SMS gateway provider. SSL Wireless and BulkSMS BD are popular Bangladesh providers.</small>
            <select name="provider" class="input" id="sms-provider-select">
                <option value="ssl_wireless" ${currentProvider==='ssl_wireless'?'selected':''}>SSL Wireless (Bangladesh)</option>
                <option value="bulksmsbd"    ${currentProvider==='bulksmsbd'?'selected':''}>BulkSMS BD (Bangladesh)</option>
                <option value="twilio"       ${currentProvider==='twilio'?'selected':''}>Twilio (International)</option>
                <option value="custom_http"  ${currentProvider==='custom_http'?'selected':''}>Custom HTTP Gateway</option>
            </select>
        `;
        form.appendChild(providerDiv);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'sms-provider-fields';
        form.appendChild(fieldsContainer);

        function renderProviderFields(provider) {
            fieldsContainer.innerHTML = '';
            const fields = SMS_PROVIDER_FIELDS[provider] || [];
            fields.forEach(key => {
                const s = byKey[key];
                if (!s) return;
                const div = document.createElement('div');
                div.className = 'form-group';
                div.innerHTML = `
                    <label>${_fieldLabel(s.key_name)}</label>
                    ${s.description ? `<small class="hint">${s.description}</small>` : ''}
                    <input type="${s.is_encrypted ? 'password' : 'text'}"
                           name="${s.key_name}"
                           value="${s.is_encrypted ? '' : (s.value || '')}"
                           placeholder="${s.is_encrypted ? '(encrypted — leave blank to keep)' : ''}"
                           class="input">
                `;
                fieldsContainer.appendChild(div);
            });
        }

        renderProviderFields(currentProvider);
        form.querySelector('#sms-provider-select').addEventListener('change', (e) => renderProviderFields(e.target.value));
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

    const cleanup = () => { destroyTopbar(); window.removeEventListener('hashchange', cleanup); };
    window.addEventListener('hashchange', cleanup, { once: true });
}
