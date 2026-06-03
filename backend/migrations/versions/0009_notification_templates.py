"""notification_templates table + 110 templates, notifications inbox, push_subscriptions

Revision ID: 0009
Revises: 0008_vouchers
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008_vouchers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_templates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(120), unique=True, nullable=False),
        sa.Column("channel", sa.Enum("email", "sms", "telegram", name="notif_channel"), nullable=False),
        sa.Column("event", sa.String(100), nullable=False),
        sa.Column("label", sa.String(250), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("variables", sa.JSON, nullable=True),
        sa.Column("is_enabled", sa.Boolean, nullable=False, default=True),
        sa.Column("is_system", sa.Boolean, nullable=False, default=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("idx_notif_tmpl_channel_event", "notification_templates", ["channel", "event"])
    op.create_index("idx_notif_tmpl_enabled", "notification_templates", ["is_enabled"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("type", sa.Enum("info", "success", "warning", "error", name="notif_type"), nullable=False, server_default="info"),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_notifications_user_read", "notifications", ["user_id", "is_read"])

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text, nullable=False),
        sa.Column("p256dh_key", sa.Text, nullable=False),
        sa.Column("auth_key", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_push_user"),
    )

    # Remove old settings-table templates
    op.execute("DELETE FROM settings WHERE category='notifications'")

    # Seed all 110 templates
    op.execute(
        "INSERT IGNORE INTO notification_templates "
        "(slug, channel, event, label, subject, body, variables, is_enabled, is_system) VALUES "

        # ── EMAIL (40) ──────────────────────────────────────────────────────────
        "('email_otp_verification','email','otp_verification','OTP Verification Code','Your WiFi Access Code',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8faff;border-radius:12px\"><h2 style=\"color:#4e73df;margin-bottom:16px\">WiFi Access Verification</h2><p style=\"color:#334155\">Your one-time verification code is:</p><div style=\"font-size:36px;font-weight:700;letter-spacing:10px;color:#1e293b;background:#fff;border:2px solid #4e73df;padding:20px;text-align:center;border-radius:10px;margin:16px 0\">{otp}</div><p style=\"color:#64748b;font-size:14px\">This code expires in <strong>{minutes} minutes</strong>. Do not share it.</p></div>',"
        "'[\"otp\",\"minutes\"]',1,1),"

        "('email_otp_reminder','email','otp_reminder','OTP Reminder','Your WiFi Code is Waiting',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Reminder: Verify Your Access</h2><p>You requested WiFi access. Your code: <strong style=\"font-size:24px\">{otp}</strong></p><p style=\"color:#64748b;font-size:14px\">Expires in {minutes} minutes.</p></div>',"
        "'[\"otp\",\"minutes\"]',1,1),"

        "('email_guest_approved_welcome','email','guest_approved','Guest Approved — Welcome','Welcome! Your WiFi Access is Ready',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">✅ Access Approved!</h2><p>Hi <strong>{name}</strong>, your WiFi access request has been approved.</p><p style=\"color:#64748b\">Your session will be active for <strong>{hours} hours</strong>.</p></div>',"
        "'[\"name\",\"email\",\"hours\"]',1,1),"

        "('email_guest_rejected_notice','email','guest_rejected','Guest Rejected','Your WiFi Access Request Was Declined',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Access Request Declined</h2><p>Hi <strong>{name}</strong>, unfortunately your WiFi access request could not be approved at this time.</p><p>Reason: {reason}</p><p style=\"color:#64748b;font-size:13px\">If you believe this is an error, please contact IT support.</p></div>',"
        "'[\"name\",\"email\",\"reason\"]',1,1),"

        "('email_guest_session_expiring','email','guest_session_expiring','Guest Session Expiring Soon','Your WiFi Session Expires Soon',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">⏰ Session Expiring</h2><p>Hi <strong>{name}</strong>, your WiFi session will expire in <strong>{minutes} minutes</strong>.</p></div>',"
        "'[\"name\",\"minutes\"]',1,0),"

        "('email_guest_session_expired','email','guest_session_expired','Guest Session Expired','Your WiFi Session Has Ended',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#64748b\">Session Ended</h2><p>Hi <strong>{name}</strong>, your WiFi session has expired. Please register again if you need continued access.</p></div>',"
        "'[\"name\",\"email\"]',1,0),"

        "('email_guest_auto_approved','email','guest_auto_approved','Guest Auto-Approved','WiFi Access Auto-Approved',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">✅ Access Auto-Approved</h2><p>Hi <strong>{name}</strong>, your email domain is whitelisted. Your WiFi access has been automatically approved for <strong>{hours} hours</strong>.</p></div>',"
        "'[\"name\",\"email\",\"hours\"]',1,0),"

        "('email_guest_registration_receipt','email','guest_registration','Guest Registration Receipt','WiFi Access Request Received',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Request Received</h2><p>Hi <strong>{name}</strong>, we received your WiFi access request. An operator will review it shortly. You will be notified once approved.</p></div>',"
        "'[\"name\",\"email\"]',1,0),"

        "('email_employee_welcome','email','employee_welcome','New Employee Welcome','Welcome to the Network — Your WiFi Credentials',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Welcome, {name}!</h2><p>Your employee network account has been created.</p><table style=\"width:100%;border-collapse:collapse;margin:16px 0\"><tr><td style=\"padding:8px;border:1px solid #e2e8f0;font-weight:600\">Username</td><td style=\"padding:8px;border:1px solid #e2e8f0;font-family:monospace\">{hotspot_username}</td></tr><tr><td style=\"padding:8px;border:1px solid #e2e8f0;font-weight:600\">Password</td><td style=\"padding:8px;border:1px solid #e2e8f0;font-family:monospace\">{hotspot_password}</td></tr></table><p style=\"color:#64748b;font-size:13px\">Please change your password after first login.</p></div>',"
        "'[\"name\",\"email\",\"hotspot_username\",\"hotspot_password\"]',1,1),"

        "('email_employee_password_reset','email','employee_password_reset','Employee Password Reset','Your WiFi Password Has Been Reset',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Password Reset</h2><p>Hi <strong>{name}</strong>, your WiFi password has been reset.</p><p>New password: <strong style=\"font-family:monospace\">{new_password}</strong></p><p style=\"color:#64748b;font-size:13px\">Please change it immediately after login.</p></div>',"
        "'[\"name\",\"new_password\"]',1,1),"

        "('email_employee_suspended_notice','email','employee_suspended','Employee Account Suspended','Your WiFi Account Has Been Suspended',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Account Suspended</h2><p>Hi <strong>{name}</strong>, your WiFi account has been temporarily suspended. Reason: {reason}. Contact IT support for assistance.</p></div>',"
        "'[\"name\",\"reason\"]',1,0),"

        "('email_employee_reactivated_notice','email','employee_reactivated','Employee Account Reactivated','Your WiFi Account is Active Again',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">Account Reactivated</h2><p>Hi <strong>{name}</strong>, your WiFi account has been reactivated. You can now connect to the network.</p></div>',"
        "'[\"name\",\"email\"]',1,0),"

        "('email_employee_quota_warning_80','email','employee_quota_warning_80','Quota Warning 80%','WiFi Quota Warning: 80% Used',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">⚠️ Quota Warning</h2><p>Hi <strong>{name}</strong>, you have used <strong>80%</strong> of your daily WiFi quota ({used_mb} MB of {quota_mb} MB).</p></div>',"
        "'[\"name\",\"used_mb\",\"quota_mb\"]',1,0),"

        "('email_employee_quota_warning_90','email','employee_quota_warning_90','Quota Warning 90%','WiFi Quota Warning: 90% Used',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">⚠️ Quota Critical</h2><p>Hi <strong>{name}</strong>, you have used <strong>90%</strong> of your daily WiFi quota. You will be disconnected when it reaches 100%.</p></div>',"
        "'[\"name\",\"used_mb\",\"quota_mb\"]',1,0),"

        "('email_employee_quota_exceeded','email','employee_quota_exceeded','Quota Exceeded','WiFi Quota Exceeded — Disconnected',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Quota Exceeded</h2><p>Hi <strong>{name}</strong>, your daily WiFi quota of {quota_mb} MB has been reached. Your session has been terminated. Quota resets at midnight.</p></div>',"
        "'[\"name\",\"quota_mb\"]',1,0),"

        "('email_employee_quota_reset','email','employee_quota_reset','Quota Reset','Your WiFi Quota Has Been Reset',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">Quota Reset</h2><p>Hi <strong>{name}</strong>, your WiFi data quota has been reset. You have {quota_mb} MB available.</p></div>',"
        "'[\"name\",\"quota_mb\"]',1,0),"

        "('email_admin_new_guest_waiting','email','admin_new_guest_waiting','Admin: New Guest Waiting','[Action Required] New Guest in Queue',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">New Guest Waiting</h2><p><strong>{guest_name}</strong> ({guest_email}) is waiting for WiFi access approval.</p><p>Mobile: {guest_mobile}</p><p style=\"margin-top:16px\"><a href=\"{portal_url}/#/guests/queue\" style=\"background:#4e73df;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none\">Review in Admin Panel</a></p></div>',"
        "'[\"guest_name\",\"guest_email\",\"guest_mobile\",\"portal_url\"]',1,0),"

        "('email_admin_bulk_approve_summary','email','admin_bulk_approve','Admin: Bulk Approve Summary','Bulk Approval Complete',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">Bulk Approval Done</h2><p><strong>{count}</strong> guests were approved by <strong>{admin}</strong>.</p></div>',"
        "'[\"count\",\"admin\"]',1,0),"

        "('email_admin_bulk_reject_summary','email','admin_bulk_reject','Admin: Bulk Reject Summary','Bulk Rejection Complete',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Bulk Rejection Done</h2><p><strong>{count}</strong> guests were rejected by <strong>{admin}</strong>. Reason: {reason}</p></div>',"
        "'[\"count\",\"admin\",\"reason\"]',1,0),"

        "('email_admin_failed_login_alert','email','admin_failed_login','Admin: Failed Login Alert','Security Alert: Failed Login Attempt',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">\U0001f510 Failed Login Attempt</h2><p>A failed login attempt was detected for username <strong>{username}</strong> from IP <strong>{ip}</strong> at {time}.</p></div>',"
        "'[\"username\",\"ip\",\"time\"]',1,0),"

        "('email_admin_daily_summary','email','admin_daily_summary','Admin: Daily Summary','Daily Summary Report',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Daily Summary — {date}</h2><ul><li>New guests: {new_guests}</li><li>Approved: {approved}</li><li>Rejected: {rejected}</li><li>Active employees: {active_employees}</li></ul></div>',"
        "'[\"date\",\"new_guests\",\"approved\",\"rejected\",\"active_employees\"]',1,0),"

        "('email_admin_weekly_summary','email','admin_weekly_summary','Admin: Weekly Summary','Weekly Summary Report',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Weekly Summary — {week}</h2><ul><li>Total connections: {connections}</li><li>Total guests: {guests}</li><li>Data used: {data_gb} GB</li></ul></div>',"
        "'[\"week\",\"connections\",\"guests\",\"data_gb\"]',1,0),"

        "('email_admin_2fa_enabled','email','admin_2fa_enabled','Admin: 2FA Enabled','Two-Factor Authentication Enabled on Your Account',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">2FA Enabled</h2><p>Two-factor authentication has been enabled on your admin account. If you did not do this, contact your administrator immediately.</p></div>',"
        "'[]',1,0),"

        "('email_admin_2fa_disabled','email','admin_2fa_disabled','Admin: 2FA Disabled','Two-Factor Authentication Disabled',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">⚠️ 2FA Disabled</h2><p>Two-factor authentication has been disabled on your admin account. If this was not you, please secure your account immediately.</p></div>',"
        "'[]',1,0),"

        "('email_admin_password_changed','email','admin_password_changed','Admin: Password Changed','Your Admin Password Was Changed',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">Password Changed</h2><p>Your HotspotMgr admin password was changed from IP <strong>{ip}</strong>. If this was not you, contact your system administrator.</p></div>',"
        "'[\"ip\",\"time\"]',1,0),"

        "('email_new_admin_account','email','new_admin_account','New Admin Account Created','Your HotspotMgr Admin Account',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Admin Account Created</h2><p>An admin account has been created for you on HotspotMgr.</p><p>Username: <strong>{username}</strong><br>Temporary password: <strong style=\"font-family:monospace\">{password}</strong></p></div>',"
        "'[\"username\",\"password\"]',1,0),"

        "('email_voucher_batch_created','email','voucher_batch_created','Voucher Batch Created','New Vouchers Generated',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Vouchers Created</h2><p><strong>{count}</strong> WiFi vouchers were generated by <strong>{admin}</strong>. They expire on {expires}.</p></div>',"
        "'[\"count\",\"admin\",\"expires\"]',1,0),"

        "('email_voucher_near_expiry','email','voucher_near_expiry','Vouchers Expiring Soon','Some WiFi Vouchers Expire Soon',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">Vouchers Expiring</h2><p><strong>{count}</strong> active vouchers expire within 24 hours.</p></div>',"
        "'[\"count\"]',1,0),"

        "('email_mikrotik_offline_alert','email','mikrotik_offline','MikroTik Offline Alert','[ALERT] MikroTik Router Offline',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">\U0001f534 Router Offline</h2><p>The MikroTik router at <strong>{host}</strong> is unreachable as of {time}. Please investigate.</p></div>',"
        "'[\"host\",\"time\"]',1,0),"

        "('email_mikrotik_reconnected','email','mikrotik_reconnected','MikroTik Reconnected','MikroTik Router is Back Online',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">\U0001f7e2 Router Online</h2><p>The MikroTik router at <strong>{host}</strong> has reconnected at {time}. Downtime: {downtime_minutes} minutes.</p></div>',"
        "'[\"host\",\"time\",\"downtime_minutes\"]',1,0),"

        "('email_system_cpu_alert','email','system_cpu_high','System CPU Alert','[ALERT] Server CPU Usage High',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">CPU Alert</h2><p>Server CPU usage reached <strong>{percent}%</strong> at {time}.</p></div>',"
        "'[\"percent\",\"time\"]',1,0),"

        "('email_system_ram_alert','email','system_ram_high','System RAM Alert','[ALERT] Server Memory Usage High',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">RAM Alert</h2><p>Server memory usage reached <strong>{percent}%</strong> at {time}.</p></div>',"
        "'[\"percent\",\"time\"]',1,0),"

        "('email_system_disk_alert','email','system_disk_high','System Disk Alert','[ALERT] Disk Space Low',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Disk Alert</h2><p>Server disk usage is at <strong>{percent}%</strong>. Free space: {free_gb} GB.</p></div>',"
        "'[\"percent\",\"free_gb\"]',1,0),"

        "('email_export_ready','email','export_ready','Export Ready','Your Data Export is Ready',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Export Ready</h2><p>Your requested data export (<strong>{export_type}</strong>) is ready for download. It expires in 1 hour.</p></div>',"
        "'[\"export_type\"]',1,0),"

        "('email_monthly_usage_report','email','monthly_report','Monthly Usage Report','Monthly WiFi Usage Report — {month}',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Monthly Report — {month}</h2><ul><li>Total data: {total_gb} GB</li><li>Peak users: {peak_users}</li><li>New guests: {new_guests}</li><li>Vouchers used: {vouchers_used}</li></ul></div>',"
        "'[\"month\",\"total_gb\",\"peak_users\",\"new_guests\",\"vouchers_used\"]',1,0),"

        "('email_security_weekly_report','email','security_weekly','Security Weekly Report','Weekly Security Report',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Security Summary</h2><ul><li>Failed logins: {failed_logins}</li><li>Blacklisted: {blacklisted}</li><li>Rejected guests: {rejected}</li></ul></div>',"
        "'[\"failed_logins\",\"blacklisted\",\"rejected\"]',1,0),"

        "('email_account_locked','email','account_locked','Account Locked','Your Account Has Been Locked',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#ef4444\">Account Locked</h2><p>Your account has been locked after multiple failed login attempts. Contact your administrator to unlock it.</p></div>',"
        "'[]',1,0),"

        "('email_account_unlocked','email','account_unlocked','Account Unlocked','Your Account Has Been Unlocked',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#10b981\">Account Unlocked</h2><p>Your admin account has been unlocked and is now accessible.</p></div>',"
        "'[]',1,0),"

        "('email_portal_maintenance','email','portal_maintenance','Portal Maintenance Notice','WiFi Portal Maintenance Scheduled',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#f59e0b\">Scheduled Maintenance</h2><p>The WiFi access portal will be unavailable on <strong>{date}</strong> from <strong>{start_time}</strong> to <strong>{end_time}</strong> for maintenance.</p></div>',"
        "'[\"date\",\"start_time\",\"end_time\"]',1,0),"

        "('email_bandwidth_changed','email','bandwidth_changed','Bandwidth Profile Changed','Your WiFi Bandwidth Profile Has Been Updated',"
        "'<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px\"><h2 style=\"color:#4e73df\">Bandwidth Updated</h2><p>Hi <strong>{name}</strong>, your WiFi bandwidth profile has been changed to <strong>{profile_name}</strong> (Download: {rx}, Upload: {tx}).</p></div>',"
        "'[\"name\",\"profile_name\",\"rx\",\"tx\"]',1,0),"

        # ── SMS (35) ────────────────────────────────────────────────────────────
        "('sms_otp_code','sms','otp_verification','OTP Verification Code',NULL,"
        "'Your WiFi code: {otp}. Valid {minutes} min. Do not share.',"
        "'[\"otp\",\"minutes\"]',1,1),"

        "('sms_otp_reminder','sms','otp_reminder','OTP Reminder',NULL,"
        "'Reminder: Your WiFi code is {otp}. Expires in {minutes} min.',"
        "'[\"otp\",\"minutes\"]',1,0),"

        "('sms_guest_approved','sms','guest_approved','Guest Approved',NULL,"
        "'Hi {name}, your WiFi access is approved for {hours}h. Connect now!',"
        "'[\"name\",\"hours\"]',1,1),"

        "('sms_guest_rejected','sms','guest_rejected','Guest Rejected',NULL,"
        "'Hi {name}, your WiFi request was declined. Reason: {reason}.',"
        "'[\"name\",\"reason\"]',1,0),"

        "('sms_guest_auto_approved','sms','guest_auto_approved','Guest Auto-Approved',NULL,"
        "'Hi {name}, your WiFi access is auto-approved ({hours}h). Connect now!',"
        "'[\"name\",\"hours\"]',1,0),"

        "('sms_session_expiring_30min','sms','session_expiring_30min','Session Expiring 30min',NULL,"
        "'Your WiFi session expires in 30 minutes. Save your work.',"
        "'[]',1,0),"

        "('sms_session_expiring_5min','sms','session_expiring_5min','Session Expiring 5min',NULL,"
        "'Your WiFi session expires in 5 minutes!',"
        "'[]',1,0),"

        "('sms_session_expired','sms','session_expired','Session Expired',NULL,"
        "'Your WiFi session has ended. Register again for continued access.',"
        "'[]',1,0),"

        "('sms_guest_session_started','sms','guest_session_started','Guest Session Started',NULL,"
        "'Hi {name}, you are now connected to WiFi. Session valid for {hours}h.',"
        "'[\"name\",\"hours\"]',1,0),"

        "('sms_employee_welcome','sms','employee_welcome','Employee Welcome',NULL,"
        "'Welcome {name}! WiFi user: {hotspot_username} pass: {hotspot_password}. Change after first login.',"
        "'[\"name\",\"hotspot_username\",\"hotspot_password\"]',1,0),"

        "('sms_employee_password_reset','sms','employee_password_reset','Employee Password Reset',NULL,"
        "'Hi {name}, your WiFi password was reset to: {new_password}. Change it immediately.',"
        "'[\"name\",\"new_password\"]',1,0),"

        "('sms_employee_suspended','sms','employee_suspended','Employee Suspended',NULL,"
        "'Hi {name}, your WiFi account has been suspended. Contact IT support.',"
        "'[\"name\"]',1,0),"

        "('sms_employee_reactivated','sms','employee_reactivated','Employee Reactivated',NULL,"
        "'Hi {name}, your WiFi account has been reactivated. You can now connect.',"
        "'[\"name\"]',1,0),"

        "('sms_employee_quota_80','sms','employee_quota_warning_80','Quota 80% Warning',NULL,"
        "'WiFi quota warning: {name} used 80% ({used_mb}/{quota_mb} MB).',"
        "'[\"name\",\"used_mb\",\"quota_mb\"]',1,0),"

        "('sms_employee_quota_90','sms','employee_quota_warning_90','Quota 90% Warning',NULL,"
        "'WiFi quota critical: {name} at 90%. Disconnect imminent.',"
        "'[\"name\"]',1,0),"

        "('sms_employee_quota_exceeded','sms','employee_quota_exceeded','Quota Exceeded',NULL,"
        "'Hi {name}, your daily WiFi quota ({quota_mb}MB) exceeded. Reconnect tomorrow.',"
        "'[\"name\",\"quota_mb\"]',1,0),"

        "('sms_employee_quota_reset','sms','employee_quota_reset','Quota Reset',NULL,"
        "'Hi {name}, your WiFi quota has been reset. {quota_mb}MB available.',"
        "'[\"name\",\"quota_mb\"]',1,0),"

        "('sms_employee_login_success','sms','employee_login_success','Employee Login',NULL,"
        "'WiFi login: {name} connected from {ip} at {time}.',"
        "'[\"name\",\"ip\",\"time\"]',1,0),"

        "('sms_admin_new_guest_alert','sms','admin_new_guest_waiting','Admin: New Guest Alert',NULL,"
        "'New guest waiting: {guest_name} ({guest_email}). Approve in admin panel.',"
        "'[\"guest_name\",\"guest_email\"]',1,0),"

        "('sms_admin_security_alert','sms','admin_failed_login','Admin: Security Alert',NULL,"
        "'Security alert: Failed login for {username} from {ip} at {time}.',"
        "'[\"username\",\"ip\",\"time\"]',1,0),"

        "('sms_admin_mikrotik_down','sms','mikrotik_offline','Admin: MikroTik Down',NULL,"
        "'ALERT: MikroTik router {host} is offline since {time}.',"
        "'[\"host\",\"time\"]',1,0),"

        "('sms_system_alert_critical','sms','system_critical','System Critical Alert',NULL,"
        "'CRITICAL: Server {metric} at {percent}%. Immediate attention required.',"
        "'[\"metric\",\"percent\"]',1,0),"

        "('sms_bulk_action_complete','sms','bulk_action_complete','Bulk Action Complete',NULL,"
        "'Bulk {action} complete: {count} guests processed by {admin}.',"
        "'[\"action\",\"count\",\"admin\"]',1,0),"

        "('sms_voucher_code_share','sms','voucher_share','Voucher Code Share',NULL,"
        "'Your WiFi voucher code: {code}. Valid for {hours}h. Expires: {expires}.',"
        "'[\"code\",\"hours\",\"expires\"]',1,0),"

        "('sms_voucher_used_confirm','sms','voucher_used','Voucher Used Confirmation',NULL,"
        "'Voucher {code} redeemed by {name}. {remaining} uses remaining.',"
        "'[\"code\",\"name\",\"remaining\"]',1,0),"

        "('sms_voucher_expiring','sms','voucher_expiring','Voucher Expiring',NULL,"
        "'WiFi voucher {code} expires in 24h. Uses remaining: {remaining}.',"
        "'[\"code\",\"remaining\"]',1,0),"

        "('sms_export_ready','sms','export_ready','Export Ready',NULL,"
        "'Your {export_type} export is ready. Download from admin panel within 1h.',"
        "'[\"export_type\"]',1,0),"

        "('sms_password_changed','sms','password_changed','Password Changed',NULL,"
        "'Your admin password was changed from {ip}. Not you? Contact support.',"
        "'[\"ip\"]',1,0),"

        "('sms_2fa_enabled','sms','2fa_enabled','2FA Enabled',NULL,"
        "'Two-factor authentication enabled on your HotspotMgr account.',"
        "'[]',1,0),"

        "('sms_2fa_backup_code_used','sms','2fa_backup_used','2FA Backup Code Used',NULL,"
        "'A backup code was used to log in from {ip}. If not you, secure your account.',"
        "'[\"ip\"]',1,0),"

        "('sms_new_policy_applied','sms','policy_applied','New Policy Applied',NULL,"
        "'Network policy \"{policy_name}\" applied to your account.',"
        "'[\"policy_name\"]',1,0),"

        "('sms_asset_blocked','sms','asset_blocked','Asset Blocked',NULL,"
        "'Device {mac} ({name}) has been blocked from the network. Reason: {reason}.',"
        "'[\"mac\",\"name\",\"reason\"]',1,0),"

        "('sms_portal_maintenance','sms','portal_maintenance','Portal Maintenance',NULL,"
        "'WiFi portal maintenance on {date} {start_time}-{end_time}. Plan accordingly.',"
        "'[\"date\",\"start_time\",\"end_time\"]',1,0),"

        "('sms_monthly_report_ready','sms','monthly_report','Monthly Report Ready',NULL,"
        "'Monthly WiFi report for {month} is ready. Check admin panel.',"
        "'[\"month\"]',1,0),"

        "('sms_test','sms','test','Test SMS',NULL,"
        "'Test SMS from HotspotMgr. If you received this, SMS is working!',"
        "'[]',1,0),"

        # ── TELEGRAM (35) ───────────────────────────────────────────────────────
        "('tg_guest_register','telegram','guest_register','Guest Registered',NULL,"
        "'\U0001f514 <b>New Guest Registration</b>\n<b>{name}</b> ({email}) is waiting for OTP verification.\n\U0001f4f1 Mobile: {mobile}',"
        "'[\"name\",\"email\",\"mobile\"]',1,1),"

        "('tg_guest_otp_sent','telegram','guest_otp_sent','Guest OTP Sent',NULL,"
        "'\U0001f4e8 <b>OTP Sent</b>\nCode sent to {target} for guest <b>{name}</b>.',"
        "'[\"name\",\"target\"]',1,0),"

        "('tg_guest_otp_verified','telegram','guest_otp_verified','Guest OTP Verified',NULL,"
        "'✅ <b>OTP Verified</b>\n<b>{name}</b> ({email}) has verified their identity and is in the approval queue.',"
        "'[\"name\",\"email\"]',1,0),"

        "('tg_guest_approved','telegram','guest_approved','Guest Approved',NULL,"
        "'✅ <b>Guest Approved</b>\n<b>{name}</b> ({email}) has been approved by <b>{admin}</b>.\nSession: {hours}h',"
        "'[\"name\",\"email\",\"admin\",\"hours\"]',1,1),"

        "('tg_guest_approved_with_note','telegram','guest_approved_note','Guest Approved With Note',NULL,"
        "'✅ <b>Guest Approved</b>\n<b>{name}</b> approved with note: {note}',"
        "'[\"name\",\"note\",\"admin\"]',1,0),"

        "('tg_guest_rejected','telegram','guest_rejected','Guest Rejected',NULL,"
        "'❌ <b>Guest Rejected</b>\n<b>{name}</b> ({email}) was rejected by <b>{admin}</b>.\nReason: {reason}',"
        "'[\"name\",\"email\",\"admin\",\"reason\"]',1,1),"

        "('tg_guest_auto_approved','telegram','guest_auto_approved','Guest Auto-Approved',NULL,"
        "'\U0001f916 <b>Auto-Approved</b>\n<b>{name}</b> ({email}) was automatically approved (trusted domain).\nSession: {hours}h',"
        "'[\"name\",\"email\",\"hours\"]',1,0),"

        "('tg_guest_session_started','telegram','guest_session_started','Guest Session Started',NULL,"
        "'\U0001f4f6 <b>Guest Connected</b>\n<b>{name}</b> is now connected. IP: {ip}',"
        "'[\"name\",\"ip\"]',1,0),"

        "('tg_guest_session_expired','telegram','guest_session_expired','Guest Session Expired',NULL,"
        "'⏰ <b>Session Expired</b>\nGuest <b>{name}</b> session has ended after {hours}h.',"
        "'[\"name\",\"hours\"]',1,0),"

        "('tg_guest_session_terminated','telegram','guest_session_terminated','Guest Session Terminated',NULL,"
        "'\U0001f50c <b>Session Terminated</b>\n<b>{name}</b> disconnected by admin <b>{admin}</b>.',"
        "'[\"name\",\"admin\"]',1,0),"

        "('tg_employee_created','telegram','employee_created','Employee Created',NULL,"
        "'\U0001f464 <b>New Employee Added</b>\n<b>{name}</b> ({email}) added by <b>{admin}</b>.\nDepartment: {department}',"
        "'[\"name\",\"email\",\"admin\",\"department\"]',1,1),"

        "('tg_employee_suspended','telegram','employee_suspended','Employee Suspended',NULL,"
        "'⛔ <b>Employee Suspended</b>\n<b>{name}</b> suspended by <b>{admin}</b>.\nReason: {reason}',"
        "'[\"name\",\"admin\",\"reason\"]',1,0),"

        "('tg_employee_activated','telegram','employee_activated','Employee Activated',NULL,"
        "'✅ <b>Employee Reactivated</b>\n<b>{name}</b> reactivated by <b>{admin}</b>.',"
        "'[\"name\",\"admin\"]',1,0),"

        "('tg_employee_deleted','telegram','employee_deleted','Employee Deleted',NULL,"
        "'\U0001f5d1️ <b>Employee Removed</b>\n<b>{name}</b> ({email}) deleted by <b>{admin}</b>.',"
        "'[\"name\",\"email\",\"admin\"]',1,0),"

        "('tg_employee_quota_exceeded','telegram','employee_quota_exceeded','Employee Quota Exceeded',NULL,"
        "'\U0001f4ca <b>Quota Exceeded</b>\n<b>{name}</b> used {quota_mb}MB daily quota. Session terminated.',"
        "'[\"name\",\"quota_mb\"]',1,0),"

        "('tg_employee_quota_warning','telegram','employee_quota_warning','Employee Quota Warning',NULL,"
        "'⚠️ <b>Quota Warning</b>\n<b>{name}</b> at {percent}% of daily quota ({used_mb}/{quota_mb}MB).',"
        "'[\"name\",\"percent\",\"used_mb\",\"quota_mb\"]',1,0),"

        "('tg_hotspot_login','telegram','hotspot_login','Hotspot Login',NULL,"
        "'\U0001f4f6 <b>Hotspot Login</b>\n<b>{username}</b> ({user_type}) connected from {ip}.',"
        "'[\"username\",\"user_type\",\"ip\"]',1,1),"

        "('tg_hotspot_logout','telegram','hotspot_logout','Hotspot Logout',NULL,"
        "'\U0001f50c <b>Hotspot Logout</b>\n<b>{username}</b> disconnected. Uptime: {uptime}.',"
        "'[\"username\",\"uptime\"]',1,0),"

        "('tg_voucher_used','telegram','voucher_used','Voucher Used',NULL,"
        "'\U0001f3ab <b>Voucher Redeemed</b>\nCode <code>{code}</code> used by <b>{name}</b>. {remaining} uses left.',"
        "'[\"code\",\"name\",\"remaining\"]',1,0),"

        "('tg_voucher_expired','telegram','voucher_expired','Voucher Expired',NULL,"
        "'⏰ <b>Voucher Expired</b>\nCode <code>{code}</code> expired. {used_count}/{max_uses} uses were made.',"
        "'[\"code\",\"used_count\",\"max_uses\"]',1,0),"

        "('tg_admin_login','telegram','admin_login','Admin Login',NULL,"
        "'\U0001f510 <b>Admin Login</b>\n<b>{username}</b> logged in from {ip} at {time}.',"
        "'[\"username\",\"ip\",\"time\"]',1,0),"

        "('tg_admin_failed_login','telegram','admin_failed_login','Admin Failed Login',NULL,"
        "'\U0001f6a8 <b>Failed Login</b>\nFailed attempt for <b>{username}</b> from {ip} at {time}.',"
        "'[\"username\",\"ip\",\"time\"]',1,0),"

        "('tg_bulk_approve','telegram','bulk_approve','Bulk Approval Done',NULL,"
        "'✅ <b>Bulk Approval</b>\n<b>{admin}</b> approved <b>{count}</b> guests.',"
        "'[\"admin\",\"count\"]',1,0),"

        "('tg_bulk_reject','telegram','bulk_reject','Bulk Rejection Done',NULL,"
        "'❌ <b>Bulk Rejection</b>\n<b>{admin}</b> rejected <b>{count}</b> guests. Reason: {reason}',"
        "'[\"admin\",\"count\",\"reason\"]',1,0),"

        "('tg_asset_blocked','telegram','asset_blocked','Asset Blocked',NULL,"
        "'\U0001f6ab <b>Asset Blocked</b>\n{name} ({mac}) blocked by <b>{admin}</b>.\nReason: {reason}',"
        "'[\"name\",\"mac\",\"admin\",\"reason\"]',1,0),"

        "('tg_asset_unblocked','telegram','asset_unblocked','Asset Unblocked',NULL,"
        "'✅ <b>Asset Unblocked</b>\n{name} ({mac}) unblocked by <b>{admin}</b>.',"
        "'[\"name\",\"mac\",\"admin\"]',1,0),"

        "('tg_policy_synced','telegram','policy_synced','Policy Synced',NULL,"
        "'\U0001f504 <b>Policy Synced</b>\nPolicy <b>{policy_name}</b> pushed to MikroTik by <b>{admin}</b>.',"
        "'[\"policy_name\",\"admin\"]',1,0),"

        "('tg_mikrotik_disconnected','telegram','mikrotik_offline','MikroTik Disconnected',NULL,"
        "'\U0001f534 <b>Router Offline</b>\nMikroTik at {host} is unreachable since {time}.',"
        "'[\"host\",\"time\"]',1,0),"

        "('tg_mikrotik_reconnected','telegram','mikrotik_reconnected','MikroTik Reconnected',NULL,"
        "'\U0001f7e2 <b>Router Online</b>\nMikroTik at {host} reconnected. Downtime: {downtime_minutes} min.',"
        "'[\"host\",\"time\",\"downtime_minutes\"]',1,0),"

        "('tg_system_cpu_high','telegram','system_cpu_high','System CPU High',NULL,"
        "'⚠️ <b>CPU Alert</b>\nServer CPU: <b>{percent}%</b> at {time}.',"
        "'[\"percent\",\"time\"]',1,0),"

        "('tg_system_ram_high','telegram','system_ram_high','System RAM High',NULL,"
        "'⚠️ <b>RAM Alert</b>\nServer RAM: <b>{percent}%</b> at {time}.',"
        "'[\"percent\",\"time\"]',1,0),"

        "('tg_system_disk_high','telegram','system_disk_high','System Disk High',NULL,"
        "'⚠️ <b>Disk Alert</b>\nDisk usage: <b>{percent}%</b>. Free: {free_gb}GB.',"
        "'[\"percent\",\"free_gb\"]',1,0),"

        "('tg_export_ready','telegram','export_ready','Export Ready',NULL,"
        "'\U0001f4e5 <b>Export Ready</b>\n{export_type} export generated by <b>{admin}</b>. Download from admin panel.',"
        "'[\"export_type\",\"admin\"]',1,0),"

        "('tg_daily_summary','telegram','daily_summary','Daily Summary',NULL,"
        "'\U0001f4ca <b>Daily Summary — {date}</b>\nGuests: {new_guests} new, {approved} approved\nConnections: {connections}\nData: {data_gb}GB',"
        "'[\"date\",\"new_guests\",\"approved\",\"connections\",\"data_gb\"]',1,0),"

        "('tg_weekly_summary','telegram','weekly_summary','Weekly Summary',NULL,"
        "'\U0001f4c8 <b>Weekly Summary — {week}</b>\nTotal guests: {guests}\nTotal data: {data_gb}GB\nPeak users: {peak_users}',"
        "'[\"week\",\"guests\",\"data_gb\",\"peak_users\"]',1,0)"
    )


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_table("notifications")
    op.drop_table("notification_templates")
