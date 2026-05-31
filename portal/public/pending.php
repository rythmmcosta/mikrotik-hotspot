<?php
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Session.php';
Session::start();

$guestId = Session::get('guest_id');
if (!$guestId) {
    header('Location: /');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waiting for Approval</title>
    <link rel="stylesheet" href="/assets/css/portal.css">
</head>
<body>
<div class="portal-wrapper">
    <div class="portal-card">
        <div class="portal-logo">
            <div class="wifi-icon">&#x23F3;</div>
            <h1>Waiting for Approval</h1>
        </div>
        <div class="step-info pending-info">
            <p>Your WiFi access request is in the queue. An operator will approve it shortly.</p>
            <div class="spinner"></div>
            <p id="status-msg" class="muted">Checking status...</p>
        </div>
        <div class="portal-footer">
            <p>Do not close this page. You will be connected automatically.</p>
        </div>
    </div>
</div>
<script>
const GUEST_ID   = <?= json_encode($guestId) ?>;
const LINK_LOGIN = <?= json_encode(Session::get('hs_link_login', '')) ?>;
const DST_URL    = <?= json_encode(Session::get('hs_dst_url', 'http://www.google.com')) ?>;
const API_BASE   = <?= json_encode(Config::API_BASE) ?>;

async function poll() {
    try {
        const res = await fetch(API_BASE + '/guests/' + GUEST_ID + '/status');
        const data = await res.json();
        document.getElementById('status-msg').textContent = 'Status: ' + data.status;

        if (data.status === 'approved' && data.hotspot_username) {
            document.getElementById('status-msg').textContent = 'Approved! Connecting...';
            const url = LINK_LOGIN
                + (LINK_LOGIN.includes('?') ? '&' : '?')
                + 'username=' + encodeURIComponent(data.hotspot_username)
                + '&password=' + encodeURIComponent(data.hotspot_password)
                + '&dst=' + encodeURIComponent(DST_URL);
            window.location.href = url;
        } else if (data.status === 'rejected') {
            document.getElementById('status-msg').textContent = 'Access denied. Please contact IT support.';
        } else {
            setTimeout(poll, 10000);
        }
    } catch(e) {
        setTimeout(poll, 15000);
    }
}

setTimeout(poll, 5000);
</script>
</body>
</html>
