"""Employee bandwidth quota columns

Revision ID: 0006_employee_quotas
Revises: 0005_notification_templates
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_employee_quotas"
down_revision = "0005_notification_templates"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("employees", sa.Column("quota_daily_mb", sa.Integer, nullable=True))
    op.add_column("employees", sa.Column("quota_weekly_mb", sa.Integer, nullable=True))
    op.add_column("employees", sa.Column("quota_monthly_mb", sa.Integer, nullable=True))
    op.add_column("employees", sa.Column("bytes_used_today", sa.Integer, nullable=False, server_default="0"))
    op.add_column("employees", sa.Column("bytes_used_week", sa.Integer, nullable=False, server_default="0"))
    op.add_column("employees", sa.Column("bytes_used_month", sa.Integer, nullable=False, server_default="0"))


def downgrade():
    for col in ["quota_daily_mb", "quota_weekly_mb", "quota_monthly_mb", "bytes_used_today", "bytes_used_week", "bytes_used_month"]:
        op.drop_column("employees", col)
