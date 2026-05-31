<?php

/**
 * Parses MikroTik hotspot template variables passed as query params.
 * MikroTik injects: $(mac), $(ip), $(username), $(link-login-only), $(dst-url)
 */
class HotspotVars {
    public string $mac;
    public string $ip;
    public string $username;
    public string $linkLogin;
    public string $dstUrl;

    public function __construct() {
        $this->mac       = $_GET['mac'] ?? '';
        $this->ip        = $_GET['ip'] ?? '';
        $this->username  = $_GET['username'] ?? '';
        $this->linkLogin = $_GET['link-login-only'] ?? $_GET['linklogin'] ?? '';
        $this->dstUrl    = $_GET['dst'] ?? 'http://www.google.com';
    }

    public function buildLoginUrl(string $hotspotUser, string $hotspotPass): string {
        if (!$this->linkLogin) return '';
        return $this->linkLogin
            . (strpos($this->linkLogin, '?') === false ? '?' : '&')
            . 'username=' . urlencode($hotspotUser)
            . '&password=' . urlencode($hotspotPass)
            . '&dst=' . urlencode($this->dstUrl);
    }
}
