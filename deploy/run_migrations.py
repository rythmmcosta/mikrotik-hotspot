"""
Standalone migration + seed runner for production.
Run from the backend/ directory:
  python3 ../deploy/run_migrations.py
"""
import asyncio
import importlib.util
import os
import pathlib
import sys

# Must be run from backend/
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "backend"))

DB_URL = os.environ.get(
    "DATABASE_URL",
    f"mysql+asyncmy://{os.environ.get('DB_USER')}:{os.environ.get('DB_PASS')}@127.0.0.1:3306/{os.environ.get('DB_NAME')}",
)
SYNC_URL = DB_URL.replace("mysql+asyncmy://", "mysql+pymysql://")


async def create_tables():
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.db.base import Base
    from app.db import models  # noqa

    engine = create_async_engine(DB_URL, echo=False, pool_pre_ping=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("[create_all] All tables created / verified")


def run_migration_data(migration_file: pathlib.Path):
    """Execute only the data-manipulation parts of an Alembic migration."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import NullPool
    from alembic.runtime.migration import MigrationContext
    import alembic.operations as _ops
    from unittest.mock import MagicMock

    spec = importlib.util.spec_from_file_location(migration_file.stem, migration_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    if not hasattr(mod, "upgrade"):
        return

    DDL_OPS = {
        "create_table", "drop_table", "add_column", "drop_column",
        "create_index", "drop_index", "alter_column", "create_foreign_key",
        "drop_constraint", "rename_table", "execute_if", "bulk_insert",
        "create_check_constraint", "drop_index",
    }

    engine = create_engine(SYNC_URL, poolclass=NullPool, echo=False)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        ops_obj = _ops.Operations(ctx)
        noop = MagicMock(return_value=None)
        for op_name in DDL_OPS:
            setattr(ops_obj, op_name, noop)

        # Monkeypatch alembic.op module so migration scripts calling op.create_table() etc. hit noop
        import alembic.op as alembic_op_mod
        originals = {}
        for op_name in DDL_OPS:
            if hasattr(alembic_op_mod, op_name):
                originals[op_name] = getattr(alembic_op_mod, op_name)
                setattr(alembic_op_mod, op_name, noop)

        try:
            mod.upgrade()
            conn.commit()
            print(f"[migration] {migration_file.stem} — data applied")
        except Exception as exc:
            msg = str(exc)
            if any(x in msg for x in ("Duplicate entry", "already exists", "1062", "1050")):
                print(f"[migration] {migration_file.stem} — already seeded (skipped)")
            else:
                print(f"[migration] {migration_file.stem} — warning: {msg[:120]}")
        finally:
            for op_name, orig in originals.items():
                setattr(alembic_op_mod, op_name, orig)

    engine.dispose()


def main():
    print("\n=== MikroTik Hotspot Manager — DB Setup ===\n")

    # Step 1: create tables
    asyncio.run(create_tables())

    # Step 2: run migrations (data only)
    versions_dir = pathlib.Path(__file__).parent.parent / "backend" / "migrations" / "versions"
    files = sorted(f for f in versions_dir.glob("*.py") if not f.name.startswith("__"))

    print(f"\nRunning {len(files)} migration files...")
    for f in files:
        run_migration_data(f)

    print("\n[done] Database setup complete")
    print("\nCredentials: admin / Admin@123  |  operator / Operator@123\n")


if __name__ == "__main__":
    main()
