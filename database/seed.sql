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
