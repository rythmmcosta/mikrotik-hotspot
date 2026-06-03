<?php
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Session.php';
require_once __DIR__ . '/../src/ApiClient.php';
Session::start();

$guestId = Session::get('guest_id');
if (!$guestId) {
    header('Location: /');
    exit;
}

$ps          = ApiClient::getPortalSettings();
$companyName = $ps['company_name'] ?? 'Office WiFi';
$footerText  = $ps['footer_text']  ?? 'Powered by HotspotMgr';
$accentColor = $ps['accent_color'] ?? '#4e73df';
$bgColor     = $ps['bg_color']     ?? '#07090f';
$logoUrl     = $ps['logo_url']     ?? '';
$darkToggle  = ($ps['enable_dark_mode_toggle'] ?? 'true') === 'true';
$customCss   = $ps['custom_css']   ?? '';
$lang        = $ps['language']     ?? 'en';

$t = $lang === 'bn' ? [
    'waiting'  => 'অনুমোদনের জন্য অপেক্ষা করছি',
    'subtitle' => 'আপনার WiFi অ্যাক্সেস অনুরোধ পর্যালোচনা করা হচ্ছে',
    'note'     => 'এই পেজটি বন্ধ করবেন না। অনুমোদন হলে আপনি স্বয়ংক্রিয়ভাবে সংযুক্ত হবেন।',
    'checking' => 'স্ট্যাটাস যাচাই করা হচ্ছে…',
    'approved' => 'অনুমোদিত! সংযুক্ত হচ্ছি…',
    'rejected' => 'অ্যাক্সেস প্রত্যাখ্যাত। IT সাপোর্টে যোগাযোগ করুন।',
    'queue'    => 'অপেক্ষার লাইনে',
] : [
    'waiting'  => 'Waiting for Approval',
    'subtitle' => 'Your WiFi access request is being reviewed by an operator',
    'note'     => 'Do not close this page. You will be connected automatically once approved.',
    'checking' => 'Checking status…',
    'approved' => 'Approved! Connecting…',
    'rejected' => 'Access denied. Please contact IT support.',
    'queue'    => 'In queue',
];

$accentGlow = $accentColor . '44';
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($lang) ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($t['waiting']) ?> — <?= htmlspecialchars($companyName) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/portal.css">
    <style>
        :root {
            --accent: <?= htmlspecialchars($accentColor) ?>;
            --accent-glow: <?= htmlspecialchars($accentGlow) ?>;
            --bg-base: <?= htmlspecialchars($bgColor) ?>;
        }
        <?php if ($customCss): ?>
        <?= $customCss ?>
        <?php endif; ?>
    </style>
</head>
<body>

<?php if ($darkToggle): ?>
<button class="theme-toggle" id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
    <svg id="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg id="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:none">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
</button>
<?php endif; ?>

<div class="bg-mesh">
    <div class="mesh-blob mesh-blob-1"></div>
    <div class="mesh-blob mesh-blob-2"></div>
</div>

<div class="portal-wrapper" id="portal-wrapper" style="opacity:0">
    <div class="portal-card">

        <!-- Logo -->
        <div class="portal-logo" id="portal-logo">
            <?php if ($logoUrl): ?>
                <img src="<?= htmlspecialchars($logoUrl) ?>" alt="<?= htmlspecialchars($companyName) ?>" class="brand-logo">
            <?php else: ?>
                <div class="wifi-glyph" id="wifi-glyph">
                    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
                    </svg>
                </div>
            <?php endif; ?>
            <h1><?= htmlspecialchars($companyName) ?></h1>
        </div>

        <!-- Pending animation -->
        <div class="step-info pending-info" id="pending-body">
            <p id="pending-subtitle"><?= htmlspecialchars($t['subtitle']) ?></p>

            <div class="pending-animation" id="pending-anim">
                <div class="pending-ring"></div>
                <div class="pending-ring ring-2"></div>
                <div class="pending-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l3 3"/>
                    </svg>
                </div>
            </div>

            <p id="status-msg" class="queue-pos"><?= htmlspecialchars($t['checking']) ?></p>
        </div>

        <!-- Footer -->
        <div class="portal-footer">
            <p><?= htmlspecialchars($t['note']) ?></p>
            <p><?= htmlspecialchars($footerText) ?></p>
        </div>

    </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" crossorigin="anonymous"></script>
<script>
const GUEST_ID   = <?= json_encode($guestId) ?>;
const LINK_LOGIN = <?= json_encode(Session::get('hs_link_login', '')) ?>;
const DST_URL    = <?= json_encode(Session::get('hs_dst_url', 'http://www.google.com')) ?>;
const API_BASE   = <?= json_encode(Config::API_BASE) ?>;

// ── Theme ────────────────────────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('portal_theme') || 'dark';
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    function updateIcons() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        document.getElementById('icon-moon').style.display = isDark  ? '' : 'none';
        document.getElementById('icon-sun').style.display  = isDark  ? 'none' : '';
    }
    updateIcons();
    btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('portal_theme', isDark ? 'light' : 'dark');
        updateIcons();
    });
})();

// ── Entrance animation ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('portal-wrapper');
    gsap.set(wrapper, { opacity: 1 });
    gsap.from('.portal-card', { y: 40, opacity: 0, scale: 0.95, duration: 0.65, ease: 'power3.out' });
    gsap.from('#portal-logo', { y: -20, opacity: 0, duration: 0.5, delay: 0.15, ease: 'power2.out' });
    gsap.from('#pending-body', { y: 20, opacity: 0, duration: 0.5, delay: 0.25, ease: 'power2.out' });

    // Pulsing pending icon
    gsap.to('#pending-anim', {
        scale: 1.04,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
    });
});

// ── Status polling ────────────────────────────────────────────────────────
let _pollCount = 0;

async function poll() {
    try {
        const res  = await fetch(API_BASE + '/guests/' + GUEST_ID + '/status');
        const data = await res.json();
        _pollCount++;

        const statusEl = document.getElementById('status-msg');

        if (data.status === 'approved' && data.hotspot_username) {
            statusEl.textContent = <?= json_encode($t['approved']) ?>;

            // Success animation then redirect
            gsap.timeline()
                .to('#pending-anim', { scale: 1.2, opacity: 0, duration: 0.4, ease: 'power2.in' })
                .to('.portal-card', { y: -20, opacity: 0, duration: 0.4, ease: 'power2.in' }, '-=0.1')
                .add(() => {
                    const url = LINK_LOGIN
                        + (LINK_LOGIN.includes('?') ? '&' : '?')
                        + 'username=' + encodeURIComponent(data.hotspot_username)
                        + '&password=' + encodeURIComponent(data.hotspot_password)
                        + '&dst=' + encodeURIComponent(DST_URL);
                    window.location.href = url;
                });
            return;
        }

        if (data.status === 'rejected') {
            statusEl.textContent = <?= json_encode($t['rejected']) ?>;
            gsap.to('#pending-anim', { opacity: 0.3, duration: 0.5 });
            return;
        }

        // Still pending — show queue position if available
        const pos = data.queue_position;
        statusEl.textContent = pos
            ? `<?= htmlspecialchars($t['queue']) ?> · #${pos}`
            : <?= json_encode($t['checking']) ?>;

        setTimeout(poll, _pollCount < 6 ? 8000 : 15000);
    } catch (e) {
        setTimeout(poll, 15000);
    }
}

setTimeout(poll, 5000);
</script>
</body>
</html>
