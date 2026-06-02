"""Add profile fields to users table

Revision ID: 0001_user_profile_fields
Revises:
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_user_profile_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(512), nullable=True))
    op.add_column("users", sa.Column("mobile", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("telegram_chat_id", sa.String(64), nullable=True))

    # Insert telegram settings (idempotent — ignore duplicates)
    op.execute("""
        INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES
        ('telegram', 'enabled', 'false', 0, 'Enable Telegram notifications'),
        ('telegram', 'bot_token', '', 1, 'Telegram Bot API Token (from @BotFather)'),
        ('telegram', 'default_chat_id', '', 0, 'Default channel or group chat ID for system alerts'),
        ('telegram', 'notify_guest_register', 'true', 0, 'Alert admins on new guest registration'),
        ('telegram', 'notify_guest_approved', 'true', 0, 'Alert admins when a guest is approved'),
        ('telegram', 'notify_employee_created', 'false', 0, 'Alert admins when a new employee is added')
    """)


def downgrade() -> None:
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("users", "mobile")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "full_name")
