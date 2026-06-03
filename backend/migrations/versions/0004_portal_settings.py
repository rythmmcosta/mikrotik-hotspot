"""Portal branding and auto-approval settings

Revision ID: 0004_portal_settings
Revises: 0003_log_retention
Create Date: 2026-06-02
"""
from alembic import op

revision = "0004_portal_settings"
down_revision = "0003_log_retention"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
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
        ('portal', 'enable_voucher', 'true', FALSE, 'Show voucher code input on guest form')
    """)


def downgrade():
    pass
