<?php
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Session.php';
require_once __DIR__ . '/../src/HotspotVars.php';
require_once __DIR__ . '/../src/ApiClient.php';

Session::start();
$hs = new HotspotVars();

if ($hs->linkLogin) {
    Session::set('hs_mac', $hs->mac);
    Session::set('hs_ip', $hs->ip);
    Session::set('hs_link_login', $hs->linkLogin);
    Session::set('hs_dst_url', $hs->dstUrl);
}

$error = Session::flash('error');

// Load portal branding from DB settings
$ps = ApiClient::getPortalSettings();
$companyName   = $ps['company_name']          ?? 'Office WiFi';
$welcomeText   = $ps['welcome_text']           ?? 'Please identify yourself to connect';
$logoUrl       = $ps['logo_url']               ?? '';
$accentColor   = $ps['accent_color']           ?? '#4e73df';
$bgColor       = $ps['bg_color']               ?? '#07090f';
$showEmployee  = ($ps['show_employee_tab']     ?? 'true') === 'true';
$showGuest     = ($ps['show_guest_tab']        ?? 'true') === 'true';
$footerText    = $ps['footer_text']            ?? 'Powered by HotspotMgr';
$supportEmail  = $ps['support_email']          ?? '';
$language      = $ps['language']              ?? 'en';
$darkToggle    = ($ps['enable_dark_mode_toggle'] ?? 'true') === 'true';
$customCss     = $ps['custom_css']             ?? '';
$enableVoucher = ($ps['enable_voucher']        ?? 'true') === 'true';
$guestFields   = array_map('trim', explode(',', $ps['guest_id_fields'] ?? 'name,email,mobile'));

// Labels (Bengali / English)
$t = $language === 'bn' ? [
    'employee'          => 'কর্মী',
    'guest'             => 'অতিথি',
    'work_email'        => 'অফিস ইমেইল',
    'password'          => 'পাসওয়ার্ড',
    'connect'           => 'সংযুক্ত হন',
    'full_name'         => 'পূর্ণ নাম',
    'email'             => 'ইমেইল',
    'mobile'            => 'মোবাইল নম্বর',
    'request_access'    => 'প্রবেশাধিকার চাইতে',
    'verify_code'       => 'কোড যাচাই করুন',
    'verify_email'      => 'আপনার ইমেইল যাচাই করুন',
    'otp_sent'          => 'আপনার ইমেইলে ৬ সংখ্যার কোড পাঠানো হয়েছে।',
    'awaiting'          => 'অনুমোদনের অপেক্ষায়',
    'awaiting_desc'     => 'আপনার অনুরোধ জমা দেওয়া হয়েছে। অপারেটর শীঘ্রই অনুমোদন করবেন।',
    'resend'            => 'কোড পুনরায় পাঠান',
    'voucher_label'     => 'ভাউচার কোড আছে?',
    'voucher_input'     => 'ভাউচার কোড লিখুন',
    'use_voucher'       => 'ভাউচার ব্যবহার করুন',
    'your_email'        => 'আপনার ইমেইল',
    'your_password'     => 'আপনার পাসওয়ার্ড',
] : [
    'employee'          => 'Employee',
    'guest'             => 'Guest',
    'work_email'        => 'Work Email',
    'password'          => 'Password',
    'connect'           => 'Connect',
    'full_name'         => 'Full Name',
    'email'             => 'Email Address',
    'mobile'            => 'Mobile Number',
    'request_access'    => 'Request Access',
    'verify_code'       => 'Verify Code',
    'verify_email'      => 'Verify Your Email',
    'otp_sent'          => 'Enter the 6-digit code sent to your email.',
    'awaiting'          => 'Awaiting Approval',
    'awaiting_desc'     => 'Your request has been submitted. An operator will approve your access shortly.',
    'resend'            => 'Resend code',
    'voucher_label'     => 'Have a voucher code?',
    'voucher_input'     => 'Enter voucher code',
    'use_voucher'       => 'Use Voucher',
    'your_email'        => 'you@company.com',
    'your_password'     => 'Your password',
];
?>
<!DOCTYPE html>
<html lang="<?= $language ?>" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($companyName) ?> — WiFi Portal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/portal.css">
    <style>
        :root {
            --accent: <?= htmlspecialchars($accentColor) ?>;
            --accent-glow: <?= htmlspecialchars($accentColor) ?>44;
            --bg-base: <?= htmlspecialchars($bgColor) ?>;
        }
        <?php if ($customCss): ?>
        <?= $customCss ?>
        <?php endif; ?>
    </style>
</head>
<body>

<!-- Animated background -->
<div class="bg-mesh" aria-hidden="true">
    <div class="mesh-blob mesh-blob-1"></div>
    <div class="mesh-blob mesh-blob-2"></div>
</div>

<?php if ($darkToggle): ?>
<!-- Theme toggle -->
<button class="theme-toggle" id="theme-toggle" title="Toggle dark/light mode">
    <svg id="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>
    <svg id="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
</button>
<?php endif; ?>

<div class="portal-wrapper" id="portal-wrapper">
    <div class="portal-card" id="portal-card">

        <!-- Logo / Branding -->
        <div class="portal-logo" id="portal-logo">
            <?php if ($logoUrl): ?>
                <img src="<?= htmlspecialchars($logoUrl) ?>" alt="<?= htmlspecialchars($companyName) ?>" class="brand-logo">
            <?php else: ?>
                <div class="wifi-glyph">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M5 12.55a11 11 0 0114.08 0"/>
                        <path d="M1.42 9a16 16 0 0121.16 0"/>
                        <path d="M8.53 16.11a6 6 0 016.95 0"/>
                        <circle cx="12" cy="20" r="1" fill="currentColor"/>
                    </svg>
                </div>
            <?php endif; ?>
            <h1><?= htmlspecialchars($companyName) ?></h1>
            <p><?= htmlspecialchars($welcomeText) ?></p>
        </div>

        <?php if ($error): ?>
        <div class="alert alert-error" id="static-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <div class="alert alert-error" id="dynamic-error" style="display:none"></div>

        <!-- Progress steps indicator -->
        <div class="steps-bar" id="steps-bar" style="display:none">
            <div class="step-dot active" data-step="1">1</div>
            <div class="step-line"></div>
            <div class="step-dot" data-step="2">2</div>
            <div class="step-line"></div>
            <div class="step-dot" data-step="3">3</div>
        </div>

        <!-- Tabs (only if both are enabled) -->
        <?php if ($showEmployee && $showGuest): ?>
        <div class="tab-nav" id="tab-nav">
            <button class="tab-btn active" data-tab="employee"><?= $t['employee'] ?></button>
            <button class="tab-btn" data-tab="guest"><?= $t['guest'] ?></button>
        </div>
        <?php endif; ?>

        <!-- Employee Tab -->
        <?php if ($showEmployee): ?>
        <div id="tab-employee" class="tab-content <?= (!$showGuest || true) ? 'active' : '' ?>">
            <form id="employee-form" action="/login.php" method="POST">
                <input type="hidden" name="type" value="employee">
                <div class="form-group">
                    <label for="emp-email"><?= $t['work_email'] ?></label>
                    <input type="email" id="emp-email" name="email" placeholder="<?= $t['your_email'] ?>" required autocomplete="email" class="form-input">
                </div>
                <div class="form-group">
                    <label for="emp-pass"><?= $t['password'] ?></label>
                    <div class="input-wrap">
                        <input type="password" id="emp-pass" name="password" placeholder="••••••••" required autocomplete="current-password" class="form-input">
                        <button type="button" class="toggle-pw" data-target="emp-pass" title="Show/hide password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full" id="emp-submit-btn">
                    <span class="btn-text"><?= $t['connect'] ?></span>
                    <span class="btn-spinner" style="display:none">
                        <svg viewBox="0 0 24 24" class="spin" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0"/></svg>
                    </span>
                </button>
            </form>
        </div>
        <?php endif; ?>

        <!-- Guest Tab -->
        <?php if ($showGuest): ?>
        <div id="tab-guest" class="tab-content <?= !$showEmployee ? 'active' : '' ?>">

            <!-- Step 1: Registration -->
            <div id="guest-step-1" class="step-pane active">

                <?php if ($enableVoucher): ?>
                <div class="voucher-toggle-area">
                    <button type="button" class="btn-link" id="show-voucher-btn"><?= $t['voucher_label'] ?></button>
                    <div id="voucher-form" style="display:none">
                        <div class="form-group">
                            <label><?= $t['voucher_input'] ?></label>
                            <div class="input-group">
                                <input type="text" id="voucher-code" class="form-input" placeholder="WIFI-XXXXXXXX" style="text-transform:uppercase;letter-spacing:2px;font-family:monospace">
                                <button type="button" class="btn btn-primary" id="use-voucher-btn"><?= $t['use_voucher'] ?></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="separator"><span>or register</span></div>
                <?php endif; ?>

                <form id="guest-register-form">
                    <?php if (in_array('name', $guestFields)): ?>
                    <div class="form-group">
                        <label for="g-name"><?= $t['full_name'] ?></label>
                        <input type="text" id="g-name" name="full_name" placeholder="John Doe" required class="form-input" autocomplete="name">
                    </div>
                    <?php endif; ?>
                    <?php if (in_array('email', $guestFields)): ?>
                    <div class="form-group">
                        <label for="g-email"><?= $t['email'] ?></label>
                        <input type="email" id="g-email" name="email" placeholder="you@email.com" required class="form-input" autocomplete="email">
                    </div>
                    <?php endif; ?>
                    <?php if (in_array('mobile', $guestFields)): ?>
                    <div class="form-group">
                        <label for="g-mobile"><?= $t['mobile'] ?></label>
                        <input type="tel" id="g-mobile" name="mobile" placeholder="+880XXXXXXXXXX" required class="form-input" autocomplete="tel">
                    </div>
                    <?php endif; ?>
                    <button type="submit" class="btn btn-primary btn-full" id="guest-register-btn">
                        <span class="btn-text"><?= $t['request_access'] ?></span>
                        <span class="btn-spinner" style="display:none">
                            <svg viewBox="0 0 24 24" class="spin" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0"/></svg>
                        </span>
                    </button>
                </form>
            </div>

            <!-- Step 2: OTP -->
            <div id="guest-step-2" class="step-pane">
                <div class="step-info">
                    <div class="step-icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8l5 4 5-4"/></svg>
                    </div>
                    <h3><?= $t['verify_email'] ?></h3>
                    <p id="otp-instruction"><?= $t['otp_sent'] ?></p>
                </div>
                <!-- Split OTP boxes -->
                <div class="otp-boxes" id="otp-boxes">
                    <?php for ($i = 0; $i < 6; $i++): ?>
                    <input type="text" class="otp-box" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="<?= $i === 0 ? 'one-time-code' : 'off' ?>">
                    <?php endfor; ?>
                </div>
                <input type="hidden" id="otp-input" name="otp" value="">
                <button type="button" class="btn btn-primary btn-full" id="verify-otp-btn">
                    <span class="btn-text"><?= $t['verify_code'] ?></span>
                    <span class="btn-spinner" style="display:none">
                        <svg viewBox="0 0 24 24" class="spin" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0"/></svg>
                    </span>
                </button>
                <div class="resend-area">
                    <button type="button" class="btn-link" id="resend-btn" disabled>
                        <?= $t['resend'] ?> (<span id="countdown">60</span>s)
                    </button>
                </div>
            </div>

            <!-- Step 3: Pending -->
            <div id="guest-step-3" class="step-pane">
                <div class="step-info pending-info">
                    <div class="pending-animation">
                        <div class="pending-ring"></div>
                        <div class="pending-ring ring-2"></div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" class="pending-icon"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    </div>
                    <h3><?= $t['awaiting'] ?></h3>
                    <p><?= $t['awaiting_desc'] ?></p>
                    <p class="queue-pos" id="queue-pos"></p>
                </div>
            </div>

        </div>
        <?php endif; ?>

        <!-- Footer -->
        <div class="portal-footer">
            <?php if ($supportEmail): ?>
            <p>Need help? <a href="mailto:<?= htmlspecialchars($supportEmail) ?>"><?= htmlspecialchars($supportEmail) ?></a></p>
            <?php endif; ?>
            <p><?= htmlspecialchars($footerText) ?></p>
        </div>

    </div><!-- .portal-card -->
</div><!-- .portal-wrapper -->

<!-- GSAP -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" crossorigin="anonymous"></script>
<script src="/assets/js/portal.js"></script>
<script>
    window.HOTSPOT = {
        linkLogin: <?= json_encode($hs->linkLogin) ?>,
        mac: <?= json_encode($hs->mac) ?>,
        ip: <?= json_encode($hs->ip) ?>,
        dstUrl: <?= json_encode($hs->dstUrl) ?>
    };
    window.PORTAL_CONFIG = {
        enableVoucher: <?= json_encode($enableVoucher) ?>,
    };
</script>
</body>
</html>
