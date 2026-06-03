'use strict';

/* ─────────────────────────────────────────
   Portal JS — GSAP-powered, dynamic branding
   ──────────────────────────────────────── */

const API = (() => {
    const h = window.location.hostname.replace(/:.*$/, '');
    return window.location.protocol + '//' + h + ':8000/api/v1';
})();

// ── State ──────────────────────────────────
let guestId = null;
let currentTargetType = 'guest_email';
let countdownTimer = null;
let currentStep = 1;
const gsap = window.gsap;

// ── DOM helpers ────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// ── GSAP helpers ───────────────────────────
function animIn(el, extra = {}) {
    if (!el || !gsap) return;
    gsap.from(el, { opacity: 0, y: 18, duration: 0.35, ease: 'power3.out', ...extra });
}

function animOut(el, cb) {
    if (!el || !gsap) { cb?.(); return; }
    gsap.to(el, { opacity: 0, y: -14, duration: 0.22, ease: 'power2.in', onComplete: cb });
}

function shake(el) {
    if (!el || !gsap) return;
    gsap.fromTo(el,
        { x: -6 },
        { x: 6, repeat: 4, yoyo: true, duration: 0.06, ease: 'none', onComplete: () => gsap.set(el, { x: 0 }) }
    );
}

function btnLoading(btn, loading) {
    const text   = $('[data-text]', btn) || $('.btn-text', btn);
    const spinner = $('[data-spin]', btn) || $('.btn-spinner', btn);
    if (loading) {
        btn.disabled = true;
        if (text)    text.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-flex';
    } else {
        btn.disabled = false;
        if (text)    text.style.display = '';
        if (spinner) spinner.style.display = 'none';
    }
}

// ── Page entrance animation ────────────────
function initEntrance() {
    if (!gsap) return;
    const card = $('#portal-card');
    if (card) {
        gsap.from(card, { y: 40, opacity: 0, scale: 0.95, duration: 0.6, ease: 'power3.out' });
    }
    const logo = $('#portal-logo');
    if (logo) {
        gsap.from(logo, { y: -18, opacity: 0, duration: 0.5, delay: 0.15, ease: 'power2.out' });
    }
}

// ── Theme toggle ───────────────────────────
function initTheme() {
    const html  = document.documentElement;
    const btn   = $('#theme-toggle');
    if (!btn) return;
    const moon = $('#icon-moon');
    const sun  = $('#icon-sun');

    const saved = localStorage.getItem('portal_theme') || 'dark';
    html.setAttribute('data-theme', saved);
    if (saved === 'light') {
        if (moon) moon.style.display = 'none';
        if (sun)  sun.style.display  = 'block';
    }

    btn.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('portal_theme', next);
        if (moon) moon.style.display = next === 'dark' ? 'block' : 'none';
        if (sun)  sun.style.display  = next === 'dark' ? 'none'  : 'block';
        if (gsap) gsap.from(btn, { scale: 0.7, rotation: 30, duration: 0.25, ease: 'back.out(2)' });
    });
}

// ── Tab switching (employee ↔ guest) ───────
function initTabs() {
    const tabs = $$('.tab-btn');
    if (!tabs.length) return;

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            const currentPane = $('.tab-content.active');
            const nextPane    = $(`#tab-${target}`);
            if (!nextPane || currentPane === nextPane) return;

            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (gsap) {
                gsap.to(currentPane, {
                    opacity: 0, x: -20, duration: 0.2, ease: 'power2.in',
                    onComplete() {
                        currentPane.classList.remove('active');
                        currentPane.style.cssText = '';
                        nextPane.classList.add('active');
                        gsap.from(nextPane, { opacity: 0, x: 20, duration: 0.25, ease: 'power2.out' });
                    },
                });
            } else {
                currentPane.classList.remove('active');
                nextPane.classList.add('active');
            }
        });
    });
}

// ── Step navigation ────────────────────────
function showStep(n) {
    const panes = $$('.step-pane');
    const current = panes[currentStep - 1];
    const next    = panes[n - 1];
    if (!next) return;

    const stepsBar = $('#steps-bar');
    if (stepsBar && n > 1) stepsBar.style.display = 'flex';

    // Update step dots
    $$('.step-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i + 1 < n)  dot.classList.add('done');
        if (i + 1 === n) dot.classList.add('active');
    });
    $$('.step-line').forEach((line, i) => {
        line.classList.toggle('done', i + 1 < n);
    });

    if (gsap && current) {
        gsap.to(current, {
            opacity: 0, y: -16, duration: 0.22, ease: 'power2.in',
            onComplete() {
                current.classList.remove('active');
                current.style.cssText = '';
                next.classList.add('active');
                gsap.from(next, { opacity: 0, y: 20, duration: 0.3, ease: 'power2.out' });
            },
        });
    } else {
        current?.classList.remove('active');
        next.classList.add('active');
    }

    currentStep = n;
}

// ── OTP split boxes ────────────────────────
function initOtpBoxes() {
    const boxes   = $$('.otp-box');
    const hidden  = $('#otp-input');
    if (!boxes.length) return;

    boxes.forEach((box, i) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '').slice(-1);
            box.value = val;
            if (val) {
                box.classList.add('filled');
                if (i < boxes.length - 1) boxes[i + 1].focus();
            }
            syncHidden();
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
                syncHidden();
            }
            if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
            if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
        });

        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
            text.split('').forEach((ch, j) => {
                if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('filled'); }
            });
            syncHidden();
            if (text.length >= boxes.length) boxes[boxes.length - 1].focus();
        });
    });

    function syncHidden() {
        if (hidden) hidden.value = boxes.map(b => b.value).join('');
    }
}

// ── Show error ─────────────────────────────
function showError(msg) {
    const el = $('#dynamic-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'flex';
    if (gsap) gsap.from(el, { opacity: 0, y: -8, duration: 0.2 });
    setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ── Employee form ──────────────────────────
function initEmployeeForm() {
    const form = $('#employee-form');
    const btn  = $('#emp-submit-btn');
    if (!form || !btn) return;

    form.addEventListener('submit', () => {
        btnLoading(btn, true);
    });

    // Password show/hide
    $$('.toggle-pw').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', () => {
            const input = $(`#${toggleBtn.dataset.target}`);
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });
}

// ── Guest registration ──────────────────────
function initGuestRegistration() {
    const form = $('#guest-register-form');
    const btn  = $('#guest-register-btn');
    if (!form || !btn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnLoading(btn, true);

        const data = {
            full_name: $('#g-name')?.value.trim() || 'Guest',
            email:     $('#g-email')?.value.trim() || '',
            mobile:    $('#g-mobile')?.value.trim() || '',
        };

        try {
            const res = await fetch(API + '/guests/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });
            const json = await res.json();

            if (!res.ok) {
                showError(json.detail || 'Registration failed. Please try again.');
                shake(form);
                btnLoading(btn, false);
                return;
            }

            guestId = json.guest_id;
            sessionStorage.setItem('guest_id', guestId);

            const stepsBar = $('#steps-bar');
            if (stepsBar) stepsBar.style.display = 'flex';
            showStep(2);
            startCountdown();
            setTimeout(() => $('#otp-boxes .otp-box')?.focus(), 400);
        } catch {
            showError('Network error. Please try again.');
            btnLoading(btn, false);
        }
    });
}

// ── OTP verification ───────────────────────
function initOtpVerification() {
    const btn = $('#verify-otp-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const code = $('#otp-input')?.value.trim() || '';
        if (code.length !== 6) {
            showError('Please enter the complete 6-digit code.');
            shake($('#otp-boxes'));
            return;
        }

        btnLoading(btn, true);

        try {
            const res = await fetch(API + '/otp/verify', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ guest_id: guestId, code, target_type: currentTargetType }),
            });
            const json = await res.json();

            if (!res.ok) {
                showError(json.detail || 'Invalid code. Please try again.');
                shake($('#otp-boxes'));
                $$('.otp-box').forEach(b => { b.value = ''; b.classList.remove('filled'); });
                $('#otp-input').value = '';
                $$('.otp-box')[0]?.focus();
                btnLoading(btn, false);
                return;
            }

            if (json.status === 'pending_approval') {
                showStep(3);
                startApprovalPolling();
            } else if (json.status === 'pending_otp') {
                currentTargetType = 'guest_mobile';
                const instr = $('#otp-instruction');
                if (instr) instr.textContent = 'Enter the 6-digit code sent to your mobile.';
                $$('.otp-box').forEach(b => { b.value = ''; b.classList.remove('filled'); });
                $('#otp-input').value = '';
                $$('.otp-box')[0]?.focus();
                btnLoading(btn, false);
                startCountdown();
            }
        } catch {
            showError('Network error. Please try again.');
            btnLoading(btn, false);
        }
    });

    // Resend
    const resendBtn = $('#resend-btn');
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            resendBtn.disabled = true;
            try {
                await fetch(API + '/otp/resend', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ guest_id: guestId, target_type: currentTargetType }),
                });
                startCountdown();
            } catch {
                resendBtn.disabled = false;
            }
        });
    }
}

function startCountdown(seconds = 60) {
    if (countdownTimer) clearInterval(countdownTimer);
    const btn = $('#resend-btn');
    const display = $('#countdown');
    if (!btn || !display) return;
    btn.disabled = true;
    display.textContent = seconds;
    let remaining = seconds;
    countdownTimer = setInterval(() => {
        remaining--;
        display.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            btn.disabled = false;
            btn.innerHTML = 'Resend code';
        }
    }, 1000);
}

// ── Approval polling ───────────────────────
function startApprovalPolling() {
    let polls = 0;
    const interval = setInterval(async () => {
        polls++;
        try {
            const res = await fetch(API + '/guests/' + guestId + '/status');
            const data = await res.json();
            const msg = $('#queue-pos');

            if (data.status === 'approved' && data.hotspot_username && window.HOTSPOT?.linkLogin) {
                clearInterval(interval);
                if (msg) msg.textContent = '✓ Approved! Connecting...';
                const url = window.HOTSPOT.linkLogin
                    + (window.HOTSPOT.linkLogin.includes('?') ? '&' : '?')
                    + 'username=' + encodeURIComponent(data.hotspot_username)
                    + '&password=' + encodeURIComponent(data.hotspot_password)
                    + '&dst=' + encodeURIComponent(window.HOTSPOT.dstUrl);
                if (gsap) {
                    gsap.to('#portal-card', { scale: 1.03, opacity: 0, duration: 0.4, onComplete: () => { window.location.href = url; } });
                } else {
                    setTimeout(() => { window.location.href = url; }, 500);
                }
            } else if (data.status === 'rejected') {
                clearInterval(interval);
                if (msg) msg.textContent = '✗ Access denied. Please contact IT support.';
            } else {
                if (msg) msg.textContent = `Waiting for approval... (check #${polls})`;
            }
        } catch { /* retry */ }
    }, 10000);
}

// ── Voucher flow ───────────────────────────
function initVoucher() {
    const showBtn   = $('#show-voucher-btn');
    const form      = $('#voucher-form');
    const useBtn    = $('#use-voucher-btn');
    const codeInput = $('#voucher-code');
    if (!showBtn || !form) return;

    showBtn.addEventListener('click', () => {
        const open = form.style.display !== 'none';
        form.style.display = open ? 'none' : 'block';
        if (!open && gsap) gsap.from(form, { opacity: 0, y: -8, duration: 0.2 });
    });

    useBtn?.addEventListener('click', async () => {
        const code = codeInput?.value.trim().toUpperCase();
        if (!code) { showError('Please enter a voucher code.'); return; }

        btnLoading(useBtn, true);
        try {
            const res = await fetch(API + '/vouchers/validate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ code }),
            });
            const json = await res.json();
            if (!json.valid) {
                showError('Invalid, expired, or already used voucher code.');
                shake(form);
                btnLoading(useBtn, false);
                return;
            }
            // Voucher valid — register as guest with voucher_code
            const name  = $('#g-name')?.value.trim();
            const email = $('#g-email')?.value.trim();
            const mobile = $('#g-mobile')?.value.trim();
            if (!email) {
                showError('Please fill in your email address first.');
                btnLoading(useBtn, false);
                return;
            }
            const regRes = await fetch(API + '/guests/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ full_name: name || 'Guest', email, mobile: mobile || '0' }),
            });
            const regJson = await regRes.json();
            if (!regRes.ok) {
                showError(regJson.detail || 'Registration failed.');
                btnLoading(useBtn, false);
                return;
            }
            guestId = regJson.guest_id;
            showStep(3);
            startApprovalPolling();
        } catch {
            showError('Network error.');
            btnLoading(useBtn, false);
        }
    });
}

// ── Init ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initEntrance();
    initTheme();
    initTabs();
    initOtpBoxes();
    initEmployeeForm();
    initGuestRegistration();
    initOtpVerification();
    initVoucher();
});
