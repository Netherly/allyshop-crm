# Развёртывание allyshop-crm на своём VPS (уход с Vercel)

Инструкция для прода на собственном сервере: VPS + домен (GoDaddy) + Docker + nginx с
бесплатным HTTPS. В отличие от Vercel здесь **фото товаров сохраняются постоянно**,
а cron работает без ограничений тарифа.

Связанные документы: [DEPLOYMENT.md](DEPLOYMENT.md) — локальный Docker и старая схема
Vercel + Neon.

---

## 1. Итоговая архитектура

Всё крутится на одном сервере, наружу открыт только nginx (80/443):

```
              Интернет
                 │  HTTPS
        ┌────────▼─────────┐
        │  nginx на хосте  │  TLS (Let's Encrypt), один домен
        └───┬─────────┬────┘
   /        │         │  /api/  и  /uploads/
            │         │
  ┌─────────▼──┐   ┌──▼──────────┐     ┌──────────────┐
  │ web        │   │ api         │────▶│ db           │
  │ nginx+dist │   │ Express     │     │ Postgres 16  │
  │ :8080      │   │ :4000       │     │ (без порта)  │
  └────────────┘   └──────┬──────┘     └──────┬───────┘
                          │                   │
                    uploads_data          db_data   ← постоянные тома
```

Ключевые решения:

| Решение | Зачем |
|---|---|
| Фронт и API на **одном домене** | CORS не задействован, ссылки на фото работают сами |
| `api` и `web` слушают только `127.0.0.1` | Снаружи доступны исключительно через nginx |
| Postgres **без** публикации порта | БД недоступна из интернета |
| Миграции при старте контейнера | Схема БД всегда совпадает с кодом |
| Тома `db_data` / `uploads_data` | Данные и фото переживают пересборку |

Новые файлы в репозитории:

```
docker-compose.prod.yml              прод-стек
.env.prod.example                    переменные compose (→ .env на сервере)
backend/Dockerfile.prod              сборка API (tsc) + автомиграции
backend/.env.production.example      секреты API (→ backend/.env.production)
frontend/Dockerfile.prod             сборка Vite + nginx
frontend/nginx.conf                  раздача SPA внутри контейнера
deploy/nginx/allyshop-crm.conf       конфиг nginx на хосте
deploy/backup-db.sh                  ежедневный бэкап БД
```

---

## 2. Что понадобится

- **VPS** (Ubuntu 22.04/24.04), root или sudo-доступ по SSH, публичный IP из панели хостинга.
- **Домен** на GoDaddy и доступ к его DNS.
- Минимум **2 ГБ RAM** (или 1 ГБ + swap, см. шаг 4.4) — сборка фронта требовательна к памяти.
- Открытые порты 22, 80, 443.

Дальше по тексту заменяйте:

- `crm.example.com` → ваш домен;
- `203.0.113.10` → IP вашего VPS.

---

## 3. Шаг 1. DNS на GoDaddy

Домен должен указывать на VPS **до** выпуска сертификата, иначе certbot не пройдёт проверку.

1. Войдите на GoDaddy → **My Products** → у нужного домена нажмите **DNS**.
2. **Add New Record** и создайте A-запись:

| Поле | Значение |
|---|---|
| Type | `A` |
| Name | `crm` (для `crm.example.com`) либо `@` (для корневого домена) |
| Value | `203.0.113.10` |
| TTL | `600` (10 минут) |

3. Если хотите ещё и `www` — добавьте `CNAME`: Name `www`, Value `crm.example.com`.

> Рекомендую **поддомен** `crm.example.com`: корневой домен остаётся свободным под сайт.

Проверка (подождите 10–30 минут):

```bash
nslookup crm.example.com
# в ответе должен быть IP вашего VPS
```

---

## 4. Шаг 2. Подготовка VPS

### 4.1. Подключение и обновление

```bash
ssh root@203.0.113.10
apt update && apt upgrade -y
```

### 4.2. Отдельный пользователь (не работать под root)

```bash
adduser deploy
usermod -aG sudo deploy
# скопировать SSH-ключи, если заходите по ключу
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Дальше заходите как `deploy`: `ssh deploy@203.0.113.10`.

### 4.3. Файрвол

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 4.4. Swap (если RAM меньше 2 ГБ)

Сборка фронта (`tsc && vite build`) может упасть по нехватке памяти. Подстраховка:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 4.5. Docker и Docker Compose

```bash
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# работать с docker без sudo
sudo usermod -aG docker $USER
newgrp docker

docker --version && docker compose version
```

### 4.6. nginx и certbot на хосте

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Откройте `http://203.0.113.10` — должна показаться страница-заглушка nginx.

---

## 5. Шаг 3. Код проекта на сервере

```bash
sudo mkdir -p /opt/allyshop-crm
sudo chown $USER:$USER /opt/allyshop-crm
git clone https://github.com/Netherly/allyshop-crm.git /opt/allyshop-crm
cd /opt/allyshop-crm
```

Если репозиторий приватный — используйте deploy-ключ или Personal Access Token.

---

## 6. Шаг 4. Переменные окружения

### 6.1. Сгенерируйте секреты

```bash
openssl rand -hex 48   # для JWT_SECRET
openssl rand -hex 48   # для CRON_SECRET
openssl rand -hex 16   # для пароля Postgres
```

### 6.2. Файл для compose

```bash
cd /opt/allyshop-crm
cp .env.prod.example .env
nano .env
```

Заполните:

```env
POSTGRES_USER=crm
POSTGRES_PASSWORD=<пароль из openssl>
POSTGRES_DB=allyshop

VITE_API_URL=https://crm.example.com/api
```

> `VITE_API_URL` вшивается в бандл **на этапе сборки**. Меняете домен — пересобирайте
> `web` с `--build`, иначе фронт продолжит стучаться на старый адрес.

### 6.3. Файл для API

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

Заполните:

```env
DATABASE_URL="postgresql://crm:<ТОТ_ЖЕ_ПАРОЛЬ>@db:5432/allyshop?schema=public"

JWT_SECRET="<openssl rand -hex 48>"
JWT_EXPIRES_IN="7d"

SEED_ADMIN_LOGIN="admin"
SEED_ADMIN_PASSWORD="<надёжный пароль, НЕ admin>"
SEED_ADMIN_NAME="Администратор"

UPLOAD_DIR="uploads"
PORT=4000
CORS_ORIGIN="https://crm.example.com"

NOVAPOSHTA_API_KEY="<ключ из кабинета НП>"
CRON_SECRET="<openssl rand -hex 48>"
```

Проверьте, что пароль в `DATABASE_URL` **совпадает** с `POSTGRES_PASSWORD` из `.env`.

---

## 7. Шаг 5. Перенос данных с Neon (если нужен)

Если на Vercel/Neon уже есть рабочие данные — перенесите их **до** первого запуска API.
Порядок важен: сначала восстановить дамп, потом поднимать `api` (тогда `migrate deploy`
увидит применённые миграции в таблице `_prisma_migrations` и ничего не тронет).

```bash
cd /opt/allyshop-crm

# 1. Поднимаем только БД
docker compose -f docker-compose.prod.yml up -d db

# 2. Снимаем дамп с Neon (pg_dump берём из контейнера — на хост ставить ничего не нужно)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump "postgresql://ПОЛЬЗОВАТЕЛЬ:ПАРОЛЬ@ep-xxx.neon.tech/allyshop?sslmode=require" \
  --no-owner --no-privileges -Fc > neon.dump

ls -lh neon.dump   # убедитесь, что файл не пустой

# 3. Восстанавливаем в локальный Postgres
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U crm -d allyshop --no-owner --no-privileges < neon.dump
```

Фото товаров с Vercel перенести не получится — там файловая система эфемерная, они и
так не сохранялись. На VPS фото будут жить на томе `uploads_data`.

Если данные не нужны, шаг пропускаем — сид создаст чистую базу с админом.

---

## 8. Шаг 6. Запуск стека

```bash
cd /opt/allyshop-crm
docker compose -f docker-compose.prod.yml up -d --build
```

Первая сборка занимает 3–10 минут. Проверка:

```bash
docker compose -f docker-compose.prod.yml ps      # все сервисы Up, db — healthy
docker compose -f docker-compose.prod.yml logs api --tail 30

curl -s http://127.0.0.1:4000/api/health          # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080   # 200
```

В логах `api` должно быть применение миграций и `API слушает порт 4000`.

### Сид супер-админа

Только для **новой** базы (если переносили данные с Neon — пропустите, админ уже есть):

```bash
docker compose -f docker-compose.prod.yml exec api npm run seed
```

Сид идемпотентный: создаст роль «Менеджер» и супер-админа из `SEED_ADMIN_*`, а если
пользователь уже есть — ничего не изменит.

---

## 9. Шаг 7. nginx и HTTPS

### 9.1. Конфиг сайта

```bash
cd /opt/allyshop-crm
sudo cp deploy/nginx/allyshop-crm.conf /etc/nginx/sites-available/allyshop-crm.conf
sudo nano /etc/nginx/sites-available/allyshop-crm.conf   # заменить crm.example.com на свой домен

sudo ln -s /etc/nginx/sites-available/allyshop-crm.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # убрать заглушку
sudo nginx -t && sudo systemctl reload nginx
```

Проверьте по HTTP: `http://crm.example.com` — должна открыться CRM.

### 9.2. Сертификат Let's Encrypt

```bash
sudo certbot --nginx -d crm.example.com
```

Certbot спросит e-mail, предложит редирект с HTTP на HTTPS (выбирайте **Redirect**),
сам допишет 443-блок в конфиг и настроит автообновление.

Проверка автопродления:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Готово: `https://crm.example.com` работает под сертификатом.

---

## 10. Шаг 8. Cron обновления статусов Новой Почты

На Vercel это было ограничено тарифом. На своём сервере ограничений нет — вызываем
эндпоинт напрямую внутрь контейнера, минуя интернет.

```bash
crontab -e
```

Добавьте (каждые 6 часов), подставив `CRON_SECRET` из `backend/.env.production`:

```cron
0 */6 * * * curl -fsS -H "Authorization: Bearer ВАШ_CRON_SECRET" http://127.0.0.1:4000/api/cron/refresh-deliveries >> /var/log/allyshop-cron.log 2>&1
```

Ручная проверка:

```bash
curl -s -H "Authorization: Bearer ВАШ_CRON_SECRET" \
  http://127.0.0.1:4000/api/cron/refresh-deliveries
# ожидаем {"ok":true,...}
```

Без `NOVAPOSHTA_API_KEY` эндпоинт вернёт ошибку — это нормально, пока ключ не задан.

---

## 11. Шаг 9. Бэкапы БД

```bash
chmod +x /opt/allyshop-crm/deploy/backup-db.sh
/opt/allyshop-crm/deploy/backup-db.sh          # разовая проверка
crontab -e
```

Добавьте ежедневный запуск в 3:30:

```cron
30 3 * * * /opt/allyshop-crm/deploy/backup-db.sh >> /var/log/allyshop-backup.log 2>&1
```

Дампы складываются в `/opt/allyshop-crm-backups`, хранятся 14 дней.

Восстановление из бэкапа:

```bash
cd /opt/allyshop-crm
gunzip -c /opt/allyshop-crm-backups/allyshop_2026-09-01_03-30.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db psql -U crm -d allyshop
```

> Фото (`uploads_data`) в этот бэкап не входят. Отдельно:
> ```bash
> docker run --rm -v allyshop-crm-prod_uploads_data:/data -v /opt/allyshop-crm-backups:/out \
>   alpine tar czf /out/uploads_$(date +%F).tar.gz -C /data .
> ```

---

## 12. Обновление версии (обычный релиз)

```bash
cd /opt/allyshop-crm
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f          # почистить старые слои
```

Что происходит само:

- `api` пересобирается, при старте применяет новые миграции Prisma;
- `web` пересобирается с актуальным `VITE_API_URL`;
- тома `db_data` и `uploads_data` не затрагиваются — данные и фото на месте.

Проверка после релиза:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail 40
curl -s https://crm.example.com/api/health
```

> Теперь фронт и API собираются **одной командой из одного коммита**, поэтому
> рассинхрон версий (как было с двумя проектами Vercel) исключён.

---

## 13. Повседневные команды

```bash
cd /opt/allyshop-crm
C="docker compose -f docker-compose.prod.yml"

$C ps                      # статус сервисов
$C logs -f api             # логи API
$C restart api             # перезапуск API
$C down                    # остановить (данные сохраняются)
$C up -d                   # поднять
$C exec api sh             # шелл в контейнере API
$C exec db psql -U crm -d allyshop        # psql
$C exec api npx prisma migrate status     # статус миграций
```

---

## 14. Отключение Vercel

Делайте это **после** того, как убедились, что VPS работает.

1. Проверьте на новом домене: вход, заказы, товары, склад, финансы, загрузку фото.
2. В Vercel у обоих проектов (`allyshop-crm`, `allyshop-crm-fkv9`) отключите
   авто-деплой: Settings → Git → Disconnect, либо удалите проекты.
3. Neon: снимите финальный дамп и оставьте его как архив, затем можно удалить проект.
4. Если на домене были записи в сторону Vercel — уберите их в DNS GoDaddy.

Файл `backend/vercel.json` можно оставить (он больше ни на что не влияет) или удалить.

---

## 15. Возможные проблемы

| Симптом | Причина и решение |
|---|---|
| `502 Bad Gateway` | Контейнеры не поднялись: `$C ps`, `$C logs api`. Проверьте, что порты `127.0.0.1:4000` и `127.0.0.1:8080` слушаются (`ss -tlnp`). |
| Certbot: challenge failed | DNS ещё не обновился либо закрыт 80-й порт. Проверьте `nslookup crm.example.com` и `sudo ufw status`. |
| Пустой экран, в консоли ошибки запросов | `VITE_API_URL` собран с неверным адресом. Исправьте `.env` и пересоберите: `$C up -d --build web`. |
| `P1001 Can't reach database` | Не совпал пароль в `DATABASE_URL` и `POSTGRES_PASSWORD`, либо `db` не healthy. |
| `P2022 column does not exist` | Миграции не применились: `$C exec api npx prisma migrate deploy`. |
| Сборка `web` падает без ошибки | Нехватка памяти. Добавьте swap (шаг 4.4). |
| Фото не загружаются, ошибка 413 | Увеличьте `client_max_body_size` в конфиге nginx и `sudo systemctl reload nginx`. |
| Фото пропали после релиза | Не используйте `down -v` — флаг `-v` удаляет тома с данными. |

---

## 16. Чек-лист перед передачей в работу

- [ ] A-запись домена указывает на VPS, `https://` открывается с валидным сертификатом
- [ ] `JWT_SECRET` и `CRON_SECRET` — случайные, не из примеров
- [ ] Пароль супер-админа изменён, `admin/admin` не работает
- [ ] Тестовые пользователи (`test`, `qae_*`, `qax_*`) удалены или отключены
- [ ] `NOVAPOSHTA_API_KEY` задан, трекинг ТТН работает
- [ ] Cron НП добавлен в crontab и отдаёт `{"ok":true}`
- [ ] Бэкап БД выполняется по расписанию, восстановление проверено
- [ ] Загрузка фото работает и файл остаётся после `$C restart api`
- [ ] `ufw` включён, порт Postgres наружу не опубликован
- [ ] Проекты Vercel отключены
