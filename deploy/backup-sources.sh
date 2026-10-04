#!/usr/bin/env bash
# Еженедельный архив исходников проекта + отправка в Telegram.
#
# Cron (воскресенье, 4:00):
#   sudo chmod +x /opt/allyshop-crm/deploy/backup-sources.sh
#   crontab -e
#   0 4 * * 0 /opt/allyshop-crm/deploy/backup-sources.sh >> /var/log/allyshop-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/telegram.sh
source "$SCRIPT_DIR/lib/telegram.sh"

PROJECT_DIR="${PROJECT_DIR:-/opt/allyshop-crm}"
BACKUP_DIR="${BACKUP_DIR:-/opt/allyshop-crm-backups}"
KEEP_WEEKS="${KEEP_WEEKS:-8}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F)"
TARGET="$BACKUP_DIR/allyshop-sources_${STAMP}.tar.gz"

echo "$(date '+%F %T') архив исходников: $TARGET"

tar -czf "$TARGET" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='backend/uploads' \
  --exclude='backend/prisma/*.db' \
  --exclude='.git' \
  -C "$(dirname "$PROJECT_DIR")" \
  "$(basename "$PROJECT_DIR")"

echo "$(date '+%F %T') архив готов: $TARGET ($(du -h "$TARGET" | cut -f1))"

telegram_send_backup "$TARGET" "📦 allyshop-crm — бэкап исходников"

# Удаляем архивы старше KEEP_WEEKS недель.
find "$BACKUP_DIR" -name 'allyshop-sources_*.tar.gz' -mtime +$((KEEP_WEEKS * 7)) -delete
