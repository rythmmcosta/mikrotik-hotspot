"""TOTP two-factor authentication columns

Revision ID: 0007_totp
Revises: 0006_employee_quotas
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_totp"
down_revision = "0006_employee_quotas"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("totp_secret", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("totp_backup_codes", sa.String(512), nullable=True))


def downgrade():
    for col in ["totp_secret", "totp_enabled", "totp_backup_codes"]:
        op.drop_column("users", col)
