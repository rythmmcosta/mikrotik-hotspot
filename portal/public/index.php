<?php
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Session.php';
require_once __DIR__ . '/../src/HotspotVars.php';

Session::start();
$hs = new HotspotVars();

// Preserve hotspot vars in session for later pages
if ($hs->linkLogin) {
    Session::set('hs_mac', $hs->mac);
    Session::set('hs_ip', $hs->ip);
    Session::set('hs_link_login', $hs->linkLogin);
    Session::set('hs_dst_url', $hs->dstUrl);
}

$error = Session::flash('error');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WiFi Access Portal</title>
    <link rel="stylesheet" href="/assets/css/portal.css">
</head>
<body>
<div class="portal-wrapper">
    <div class="portal-card">
        <div class="portal-logo">
            <div class="wifi-icon">&#x1F4F6;</div>
            <h1>Office WiFi</h1>
            <p>Please identify yourself to connect</p>
        </div>

        <?php if ($error): ?>
        <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <!-- Tab Navigation -->
        <div class="tab-nav">
            <button class="tab-btn active" onclick="switchTab('employee', this)">Employee</button>
            <button class="tab-btn" onclick="switchTab('guest', this)">Guest</button>
        </div>

        <!-- Employee Tab -->
        <div id="tab-employee" class="tab-content active">
            <form id="employee-form" action="/login.php" method="POST">
                <input type="hidden" name="type" value="employee">
                <div class="form-group">
                    <label for="emp-email">Work Email</label>
                    <input type="email" id="emp-email" name="email" placeholder="you@company.com" required
                           autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="emp-pass">Password</label>
                    <input type="password" id="emp-pass" name="password" placeholder="Your password" required
                           autocomplete="current-password">
                </div>
                <button type="submit" class="btn btn-primary btn-full">Connect</button>
            </form>
        </div>

        <!-- Guest Tab -->
        <div id="tab-guest" class="tab-content" style="display:none">
            <!-- Step 1: Registration form -->
            <div id="guest-step-1">
                <form id="guest-register-form">
                    <div class="form-group">
                        <label for="g-name">Full Name</label>
                        <input type="text" id="g-name" name="full_name" placeholder="John Doe" required>
                    </div>
                    <div class="form-group">
                        <label for="g-email">Email Address</label>
                        <input type="email" id="g-email" name="email" placeholder="you@email.com" required>
                    </div>
                    <div class="form-group">
                        <label for="g-mobile">Mobile Number</label>
                        <input type="tel" id="g-mobile" name="mobile" placeholder="+1234567890" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full" id="guest-register-btn">
                        Request Access
                    </button>
                </form>
            </div>

            <!-- Step 2: OTP verification -->
            <div id="guest-step-2" style="display:none">
                <div class="step-info">
                    <div class="step-icon">&#x2709;&#xFE0F;</div>
                    <h3>Verify Your Email</h3>
                    <p id="otp-instruction">Enter the 6-digit code sent to your email.</p>
                </div>
                <div class="form-group">
                    <label for="otp-input">Verification Code</label>
                    <input type="text" id="otp-input" name="otp" placeholder="123456"
                           maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code">
                </div>
                <button type="button" class="btn btn-primary btn-full" id="verify-otp-btn">Verify Code</button>
                <div class="resend-area">
                    <button type="button" class="btn-link" id="resend-btn" disabled>
                        Resend code (<span id="countdown">60</span>s)
                    </button>
                </div>
            </div>

            <!-- Step 3: Awaiting approval -->
            <div id="guest-step-3" style="display:none">
                <div class="step-info pending-info">
                    <div class="step-icon">&#x23F3;</div>
                    <h3>Awaiting Approval</h3>
                    <p>Your request has been submitted. An operator will approve your access shortly.</p>
                    <div class="spinner"></div>
                    <p class="queue-pos" id="queue-pos"></p>
                </div>
            </div>
        </div>

        <div class="portal-footer">
            <p>For assistance, contact IT Support</p>
        </div>
    </div>
</div>

<script src="/assets/js/portal.js"></script>
<script>
    // Pass hotspot vars to JS
    window.HOTSPOT = {
        linkLogin: <?= json_encode($hs->linkLogin) ?>,
        mac: <?= json_encode($hs->mac) ?>,
        ip: <?= json_encode($hs->ip) ?>,
        dstUrl: <?= json_encode($hs->dstUrl) ?>
    };
</script>
</body>
</html>
