"""Per-type log retention settings

Revision ID: 0003_log_retention
Revises: 0002_sms_bd_settings
Create Date: 2026-06-02
"""
from alembic import op

revision = "0003_log_retention"
down_revision = "0002_sms_bd_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
        ('system', 'browsing_log_retention_days', '30', FALSE, 'Days to keep browsing/DNS log records'),
        ('system', 'connection_history_retention_days', '90', FALSE, 'Days to keep disconnected connection records'),
        ('system', 'audit_log_retention_days', '365', FALSE, 'Days to keep audit log entries'),
        ('system', 'otp_log_retention_days', '7', FALSE, 'Days to keep OTP log entries')
    """)


def downgrade():
    pass
