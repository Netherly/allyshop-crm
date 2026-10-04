# allyshop.work — продолжение деплоя с шага 6

Инструкция для вашего сервера:

| Параметр | Значение |
|---|---|
| VPS | `176.118.167.137`, Ubuntu, работа под **root** |
| Домен | **`allyshop.work`** (CRM в корне, без поддомена) |
| Путь проекта | `/opt/allyshop-crm` |
| Полная документация | [DEPLOYMENT_VPS.md](../DEPLOYMENT_VPS.md) |

Предполагается, что шаги 1–5 уже сделаны: DNS, `apt upgrade`, UFW, Docker, nginx, certbot,
репозиторий склонирован, `.env` и `backend/.env.production` заполнены.

---

## Перед запуском — быстрая проверка env

На сервере:

```bash
cd /opt/allyshop-crm
cat .env
cat backend/.env.production
```

Должно быть примерно так:

**`/opt/allyshop-crm/.env`**
```env
POSTGRES_USER=crm
POSTGRES_PASSWORD=<ваш пароль>
POSTGRES_DB=allyshop
VITE_API_URL=https://allyshop.work/api
```

**`/opt/allyshop-crm/backend/.env.production`**
```env
DATABASE_URL="postgresql://crm:<ТОТ_ЖЕ_ПАРОЛЬ>@db:5432/allyshop?schema=public"
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
SEED_ADMIN_LOGIN="..."
SEED_ADMIN_PASSWORD="..."
SEED_ADMIN_NAME="Администратор"
UPLOAD_DIR="uploads"
PORT=4000
CORS_ORIGIN="https://allyshop.work"
NOVAPOSHTA_API_KEY=""
CRON_SECRET="..."
```

Пароль в `DATABASE_URL` **обязан совпадать** с `POSTGRES_PASSWORD`.

Логин/пароль супер-админа — из `SEED_ADMIN_*` (не `admin/admin`, если вы их меняли).

---

## Шаг 6. Запуск Docker-стека

### 6.1. Убедитесь, что Apache не мешает (порт 80)

```bash
systemctl stop apache2
systemctl disable apache2
ss -tlnp | grep ':80'
```

Если порт 80 занят не nginx — разберитесь до certbot. После настройки nginx там должен
слушать nginx.

### 6.2. Сборка и запуск

```bash
cd /opt/allyshop-crm
docker compose -f docker-compose.prod.yml up -d --build
```

Первая сборка **3–10 минут**. Docker скачает образы, соберёт API (TypeScript → JS) и фронт
(Vite → статика в nginx-контейнере).

Следить за процессом:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

`Ctrl+C` — выйти из логов (контейнеры продолжат работать).

### 6.3. Проверка контейнеров

```bash
docker compose -f docker-compose.prod.yml ps
```

Ожидаем:

| Сервис | Статус |
|--------|--------|
| `db` | Up, **healthy** |
| `api` | Up |
| `web` | Up |

Если `api` в Restarting — смотрите логи:

```bash
docker compose -f docker-compose.prod.yml logs api --tail 50
```

Частые причины:
- неверный пароль в `DATABASE_URL`;
- нет файла `backend/.env.production`;
- не хватает RAM при сборке (нужен swap).

### 6.4. Проверка API и фронта локально на сервере

```bash
curl -s http://127.0.0.1:4000/api/health
# {"status":"ok","time":"..."}

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080
# 200
```

В логах API должны быть строки про `prisma migrate deploy` и `API слушает порт 4000`.

---

## Шаг 7. Сид супер-админа (новая база)

**Пропустите**, если переносили дамп с Neon — админ уже есть.

**Перед сидом** убедитесь, что в `backend/.env.production` стоят нужные `SEED_ADMIN_LOGIN`
и `SEED_ADMIN_PASSWORD` — потом их уже не поменять через env.

```bash
cd /opt/allyshop-crm
docker compose -f docker-compose.prod.yml exec api npm run seed
```

Ожидаемый вывод:
```
Роль "Менеджер" готова (id=1).
Создан супер-админ: <ваш логин>
```

Если `Пользователь "..." уже существует — пропускаем` — сид уже был или база не пустая.

Проверка входа (ещё без HTTPS, напрямую к API):

```bash
curl -s -X POST http://127.0.0.1:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"ВАШ_ЛОГИН","password":"ВАШ_ПАРОЛЬ"}'
```

Должен вернуться JSON с `"token"` и `"user"`.

---

## Шаг 8. nginx на хосте (прокси на Docker)

Конфиг уже настроен под **`allyshop.work`**.

### 8.1. Обновить конфиг из репозитория

Если клонировали раньше — подтяните свежий nginx-конфиг:

```bash
cd /opt/allyshop-crm
git pull
```

Или скопируйте вручную — в файле `deploy/nginx/allyshop-crm.conf` должно быть:

```nginx
server_name allyshop.work www.allyshop.work;
```

### 8.2. Установить конфиг

```bash
cd /opt/allyshop-crm
cp deploy/nginx/allyshop-crm.conf /etc/nginx/sites-available/allyshop-crm.conf
ln -sf /etc/nginx/sites-available/allyshop-crm.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

`nginx -t` должен вывести `syntax is ok` и `test is successful`.

### 8.3. Проверка по HTTP

Откройте в браузере: **http://allyshop.work**

Должна открыться страница входа CRM (ещё без замка HTTPS — это нормально).

Если **502 Bad Gateway**:
```bash
docker compose -f docker-compose.prod.yml ps
ss -tlnp | grep -E '4000|8080'
docker compose -f docker-compose.prod.yml logs api --tail 30
```

---

## Шаг 9. HTTPS (Let's Encrypt)

```bash
certbot --nginx -d allyshop.work -d www.allyshop.work
```

Certbot спросит:
1. **Email** — для уведомлений об истечении сертификата.
2. **Terms** — согласиться (Y).
3. **Redirect HTTP → HTTPS** — выберите **2 (Redirect)**.

Проверка:

```bash
certbot renew --dry-run
curl -s https://allyshop.work/api/health
```

Откройте **https://allyshop.work** — замок в браузере, страница входа CRM.

---

## Шаг 10. Вход в CRM

| | |
|---|---|
| URL | **https://allyshop.work** |
| Логин | из `SEED_ADMIN_LOGIN` в `backend/.env.production` |
| Пароль | из `SEED_ADMIN_PASSWORD` |

Проверьте: вход, рабочий стол, создание тестового товара, загрузку фото.

---

## Шаг 11. Cron — статусы Новой Почты

Подставьте `CRON_SECRET` из `backend/.env.production`:

```bash
crontab -e
```

Добавьте строку (каждые 6 часов):

```cron
0 */6 * * * curl -fsS -H "Authorization: Bearer ВАШ_CRON_SECRET" http://127.0.0.1:4000/api/cron/refresh-deliveries >> /var/log/allyshop-cron.log 2>&1
```

Проверка:

```bash
curl -s -H "Authorization: Bearer ВАШ_CRON_SECRET" \
  http://127.0.0.1:4000/api/cron/refresh-deliveries
```

Без `NOVAPOSHTA_API_KEY` будет ошибка — это нормально, пока ключ не добавите.

---

## Шаг 12. Бэкапы в Telegram

### 12.1. Создать бота и конфиг

1. **@BotFather** → `/newbot` → скопировать токен.
2. Добавить бота в чат https://t.me/c/3942258793/386 (топик «386»).
3. На сервере:

```bash
cd /opt/allyshop-crm
cp deploy/telegram-backup.env.example deploy/telegram-backup.env
chmod 600 deploy/telegram-backup.env
```

В `deploy/telegram-backup.env` уже прописаны chat_id и thread_id для вашего чата:

```env
TELEGRAM_BOT_TOKEN=ВСТАВЬТЕ_ТОКЕН_ОТ_BOTFATHER
TELEGRAM_CHAT_ID=-1003942258793
TELEGRAM_THREAD_ID=386
```

### 12.2. Проверка

```bash
chmod +x /opt/allyshop-crm/deploy/backup-db.sh /opt/allyshop-crm/deploy/backup-sources.sh
/opt/allyshop-crm/deploy/backup-db.sh
/opt/allyshop-crm/deploy/backup-sources.sh
```

В топик чата должны прийти два файла: дамп БД и архив исходников.

### 12.3. Cron

```bash
crontab -e
```

```cron
# БД — каждый день в 3:30
30 3 * * * /opt/allyshop-crm/deploy/backup-db.sh >> /var/log/allyshop-backup.log 2>&1

# Исходники — каждое воскресенье в 4:00
0 4 * * 0 /opt/allyshop-crm/deploy/backup-sources.sh >> /var/log/allyshop-backup.log 2>&1
```

Локальные копии: `/opt/allyshop-crm-backups/` (БД — 14 дней, исходники — 8 недель).

---

## Шаг 13. Отключить Vercel

Только **после** проверки на `https://allyshop.work`:

1. Vercel → проекты `allyshop-crm` и `allyshop-crm-fkv9` → отключить деплой или удалить.
2. Neon — финальный дамп на всякий случай, затем можно удалить проект.

---

## Полезные команды на каждый день

```bash
cd /opt/allyshop-crm
C="docker compose -f docker-compose.prod.yml"

$C ps
$C logs -f api
$C restart api
$C down          # остановить (данные сохраняются)
$C up -d         # поднять снова
# НЕ используйте down -v — удалит базу и фото!
```

Обновление после правок в коде:

```bash
cd /opt/allyshop-crm
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Если что-то пошло не так

| Симптом | Решение |
|---------|---------|
| `502` на сайте | `$C ps`, `$C logs api`, проверить `127.0.0.1:4000` и `:8080` |
| Пустой экран | Пересобрать фронт: проверить `VITE_API_URL=https://allyshop.work/api` в `.env`, затем `$C up -d --build web` |
| `P1001` / API не видит БД | Сверить пароли в `.env` и `DATABASE_URL` |
| Certbot failed | `nslookup allyshop.work 8.8.8.8` → `176.118.167.137`, порт 80 открыт (`ufw status`) |
| Сборка web упала | Добавить swap (см. DEPLOYMENT_VPS.md §4.4) |
| Apache занял 80 | `systemctl stop apache2 && systemctl disable apache2` |

---

## Чек-лист «готово»

- [ ] `https://allyshop.work` открывается с HTTPS
- [ ] Вход под супер-админом работает
- [ ] `/api/health` отвечает `{"status":"ok"}`
- [ ] Загрузка фото сохраняется после `$C restart api`
- [ ] Cron и бэкап в crontab
- [ ] Vercel отключён
