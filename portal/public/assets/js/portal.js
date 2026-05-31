'use strict';

const API = window.HOTSPOT ? window.location.protocol + '//' + window.location.hostname.replace(':9000','') + ':8000/api/v1' : '/api/v1';

// Tab switching
function switchTab(name, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).style.display = 'block';
    btn.classList.add('active');
}

// Guest registration flow
let guestId = null;
let currentTargetType = 'guest_email';
let countdownTimer = null;

document.getElementById('guest-register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('guest-register-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const data = {
        full_name: document.getElementById('g-name').value.trim(),
        email:     document.getElementById('g-email').value.trim(),
        mobile:    document.getElementById('g-mobile').value.trim(),
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
            btn.disabled = false;
            btn.textContent = 'Request Access';
            return;
        }

        guestId = json.guest_id;
        sessionStorage.setItem('guest_id', guestId);
        showStep(2);
        startCountdown();
    } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Request Access';
    }
});

document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('otp-input').value.trim();
    if (code.length !== 6) {
        showError('Please enter the 6-digit code.');
        return;
    }

    const btn = document.getElementById('verify-otp-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const res = await fetch(API + '/otp/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({guest_id: guestId, code, target_type: currentTargetType}),
        });
        const json = await res.json();

        if (!res.ok) {
            showError(json.detail || 'Invalid code. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Verify Code';
            return;
        }

        if (json.status === 'pending_approval') {
            showStep(3);
            startApprovalPolling();
        } else if (json.status === 'pending_otp') {
            // Mobile OTP step
            currentTargetType = 'guest_mobile';
            document.getElementById('otp-instruction').textContent = 'Enter the 6-digit code sent to your mobile number.';
            document.getElementById('otp-input').value = '';
            btn.disabled = false;
            btn.textContent = 'Verify Code';
            startCountdown();
        }
    } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Verify Code';
    }
});

document.getElementById('resend-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('resend-btn');
    btn.disabled = true;
    try {
        await fetch(API + '/otp/resend', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({guest_id: guestId, target_type: currentTargetType}),
        });
        startCountdown();
    } catch (e) {
        btn.disabled = false;
    }
});

function showStep(n) {
    document.getElementById('guest-step-1').style.display = n === 1 ? 'block' : 'none';
    document.getElementById('guest-step-2').style.display = n === 2 ? 'block' : 'none';
    document.getElementById('guest-step-3').style.display = n === 3 ? 'block' : 'none';
}

function startCountdown(seconds = 60) {
    if (countdownTimer) clearInterval(countdownTimer);
    const btn = document.getElementById('resend-btn');
    const display = document.getElementById('countdown');
    btn.disabled = true;
    display.textContent = seconds;
    let remaining = seconds;
    countdownTimer = setInterval(() => {
        remaining--;
        display.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            btn.disabled = false;
            btn.textContent = 'Resend code';
        }
    }, 1000);
}

function startApprovalPolling() {
    let polls = 0;
    const interval = setInterval(async () => {
        polls++;
        try {
            const res = await fetch(API + '/guests/' + guestId + '/status');
            const data = await res.json();
            const msg = document.getElementById('queue-pos');

            if (data.status === 'approved' && data.hotspot_username && window.HOTSPOT?.linkLogin) {
                clearInterval(interval);
                if (msg) msg.textContent = 'Approved! Connecting...';
                const url = window.HOTSPOT.linkLogin
                    + (window.HOTSPOT.linkLogin.includes('?') ? '&' : '?')
                    + 'username=' + encodeURIComponent(data.hotspot_username)
                    + '&password=' + encodeURIComponent(data.hotspot_password)
                    + '&dst=' + encodeURIComponent(window.HOTSPOT.dstUrl);
                setTimeout(() => { window.location.href = url; }, 500);
            } else if (data.status === 'rejected') {
                clearInterval(interval);
                if (msg) msg.textContent = 'Access denied. Please contact IT support.';
            } else {
                if (msg) msg.textContent = 'Still waiting... (check #' + polls + ')';
            }
        } catch (e) { /* network hiccup, retry */ }
    }, 10000);
}

function showError(msg) {
    let el = document.querySelector('.alert-error');
    if (!el) {
        el = document.createElement('div');
        el.className = 'alert alert-error';
        document.querySelector('.portal-card').insertBefore(el, document.querySelector('.tab-nav'));
    }
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}
