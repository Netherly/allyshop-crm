set -euo pipefail

telegram_load_config() {
  local config="${TELEGRAM_CONFIG:-/opt/allyshop-crm/deploy/telegram-backup.env}"
  if [[ ! -f "$config" ]]; then
    return 1
  fi
  # shellcheck disable=SC1090
  source "$config"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "telegram: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в $config" >&2
    return 1
  fi
}

telegram_send_message() {
  local text="$1"
  local args=(
    --silent
    --show-error
    --fail
    --max-time 120
    -X POST
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    -d "chat_id=${TELEGRAM_CHAT_ID}"
    -d "text=${text}"
    -d "disable_web_page_preview=true"
  )

  if [[ -n "${TELEGRAM_THREAD_ID:-}" ]]; then
    args+=(-d "message_thread_id=${TELEGRAM_THREAD_ID}")
  fi

  curl "${args[@]}" >/dev/null
}

telegram_send_file() {
  local file="$1"
  local caption="${2:-}"

  if [[ ! -f "$file" ]]; then
    echo "telegram: файл не найден: $file" >&2
    return 1
  fi

  local size
  size="$(du -m "$file" | cut -f1)"
  if (( size > 49 )); then
    echo "telegram: файл ${file} слишком большой (${size} МБ, лимит ~50 МБ)" >&2
    return 1
  fi

  local args=(
    --silent
    --show-error
    --fail
    --max-time 600
    -X POST
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument"
    -F "chat_id=${TELEGRAM_CHAT_ID}"
    -F "document=@${file}"
  )

  if [[ -n "$caption" ]]; then
    args+=(-F "caption=${caption}")
  fi

  if [[ -n "${TELEGRAM_THREAD_ID:-}" ]]; then
    args+=(-F "message_thread_id=${TELEGRAM_THREAD_ID}")
  fi

  curl "${args[@]}" >/dev/null
}

telegram_send_backup() {
  local file="$1"
  local label="$2"

  if ! telegram_load_config; then
    echo "telegram: конфиг не найден, отправка пропущена"
    return 0
  fi

  local human_size
  human_size="$(du -h "$file" | cut -f1)"
  local caption="${label} ($(basename "$file"), ${human_size})"

  echo "$(date '+%F %T') telegram: отправка ${file}..."
  telegram_send_file "$file" "$caption"
  echo "$(date '+%F %T') telegram: отправлено"
}
