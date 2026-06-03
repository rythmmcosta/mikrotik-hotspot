"""Vouchers table

Revision ID: 0008_vouchers
Revises: 0007_totp
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_vouchers"
down_revision = "0007_totp"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "vouchers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("max_uses", sa.Integer, nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("bandwidth_profile_id", sa.Integer, sa.ForeignKey("bandwidth_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_hours", sa.Integer, nullable=False, server_default="4"),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_vouchers_code", "vouchers", ["code"], unique=True)


def downgrade():
    op.drop_table("vouchers")
