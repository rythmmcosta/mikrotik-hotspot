"""Notification message templates

Revision ID: 0005_notification_templates
Revises: 0004_portal_settings
Create Date: 2026-06-02
"""
from alembic import op

revision = "0005_notification_templates"
down_revision = "0004_portal_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
        ('notifications', 'telegram_guest_register', '🔔 <b>New Guest Registration</b>\n{name} ({email}) is waiting for OTP verification.', FALSE, 'Telegram message when guest registers. Variables: {name} {email} {mobile}'),
        ('notifications', 'telegram_guest_approved', '✅ <b>Guest Approved</b>\n{name} ({email}) has been approved.', FALSE, 'Telegram message when guest is approved. Variables: {name} {email}'),
        ('notifications', 'telegram_guest_rejected', '❌ <b>Guest Rejected</b>\n{name} ({email}) was rejected.{reason}', FALSE, 'Telegram message when guest is rejected. Variables: {name} {email} {reason}'),
        ('notifications', 'telegram_employee_created', '👤 <b>New Employee Added</b>\n{name} ({email}) added by {admin}.', FALSE, 'Telegram message when employee is created. Variables: {name} {email} {admin}'),
        ('notifications', 'telegram_hotspot_login', '📶 <b>Hotspot Login</b>\n{username} ({user_type}) connected from {ip}.', FALSE, 'Telegram message on hotspot login. Variables: {username} {user_type} {ip}'),
        ('notifications', 'email_otp_subject', 'Your WiFi Access Code', FALSE, 'Subject line for OTP email'),
        ('notifications', 'email_otp_body', '<p>Your WiFi verification code is: <b style="font-size:24px">{otp}</b></p><p>This code expires in <b>{minutes} minutes</b>.</p><p>Do not share this code with anyone.</p>', FALSE, 'HTML body for OTP email. Variables: {otp} {minutes}'),
        ('notifications', 'sms_otp', 'Your WiFi access code: {otp}. Valid for {minutes} min. Do not share.', FALSE, 'SMS text for OTP. Variables: {otp} {minutes}')
    """)


def downgrade():
    pass
