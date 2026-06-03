"""departments, guest_blacklist, admin_sessions tables + new settings

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("bandwidth_profile_id", sa.Integer, sa.ForeignKey("bandwidth_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.add_column("employees", sa.Column("department_id", sa.Integer, sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True))

    op.create_table(
        "guest_blacklist",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("type", sa.Enum("email", "mobile", "ip", name="blacklist_type"), nullable=False),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("added_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("type", "value", name="uq_blacklist_type_val"),
    )

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("success", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_admin_sessions_user", "admin_sessions", ["user_id"])

    # New settings
    op.execute(
        "INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, description) VALUES "
        "('security', 'allowed_ips', '', FALSE, 'Comma-separated IPs allowed to access admin (empty=all)'),"
        "('security', 'session_timeout_minutes', '480', FALSE, 'Admin JWT session timeout in minutes'),"
        "('security', 'max_failed_logins', '5', FALSE, 'Max failed logins before lockout'),"
        "('security', 'lockout_duration_minutes', '30', FALSE, 'Account lockout duration in minutes'),"
        "('security', 'min_password_length', '8', FALSE, 'Minimum admin password length'),"
        "('security', 'require_special_chars', 'false', FALSE, 'Require special characters in passwords'),"
        "('portal', 'maintenance_mode', 'false', FALSE, 'Put portal in maintenance mode'),"
        "('portal', 'maintenance_message', 'The portal is temporarily unavailable for maintenance.', FALSE, 'Maintenance mode message'),"
        "('portal', 'announcement_text', '', FALSE, 'Announcement banner text (empty=hidden)'),"
        "('portal', 'announcement_color', '#f59e0b', FALSE, 'Announcement banner background color'),"
        "('push', 'enabled', 'false', FALSE, 'Enable browser push notifications'),"
        "('push', 'vapid_public_key', '', FALSE, 'VAPID public key for Web Push'),"
        "('push', 'vapid_private_key', '', TRUE, 'VAPID private key for Web Push (encrypted)'),"
        "('push', 'vapid_email', '', FALSE, 'VAPID contact email (mailto:...)'),"
        "('system', 'weekly_report_enabled', 'false', FALSE, 'Send weekly summary report via email'),"
        "('system', 'weekly_report_day', '1', FALSE, 'Day of week for weekly report (1=Monday)')"
    )

    # Seed default departments
    op.execute(
        "INSERT IGNORE INTO departments (name) VALUES "
        "('IT Department'),('Management'),('Sales'),('Human Resources'),('Guest Access')"
    )


def downgrade() -> None:
    op.drop_index("idx_admin_sessions_user", "admin_sessions")
    op.drop_table("admin_sessions")
    op.drop_table("guest_blacklist")
    op.execute("ALTER TABLE employees DROP COLUMN department_id")
    op.drop_table("departments")
