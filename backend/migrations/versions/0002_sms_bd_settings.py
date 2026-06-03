"""BD SMS gateway settings

Revision ID: 0002_sms_bd_settings
Revises: 0001_user_profile_fields
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_sms_bd_settings"
down_revision = "0001_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
        ('sms', 'ssl_wireless_api_token', '', TRUE, 'SSL Wireless API Token'),
        ('sms', 'ssl_wireless_sender_id', 'HotspotMgr', FALSE, 'SSL Wireless Sender ID (alphanumeric, max 11 chars)'),
        ('sms', 'bulksmsbd_api_key', '', TRUE, 'BulkSMS BD API Key'),
        ('sms', 'bulksmsbd_sender_id', 'HotspotMgr', FALSE, 'BulkSMS BD Sender ID'),
        ('sms', 'custom_http_url', '', FALSE, 'Custom HTTP gateway URL with {number} and {message} placeholders'),
        ('sms', 'custom_http_method', 'GET', FALSE, 'HTTP method for custom gateway: GET or POST'),
        ('sms', 'custom_http_auth_header', '', TRUE, 'Auth header for custom gateway: Header-Name: value')
    """)
    op.execute("UPDATE settings SET value='ssl_wireless' WHERE category='sms' AND key_name='provider'")


def downgrade():
    pass
