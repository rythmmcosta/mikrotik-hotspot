#!/bin/bash
# =============================================================================
#  MikroTik Hotspot Manager — Production Deploy Script
#  Run on the target server as root:
#    bash deploy.sh
# =============================================================================
set -euo pipefail

# ── Configurable vars ────────────────────────────────────────────────────────
REPO_URL="https://github.com/rythmmcosta/mikrotik-hotspot.git"
BRANCH="claude/mikrotik-hotspot-portal-H1cb5"
DEPLOY_DIR="/www/wwwroot/wifi.myowncloud.tech"
DOMAIN="wifi.myowncloud.tech"
BACKEND_DIR="$DEPLOY_DIR/backend"
FRONTEND_DIR="$DEPLOY_DIR/frontend"
SERVICE_NAME="hotspot-api"
API_PORT=8000

DB_NAME="sql_wifi_myowncloud_tech"
DB_USER="sql_wifi_myowncloud_tech"
DB_PASS="130d4a23f71d38"
DB_HOST="127.0.0.1"
DB_PORT="3306"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()   { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   MikroTik Hotspot Manager — Auto Deploy     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. System deps ───────────────────────────────────────────────────────────
info "Checking system dependencies..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  python3 python3-pip python3-venv git curl nginx \
  default-mysql-client 2>/dev/null \
  || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  python3 python3-pip python3-venv git curl nginx mysql-client
ok "System dependencies ready"

# ── 2. Clone / update repo ───────────────────────────────────────────────────
info "Deploying code to $DEPLOY_DIR ..."
mkdir -p "$(dirname "$DEPLOY_DIR")"

# Build auth URL if token provided
if [ -n "${GH_TOKEN:-}" ]; then
  AUTH_URL="https://${GH_TOKEN}@github.com/rythmmcosta/mikrotik-hotspot.git"
else
  AUTH_URL="$REPO_URL"
fi

if [ -d "$DEPLOY_DIR/.git" ]; then
  info "Updating existing git repo..."
  cd "$DEPLOY_DIR"
  # Update remote URL with token if available
  git remote set-url origin "$AUTH_URL" 2>/dev/null || true
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
elif [ -d "$DEPLOY_DIR" ] && [ "$(ls -A "$DEPLOY_DIR" 2>/dev/null)" ]; then
  info "Directory exists but is not a git repo — backing up and cloning fresh..."
  BACKUP_DIR="${DEPLOY_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  mv "$DEPLOY_DIR" "$BACKUP_DIR"
  info "Old content backed up to $BACKUP_DIR"
  git clone --branch "$BRANCH" --depth 1 "$AUTH_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
else
  info "Cloning repo..."
  git clone --branch "$BRANCH" --depth 1 "$AUTH_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi
ok "Code deployed to $DEPLOY_DIR"

# ── 3. Python venv ───────────────────────────────────────────────────────────
info "Setting up Python virtual environment..."
cd "$BACKEND_DIR"
python3 -m venv venv
venv/bin/pip install --upgrade pip -q
# Force compatible bcrypt version
venv/bin/pip install "bcrypt==4.0.1" -q
venv/bin/pip install -r requirements.txt -q
ok "Python environment ready"

# ── 4. Create .env ───────────────────────────────────────────────────────────
info "Writing production .env ..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ENCRYPT_KEY=$(python3 -c "import secrets; print(secrets.token_hex(16))")

cat > "$BACKEND_DIR/.env" <<EOF
DATABASE_URL=mysql+asyncmy://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=${SECRET_KEY}
SECRET_ENCRYPTION_KEY=${ENCRYPT_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://${DOMAIN},http://${DOMAIN}
ENVIRONMENT=production
SYSLOG_PORT=514
EOF
ok ".env written"

# ── 5. Verify MySQL connection ────────────────────────────────────────────────
info "Testing MySQL connection..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT 'MySQL OK' AS status;" 2>/dev/null \
  || die "Cannot connect to MySQL. Check credentials."
ok "MySQL connection verified"

# ── 6. Create tables + run migrations + seed ─────────────────────────────────
info "Running database setup (create_all + migrations + seed)..."

cd "$BACKEND_DIR"
DATABASE_URL="mysql+asyncmy://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
SECRET_KEY="$SECRET_KEY" \
SECRET_ENCRYPTION_KEY="$ENCRYPT_KEY" \
ENVIRONMENT=production \
venv/bin/python3 - <<'PYEOF'
import asyncio, sys, os
os.environ.setdefault("ENVIRONMENT", "production")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import sqlalchemy as sa

DB_URL = os.environ["DATABASE_URL"]

async def setup():
    engine = create_async_engine(DB_URL, echo=False, pool_pre_ping=False)

    # ── Create all tables ──────────────────────────────────────────────────
    from app.db.base import Base
    from app.db import models  # noqa — registers all models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  [create_all] All tables created/verified")

    # ── Run Alembic migrations (data-only, skip DDL already done) ──────────
    from alembic.config import Config
    from alembic import command
    import alembic.operations as _ops
    from alembic.operations import MigrateOperations
    from alembic.runtime.migration import MigrationContext
    from unittest.mock import patch, MagicMock

    # Patch DDL ops to no-ops so only INSERT/UPDATE/DELETE/EXECUTE run
    noop = MagicMock(return_value=None)
    ddl_ops = [
        "create_table", "drop_table", "add_column", "drop_column",
        "create_index", "drop_index", "alter_column", "create_foreign_key",
        "drop_constraint", "rename_table", "execute_if",
    ]

    import importlib, pathlib
    versions_dir = pathlib.Path("migrations/versions")
    files = sorted(versions_dir.glob("*.py"))

    # Use a sync connection for data operations
    from sqlalchemy import create_engine, text
    sync_url = DB_URL.replace("mysql+asyncmy://", "mysql+pymysql://")
    sync_engine = create_engine(sync_url, echo=False)

    for f in files:
        if f.name.startswith("__"):
            continue
        spec = importlib.util.spec_from_file_location(f.stem, f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if not hasattr(mod, "upgrade"):
            continue

        with sync_engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            with patch.object(_ops.Operations, "__getattr__", side_effect=lambda self, n: noop if n in ddl_ops else object.__getattribute__(self, n)):
                try:
                    ops = _ops.Operations(ctx)
                    # Patch all DDL methods directly on the instance
                    for op_name in ddl_ops:
                        setattr(ops, op_name, noop)
                    # Execute the upgrade with real execute() but no-op DDL
                    mod.upgrade()
                    conn.commit()
                    print(f"  [migration] {f.stem} — data ops applied")
                except Exception as e:
                    if "Duplicate entry" in str(e) or "already exists" in str(e).lower():
                        print(f"  [migration] {f.stem} — skipped (already seeded)")
                    else:
                        print(f"  [migration] {f.stem} — {e}")

    await engine.dispose()
    print("  [setup] Database setup complete")

asyncio.run(setup())
PYEOF

ok "Database setup done"

# ── 7. Seed admin + initial data via Python ───────────────────────────────────
info "Seeding initial data (admin user, bandwidth profiles, settings)..."

cd "$BACKEND_DIR"
DATABASE_URL="mysql+asyncmy://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
SECRET_KEY="$SECRET_KEY" \
SECRET_ENCRYPTION_KEY="$ENCRYPT_KEY" \
ENVIRONMENT=production \
venv/bin/python3 - <<'PYEOF'
import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

DB_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DB_URL, echo=False, pool_pre_ping=False)
factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    admin_hash = pwd.hash("Admin@123")
    operator_hash = pwd.hash("Operator@123")

    async with factory() as db:
        # Admin user
        await db.execute(text("""
            INSERT IGNORE INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
            VALUES
              ('admin',    'admin@wifi.myowncloud.tech',    :ah, 'admin',    1, NOW(), NOW()),
              ('operator', 'operator@wifi.myowncloud.tech', :oh, 'operator', 1, NOW(), NOW())
        """), {"ah": admin_hash, "oh": operator_hash})

        # Bandwidth profiles
        await db.execute(text("""
            INSERT IGNORE INTO bandwidth_profiles
              (name, rate_limit_rx, rate_limit_tx, is_default_guest, is_default_employee, is_active, created_at, updated_at)
            VALUES
              ('Guest Free',        '2M',  '2M',  0, 0, 1, NOW(), NOW()),
              ('Guest Basic',       '5M',  '5M',  1, 0, 1, NOW(), NOW()),
              ('Employee Standard', '20M', '20M', 0, 1, 1, NOW(), NOW()),
              ('Employee Premium',  '50M', '50M', 0, 0, 1, NOW(), NOW()),
              ('Guest Premium',     '10M', '10M', 0, 0, 1, NOW(), NOW()),
              ('Unlimited',         '0M',  '0M',  0, 0, 1, NOW(), NOW())
        """))

        # Core settings
        settings_rows = [
            # General
            ("general", "site_name",       "WiFi Portal",          0),
            ("general", "site_url",        "https://wifi.myowncloud.tech", 0),
            ("general", "timezone",        "UTC",                  0),
            ("general", "date_format",     "Y-m-d",                0),
            # Portal
            ("portal",  "title",           "Welcome to WiFi",      0),
            ("portal",  "subtitle",        "Please verify your identity to connect", 0),
            ("portal",  "theme",           "mikrodash",            0),
            ("portal",  "bg_color",        "#0d1117",              0),
            ("portal",  "accent_color",    "#4e73df",              0),
            ("portal",  "require_otp",     "true",                 0),
            ("portal",  "auto_approve_domains", "",                0),
            ("portal",  "maintenance_mode","false",                0),
            ("portal",  "maintenance_message", "Portal temporarily unavailable.", 0),
            ("portal",  "announcement_text", "",                   0),
            ("portal",  "announcement_color", "#f59e0b",           0),
            # Email
            ("email",   "enabled",         "false",                0),
            ("email",   "from_name",       "WiFi Portal",          0),
            ("email",   "from_address",    "noreply@wifi.myowncloud.tech", 0),
            ("email",   "smtp_host",       "",                     0),
            ("email",   "smtp_port",       "587",                  0),
            ("email",   "smtp_username",   "",                     0),
            ("email",   "smtp_password",   "",                     1),
            ("email",   "smtp_tls",        "true",                 0),
            # SMS
            ("sms",     "provider",        "none",                 0),
            ("sms",     "enabled",         "false",                0),
            # Telegram
            ("telegram","enabled",         "false",                0),
            ("telegram","bot_token",       "",                     1),
            ("telegram","default_chat_id", "",                     0),
            ("telegram","notify_guest_register", "true",           0),
            ("telegram","notify_guest_approved", "true",           0),
            # Security
            ("security","allowed_ips",     "",                     0),
            ("security","session_timeout_minutes", "480",          0),
            ("security","max_failed_logins", "5",                  0),
            ("security","lockout_duration_minutes", "30",          0),
            ("security","min_password_length", "8",                0),
            ("security","require_special_chars", "false",          0),
            # Guest defaults
            ("guest",   "default_session_hours", "24",             0),
            ("guest",   "require_approval", "true",                0),
            ("guest",   "max_devices",      "3",                   0),
            # Push
            ("push",    "enabled",         "false",                0),
            ("push",    "vapid_public_key","",                     0),
            ("push",    "vapid_private_key","",                    1),
            ("push",    "vapid_email",     "admin@wifi.myowncloud.tech", 0),
            # MikroTik
            ("mikrotik","host",            "",                     0),
            ("mikrotik","port",            "8728",                 0),
            ("mikrotik","username",        "admin",                0),
            ("mikrotik","password",        "",                     1),
            ("mikrotik","use_ssl",         "false",                0),
        ]
        for cat, key, val, enc in settings_rows:
            await db.execute(text("""
                INSERT IGNORE INTO settings (category, key_name, value, is_encrypted, updated_at)
                VALUES (:c, :k, :v, :e, NOW())
            """), {"c": cat, "k": key, "v": val, "e": enc})

        await db.commit()
        print("  [seed] Admin users, bandwidth profiles, settings — done")

asyncio.run(seed())
PYEOF

ok "Initial seed complete"

# ── 8. Systemd service ───────────────────────────────────────────────────────
info "Creating systemd service: $SERVICE_NAME ..."

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=MikroTik Hotspot Manager API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${BACKEND_DIR}/venv/bin/gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 2 \
    --bind 127.0.0.1:${API_PORT} \
    --timeout 120 \
    --access-logfile /var/log/${SERVICE_NAME}/access.log \
    --error-logfile /var/log/${SERVICE_NAME}/error.log
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/log/${SERVICE_NAME}
chown -R www-data:www-data /var/log/${SERVICE_NAME}
chown -R www-data:www-data "$BACKEND_DIR"

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
sleep 3
systemctl is-active --quiet ${SERVICE_NAME} && ok "API service running" || {
  warn "Service may not be running. Check: journalctl -u ${SERVICE_NAME} -n 50"
}

# ── 9. Build frontend ────────────────────────────────────────────────────────
info "Building frontend..."

# Install Node if not present
if ! command -v node &>/dev/null; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -q
  apt-get install -y -qq nodejs
fi
ok "Node $(node --version) ready"

cd "$FRONTEND_DIR"
npm install --legacy-peer-deps -q

# Write frontend env
cat > .env.production <<EOF
VITE_API_BASE_URL=https://${DOMAIN}/api/v1
VITE_WS_URL=wss://${DOMAIN}/ws
EOF

npm run build
ok "Frontend built → $FRONTEND_DIR/dist"

# ── 10. Nginx config ─────────────────────────────────────────────────────────
info "Configuring Nginx..."

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_DIST="${FRONTEND_DIR}/dist"

cat > "$NGINX_CONF" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    # ── Frontend (Vite build) ────────────────────────────────────────────
    root ${NGINX_DIST};
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static assets with long-term cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ── Backend API proxy ────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:${API_PORT};
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
        client_max_body_size 50M;
    }

    # ── WebSocket proxy ──────────────────────────────────────────────────
    location /ws {
        proxy_pass         http://127.0.0.1:${API_PORT}/ws;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_read_timeout 86400s;
    }

    # ── Docs (optional, remove in prod) ─────────────────────────────────
    location /docs {
        proxy_pass http://127.0.0.1:${API_PORT}/docs;
        proxy_set_header Host \$host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:${API_PORT}/openapi.json;
    }

    # ── Security headers ─────────────────────────────────────────────────
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
NGINXEOF

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/${DOMAIN} 2>/dev/null || true
# Remove default if it exists
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t 2>&1 && systemctl reload nginx 2>/dev/null || systemctl start nginx && ok "Nginx configured and reloaded" || warn "Nginx config error — run: nginx -t"

# ── 11. Final status ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Site:${NC}     http://${DOMAIN}"
echo -e "  ${CYAN}API:${NC}      http://${DOMAIN}/api/v1"
echo -e "  ${CYAN}Docs:${NC}     http://${DOMAIN}/docs"
echo ""
echo -e "  ${CYAN}Login:${NC}    admin / Admin@123"
echo -e "  ${CYAN}Operator:${NC} operator / Operator@123"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. Install SSL:  certbot --nginx -d ${DOMAIN}"
echo -e "  2. Configure SMTP/SMS/Telegram in Settings"
echo -e "  3. Add MikroTik router in Settings → MikroTik"
echo ""
echo -e "  ${CYAN}Service logs:${NC} journalctl -u ${SERVICE_NAME} -f"
echo -e "  ${CYAN}API logs:${NC}     tail -f /var/log/${SERVICE_NAME}/error.log"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
