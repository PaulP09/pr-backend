#!/usr/bin/env bash
set -euo pipefail

# =====================================================================
#  PR Backend – Installer fuer Debian
#  Aufruf:   sudo bash install.sh
#  (Muss IM Projektordner liegen, also dort wo package.json ist.)
# =====================================================================

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo starten:  sudo bash install.sh"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="${SUDO_USER:-root}"

echo "============================================="
echo " PR Backend Installer"
echo " Projektordner : $PROJECT_DIR"
echo " Dienst-User   : $RUN_USER"
echo "============================================="

# 1) Grundpakete -------------------------------------------------------
echo "==> Grundpakete ..."
apt-get update -y
apt-get install -y curl ca-certificates gnupg openssl git

# 2) Node.js 20 --------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js 20 installieren ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    Node: $(node -v)"

# 3) PostgreSQL + PostGIS ---------------------------------------------
echo "==> PostgreSQL installieren ..."
apt-get install -y postgresql postgresql-contrib
PGVER="$(psql -V | grep -oE '[0-9]+' | head -1)"
echo "    PostgreSQL-Version: $PGVER"
apt-get install -y "postgresql-${PGVER}-postgis-3" postgis \
  || apt-get install -y postgis
systemctl enable --now postgresql

# 4) Datenbank + Benutzer ---------------------------------------------
DB_NAME="pr"
DB_USER="pr_user"
DB_PASS="$(openssl rand -hex 16)"
PASS_CHANGED=1

if [ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" = "1" ]; then
  echo "    DB-Benutzer ${DB_USER} existiert schon (Passwort bleibt)."
  PASS_CHANGED=0
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  echo "    DB-Benutzer ${DB_USER} angelegt."
fi

if [ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "    Datenbank ${DB_NAME} angelegt."
fi

# PostGIS in der DB aktivieren (braucht Superuser-Rechte)
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null
echo "    PostGIS aktiviert."

# 5) .env --------------------------------------------------------------
if [ ! -f "${PROJECT_DIR}/.env" ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > "${PROJECT_DIR}/.env" <<EOF
PORT=3000
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
PUBLIC_URL=
EOF
  chown "${RUN_USER}:${RUN_USER}" "${PROJECT_DIR}/.env"
  echo "    .env erstellt."
else
  echo "    .env existiert schon – wird NICHT ueberschrieben."
  PASS_CHANGED=0
fi

# 6) npm install + Schema ---------------------------------------------
echo "==> npm install ..."
sudo -u "${RUN_USER}" bash -lc "cd '${PROJECT_DIR}' && npm install"

echo "==> Datenbank-Tabellen anlegen ..."
sudo -u "${RUN_USER}" bash -lc "cd '${PROJECT_DIR}' && npm run init-db"

# 7) Autostart per systemd --------------------------------------------
echo "==> Dienst einrichten (Autostart) ..."
cat > /etc/systemd/system/pr-backend.service <<EOF
[Unit]
Description=PR Backend
After=network.target postgresql.service

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=$(command -v node) src/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now pr-backend

echo
echo "============================================="
echo " FERTIG."
echo "  Status :  systemctl status pr-backend"
echo "  Logs   :  journalctl -u pr-backend -f"
echo "  Test   :  curl http://localhost:3000/health"
if [ "$PASS_CHANGED" = "1" ]; then
  echo
  echo "  DB-Passwort (steht auch in .env): ${DB_PASS}"
fi
echo "============================================="
