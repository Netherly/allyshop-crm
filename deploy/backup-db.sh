#!/usr/bin/env bash
# Бэкап БД в сжатый дамп + отправка в Telegram (если настроен deploy/telegram-backup.env).
# Держит последние $KEEP_DAYS дней локально.
#
# Установка в cron (ежедневно в 3:30):
#   sudo chmod +x /opt/allyshop-crm/deploy/backup-db.sh
#   crontab -e
#   30 3 * * * /opt/allyshop-crm/deploy/backup-db.sh >> /var/log/allyshop-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/telegram.sh
source "$SCRIPT_DIR/lib/telegram.sh"

PROJECT_DIR="${PROJECT_DIR:-/opt/allyshop-crm}"
BACKUP_DIR="${BACKUP_DIR:-/opt/allyshop-crm-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$PROJECT_DIR"

# Имя пользователя и БД берём из того же .env, что и compose.
# shellcheck disable=SC1091
source .env
DB_USER="${POSTGRES_USER:-crm}"
DB_NAME="${POSTGRES_DB:-allyshop}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H-%M)"
TARGET="$BACKUP_DIR/allyshop_$STAMP.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$TARGET"

echo "$(date '+%F %T') бэкап готов: $TARGET ($(du -h "$TARGET" | cut -f1))"

telegram_send_backup "$TARGET" "🗄 allyshop-crm — бэкап БД"

# Удаляем дампы старше KEEP_DAYS суток.
find "$BACKUP_DIR" -name 'allyshop_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
