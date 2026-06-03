-- Seed: default admin user (password: Admin@123 - CHANGE IMMEDIATELY)
-- bcrypt hash of "Admin@123"
INSERT IGNORE INTO users (username, email, password_hash, role) VALUES (
    'admin',
    'admin@company.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGnEKMEg3aswqm7Q1oG5YdCDq7O',
    'admin'
);

-- Default bandwidth profiles
INSERT IGNORE INTO bandwidth_profiles (name, description, rate_limit_rx, rate_limit_tx, is_default_employee, is_default_guest) VALUES
('Employee Standard', 'Standard employee bandwidth', '20M', '20M', TRUE, FALSE),
('Guest Basic', 'Basic guest bandwidth', '5M', '5M', FALSE, TRUE),
('Guest Premium', 'Premium guest bandwidth', '10M', '10M', FALSE, FALSE);

-- Default settings
INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
('otp', 'method', 'email', FALSE, 'OTP delivery method: email or sms'),
('otp', 'ttl_minutes', '10', FALSE, 'OTP validity in minutes'),
('otp', 'max_attempts', '3', FALSE, 'Max failed OTP attempts before lockout'),
('otp', 'resend_cooldown_seconds', '60', FALSE, 'Seconds to wait before resending OTP'),
('smtp', 'host', '', FALSE, 'SMTP server hostname'),
('smtp', 'port', '587', FALSE, 'SMTP server port'),
('smtp', 'username', '', FALSE, 'SMTP username'),
('smtp', 'password', '', TRUE, 'SMTP password (encrypted)'),
('smtp', 'from_address', '', FALSE, 'From email address'),
('smtp', 'use_tls', 'true', FALSE, 'Use STARTTLS for SMTP'),
('sms', 'provider', 'twilio', FALSE, 'SMS provider: twilio'),
('sms', 'account_sid', '', TRUE, 'Twilio Account SID (encrypted)'),
('sms', 'auth_token', '', TRUE, 'Twilio Auth Token (encrypted)'),
('sms', 'from_number', '', FALSE, 'Twilio from phone number'),
('mikrotik', 'host', '', FALSE, 'MikroTik router IP address'),
('mikrotik', 'port', '8728', FALSE, 'RouterOS API port (8728 plain, 8729 SSL)'),
('mikrotik', 'use_ssl', 'false', FALSE, 'Use SSL for RouterOS API'),
('mikrotik', 'username', 'admin', FALSE, 'RouterOS API username'),
('mikrotik', 'password', '', TRUE, 'RouterOS API password (encrypted)'),
('system', 'session_poll_interval_seconds', '30', FALSE, 'How often to poll MikroTik for active sessions'),
('system', 'guest_session_max_hours', '8', FALSE, 'Default guest session duration in hours (0 = no limit)'),
('system', 'allowed_email_domains', '', FALSE, 'Comma-separated allowed email domains (empty = all)'),
('system', 'portal_url', 'http://localhost:9000', FALSE, 'Public URL of the captive portal'),
('system', 'syslog_port', '514', FALSE, 'UDP port for MikroTik syslog DNS capture'),
('system', 'agent_metrics_retention_days', '7', FALSE, 'Days to retain agent metrics before purging'),
('telegram', 'enabled', 'false', FALSE, 'Enable Telegram notifications'),
('telegram', 'bot_token', '', TRUE, 'Telegram Bot API Token (from @BotFather)'),
('telegram', 'default_chat_id', '', FALSE, 'Default channel or group chat ID for system alerts'),
('telegram', 'notify_guest_register', 'true', FALSE, 'Alert admins on new guest registration'),
('telegram', 'notify_guest_approved', 'true', FALSE, 'Alert admins when a guest is approved'),
('telegram', 'notify_employee_created', 'false', FALSE, 'Alert admins when a new employee is added');

-- BD SMS gateway settings (Phase 11)
INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
('sms', 'ssl_wireless_api_token', '', TRUE, 'SSL Wireless API Token'),
('sms', 'ssl_wireless_sender_id', 'HotspotMgr', FALSE, 'SSL Wireless Sender ID (alphanumeric, max 11 chars)'),
('sms', 'bulksmsbd_api_key', '', TRUE, 'BulkSMS BD API Key'),
('sms', 'bulksmsbd_sender_id', 'HotspotMgr', FALSE, 'BulkSMS BD Sender ID'),
('sms', 'custom_http_url', '', FALSE, 'Custom HTTP gateway URL with {number} and {message} placeholders'),
('sms', 'custom_http_method', 'GET', FALSE, 'HTTP method for custom gateway: GET or POST'),
('sms', 'custom_http_auth_header', '', TRUE, 'Auth header for custom gateway: Header-Name: value');

UPDATE settings SET value='ssl_wireless' WHERE category='sms' AND key_name='provider';

-- Log retention settings (Phase 11)
INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
('system', 'browsing_log_retention_days', '30', FALSE, 'Days to keep browsing/DNS log records'),
('system', 'connection_history_retention_days', '90', FALSE, 'Days to keep disconnected connection records'),
('system', 'audit_log_retention_days', '365', FALSE, 'Days to keep audit log entries'),
('system', 'otp_log_retention_days', '7', FALSE, 'Days to keep OTP log entries');

-- Portal branding and auto-approval settings (Phase 11)
INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
('portal', 'company_name', 'Office WiFi', FALSE, 'Company/organization name shown on portal'),
('portal', 'welcome_text', 'Please identify yourself to connect', FALSE, 'Subtitle text on portal login card'),
('portal', 'logo_url', '', FALSE, 'URL to company logo image (empty = default WiFi icon)'),
('portal', 'accent_color', '#4e73df', FALSE, 'Primary accent color for portal (hex code)'),
('portal', 'bg_color', '#07090f', FALSE, 'Portal background color (hex code)'),
('portal', 'show_employee_tab', 'true', FALSE, 'Show the Employee login tab on portal'),
('portal', 'show_guest_tab', 'true', FALSE, 'Show the Guest registration tab on portal'),
('portal', 'guest_id_fields', 'name,email,mobile', FALSE, 'Comma-separated guest form fields: name,email,mobile'),
('portal', 'footer_text', 'Powered by HotspotMgr', FALSE, 'Footer text displayed on portal'),
('portal', 'support_email', '', FALSE, 'Support email shown on portal (empty = hidden)'),
('portal', 'language', 'en', FALSE, 'Portal language: en (English) or bn (Bengali)'),
('portal', 'enable_dark_mode_toggle', 'true', FALSE, 'Allow visitors to toggle dark/light mode'),
('portal', 'custom_css', '', FALSE, 'Custom CSS injected into portal pages'),
('portal', 'auto_approve_domains', '', FALSE, 'Comma-separated email domains for instant guest approval'),
('portal', 'auto_approve_session_hours', '4', FALSE, 'Session duration for auto-approved guests (hours)'),
('portal', 'enable_voucher', 'true', FALSE, 'Show voucher code input on guest form');

-- Notification templates (Phase 11)
INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
('notifications', 'telegram_guest_register', '🔔 <b>New Guest Registration</b>\n{name} ({email}) is waiting for OTP verification.', FALSE, 'Telegram message when guest registers. Variables: {name} {email} {mobile}'),
('notifications', 'telegram_guest_approved', '✅ <b>Guest Approved</b>\n{name} ({email}) has been approved.', FALSE, 'Telegram message when guest is approved. Variables: {name} {email}'),
('notifications', 'telegram_guest_rejected', '❌ <b>Guest Rejected</b>\n{name} ({email}) was rejected.{reason}', FALSE, 'Telegram message when guest is rejected. Variables: {name} {email} {reason}'),
('notifications', 'telegram_employee_created', '👤 <b>New Employee Added</b>\n{name} ({email}) added by {admin}.', FALSE, 'Telegram message when employee is created. Variables: {name} {email} {admin}'),
('notifications', 'telegram_hotspot_login', '📶 <b>Hotspot Login</b>\n{username} ({user_type}) connected from {ip}.', FALSE, 'Telegram message on hotspot login. Variables: {username} {user_type} {ip}'),
('notifications', 'email_otp_subject', 'Your WiFi Access Code', FALSE, 'Subject line for OTP email'),
('notifications', 'email_otp_body', '<p>Your WiFi verification code is: <b style="font-size:24px">{otp}</b></p><p>This code expires in <b>{minutes} minutes</b>.</p><p>Do not share this code with anyone.</p>', FALSE, 'HTML body for OTP email. Variables: {otp} {minutes}'),
('notifications', 'sms_otp', 'Your WiFi access code: {otp}. Valid for {minutes} min. Do not share.', FALSE, 'SMS text for OTP. Variables: {otp} {minutes}');
