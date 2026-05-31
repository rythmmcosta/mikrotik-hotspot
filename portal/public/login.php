<?php
require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Session.php';
require_once __DIR__ . '/../src/ApiClient.php';
require_once __DIR__ . '/../src/HotspotVars.php';

Session::start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /');
    exit;
}

$type     = $_POST['type'] ?? '';
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if ($type !== 'employee' || !$email || !$password) {
    Session::flash('error', 'Invalid request.');
    header('Location: /');
    exit;
}

// Call backend employee authentication
$result = ApiClient::post('/auth/employee-login', ['email' => $email, 'password' => $password]);

if (($result['_http_code'] ?? 0) !== 200 || empty($result['hotspot_username'])) {
    Session::flash('error', 'Invalid email or password. Please try again.');
    header('Location: /');
    exit;
}

$hotspotUser = $result['hotspot_username'];
$hotspotPass = $result['hotspot_password'];
$linkLogin   = Session::get('hs_link_login', '');
$dstUrl      = Session::get('hs_dst_url', 'http://www.google.com');

if ($linkLogin) {
    $loginUrl = $linkLogin
        . (strpos($linkLogin, '?') === false ? '?' : '&')
        . 'username=' . urlencode($hotspotUser)
        . '&password=' . urlencode($hotspotPass)
        . '&dst=' . urlencode($dstUrl);
    header('Location: ' . $loginUrl);
    exit;
}

// Fallback if no hotspot link (direct portal test)
Session::flash('error', 'Session expired. Please reconnect to WiFi.');
header('Location: /');
