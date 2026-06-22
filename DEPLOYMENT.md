# Инструкция по развёртыванию — allyshop-crm

Документ описывает два способа развернуть CRM:

1. **Локально через Docker** — основной способ для разработки и демонстрации.
2. **На Vercel + Neon Postgres** — для тестовых деплоев (превью).

Стек: React (Vite) + Node/Express + Prisma + PostgreSQL.

> ⚠️ Часть команд и файлов появится по мере прохождения этапов из `PLAN.md`
> (на этапе 0 создаётся каркас и Docker-конфигурация). До этого момента раздел
> служит ориентиром, как всё будет собираться.

---

## 0. Предварительные требования

| Инструмент       | Версия (рекомендуется) | Зачем                          |
|------------------|------------------------|--------------------------------|
| Docker Desktop   | актуальная             | Локальный запуск всего стека   |
| Node.js          | 20 LTS+                | Локальная разработка без Docker |
| npm              | 10+                    | Менеджер пакетов                |
| Git              | актуальная             | Версионирование                |
| Vercel CLI       | актуальная (`npm i -g vercel`) | Тестовый деплой         |

Проверка:

```bash
docker --version
node --version
npm --version
```

---

## 1. Переменные окружения

В корне и/или в пакетах используются `.env` файлы (в репозиторий не коммитятся —
только `*.env.example`).

### backend/.env

```env
# База данных
DATABASE_URL="postgresql://crm:crm@db:5432/allyshop?schema=public"
# (для локального запуска без Docker замените host db -> localhost)

# Авторизация
JWT_SECRET="смените-на-длинную-случайную-строку"
JWT_EXPIRES_IN="7d"

# Первый супер-админ (создаётся сидом)
SEED_ADMIN_LOGIN="admin"
SEED_ADMIN_PASSWORD="смените-этот-пароль"
SEED_ADMIN_NAME="Администратор"

# Сервер
PORT=4000
CORS_ORIGIN="http://localhost:5173"
```

### frontend/.env

```env
VITE_API_URL="http://localhost:4000/api"
```

> Генерация надёжного `JWT_SECRET`:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

---

## 2. Локальный запуск через Docker (основной способ)

`docker-compose.yml` поднимает три сервиса: `db` (Postgres), `api` (Express),
`web` (Vite/раздача статики).

### 2.1. Первый запуск

```bash
# 1. Скопировать примеры окружения
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Собрать и поднять всё
docker compose up --build
```

После старта контейнеров:

```bash
# 3. Применить миграции БД (в контейнере api)
docker compose exec api npx prisma migrate deploy

# 4. Создать супер-админа (сид)
docker compose exec api npm run seed
```

### 2.2. Адреса

| Сервис        | URL                          |
|---------------|------------------------------|
| Frontend      | http://localhost:5173        |
| Backend API   | http://localhost:4000/api    |
| Healthcheck   | http://localhost:4000/api/health |
| Postgres      | localhost:5432 (внутри сети — `db:5432`) |

Вход: логин/пароль из `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD`.

### 2.3. Повседневные команды

```bash
docker compose up              # запустить
docker compose up -d           # запустить в фоне
docker compose down            # остановить
docker compose down -v         # остановить и УДАЛИТЬ данные (volume БД и загрузок)
docker compose logs -f api     # логи backend
docker compose exec api sh     # шелл внутри backend
docker compose exec db psql -U crm -d allyshop   # psql в БД
```

### 2.4. Работа с миграциями (во время разработки)

```bash
# создать новую миграцию после правки schema.prisma
docker compose exec api npx prisma migrate dev --name <название>

# открыть Prisma Studio (визуальный просмотр БД)
docker compose exec api npx prisma studio
```

### 2.5. Хот-релоад (автоперезагрузка при правках кода)

Контейнеры монтируют исходники как volume, поэтому код подхватывается без пересборки:

- **Backend** — `nodemon` с polling (`legacyWatch`) перезапускает сервер при правке `src/**`.
- **Frontend** — Vite с `usePolling` обновляет страницу (HMR) при правке `src/**`.

Polling включён, потому что на Windows события файловой системы не проходят сквозь
bind-mount Docker. Перезапускать контейнеры для изменений кода **не нужно**.

Исключение: правки `Dockerfile`, `package.json` (новые зависимости) или `env_file`
(`backend/.env`) требуют пересоздания:

```bash
docker compose up -d --build --renew-anon-volumes api   # новые зависимости
docker compose up -d --force-recreate api               # изменения .env
```

### 2.6. Сохранность данных

Данные лежат на именованных volume и **переживают удаление/пересоздание контейнеров**
(`docker compose down`, `up --force-recreate`):

| Volume          | Что хранит                         |
|-----------------|------------------------------------|
| `db_data`       | база данных PostgreSQL             |
| `uploads_data`  | загруженные файлы (фото товаров)   |

Удаляются эти данные **только** явной командой `docker compose down -v` (флаг `-v`).
Загруженные фото изолированы в `uploads_data`, а не в исходниках на хосте.

---

## 3. Локальный запуск БЕЗ Docker (опционально)

Если нужен только Postgres в Docker, а API/фронт — нативно:

```bash
# Поднять только БД
docker compose up -d db

# Backend
cd backend
npm install
# в backend/.env заменить host: db -> localhost
npx prisma migrate deploy
npm run seed
npm run dev        # http://localhost:4000

# Frontend (в другом терминале)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## 4. Тестовый деплой на Vercel + Neon Postgres

Схема: **два проекта Vercel** из одного репозитория — фронт (`frontend`) и API
(`backend` как Serverless Functions), общая БД — **Neon** (бесплатный Postgres).
Конфигурация уже в репозитории: `frontend/vercel.json`, `backend/vercel.json`,
`backend/api/index.ts` (Express как функция), `binaryTargets` для Prisma и
`postinstall: prisma generate`.

### 4.1. База данных (Neon)

1. Регистрация на https://neon.tech, создать проект (регион ближе к Vercel).
2. Скопировать **pooled** connection string (Neon → Connection Details → галочка
   «Pooled connection»; в строке будет `-pooler` и `?sslmode=require`).
   Пулинг обязателен для serverless — иначе быстро закончатся коннекты.
3. Применить миграции и сид к облачной БД (локально, разово):
   ```bash
   cd backend
   DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy
   DATABASE_URL="<neon-pooled-url>" npm run seed
   ```

> Альтернатива Neon: **Vercel Postgres** или **Supabase** — connection string так же.

### 4.2. Backend (проект `crm-api`)

1. Vercel → **Add New → Project**, импортировать репозиторий.
2. **Root Directory:** `backend`. Framework Preset: **Other**.
3. Переменные окружения:
   ```
   DATABASE_URL   = <neon-pooled-url>
   JWT_SECRET     = <случайная строка>
   JWT_EXPIRES_IN = 7d
   CORS_ORIGIN    = <URL фронтенда, напр. https://crm-web.vercel.app>
   UPLOAD_DIR     = /tmp/uploads
   ```
4. Deploy. API будет на `https://crm-api.vercel.app` (все запросы Express через
   `vercel.json` → `api/index`).

### 4.3. Frontend (проект `crm-web`)

1. Vercel → **Add New → Project**, тот же репозиторий.
2. **Root Directory:** `frontend`. Framework Preset: **Vite** (Build `npm run build`,
   Output `dist` — определяются автоматически).
3. Переменная окружения:
   ```
   VITE_API_URL = https://crm-api.vercel.app/api
   ```
4. Deploy. После — впишите этот URL фронта в `CORS_ORIGIN` backend-проекта и
   передеплойте backend.

### 4.4. Деплой через CLI (альтернатива дашборду)

```bash
npm i -g vercel
vercel login
cd backend  && vercel --prod   # задать env при первом запуске
cd frontend && vercel --prod
```

### 4.5. Ограничения serverless (для теста допустимы)

- **Загрузка фото не персистентна.** ФС функции эфемерна (`/tmp`), файлы не
  сохраняются между вызовами. Для production — вынести в **Vercel Blob** или S3
  (вынесено в пост-MVP). Всё остальное (товары, заказы, склад, финансы) работает
  на БД и не зависит от ФС.
- **Холодный старт** функции — первая загрузка после простоя чуть дольше.

> Если нужен полноценный backend с персистентными загрузками — разверните `backend`
> на **Railway/Render** (Express + диск + Postgres как обычный сервер), а фронт
> оставьте на Vercel; в `VITE_API_URL` и `CORS_ORIGIN` подставьте URL этого backend.

---

## 5. Чек-лист перед тестовым деплоем

- [ ] `JWT_SECRET` на тесте — НЕ из примера, сгенерирован случайно.
- [ ] `SEED_ADMIN_PASSWORD` изменён.
- [ ] `DATABASE_URL` указывает на облачную БД (Neon/Vercel/Supabase), не на localhost.
- [ ] `CORS_ORIGIN` на backend = URL фронтенда.
- [ ] Миграции применены (`prisma migrate deploy`) к облачной БД.
- [ ] Сид супер-админа выполнен.
- [ ] Prisma Client сгенерирован при сборке (`prisma generate`).
- [ ] Для serverless — включён пулинг соединений Postgres.

---

## 6. Частые проблемы

| Симптом                                   | Причина / решение                                               |
|-------------------------------------------|-----------------------------------------------------------------|
| API не видит БД в Docker                  | В `DATABASE_URL` host должен быть `db`, а не `localhost`.        |
| CORS-ошибка в браузере                    | `CORS_ORIGIN` на backend должен совпадать с URL фронта.         |
| На Vercel «too many connections»          | Включить pooled connection (Neon) / Prisma Data Proxy.          |
| `prisma: command not found` при сборке    | Добавить `prisma generate` в `postinstall`/`build`.             |
| Изменения схемы не применились            | Запустить `prisma migrate deploy` (прод) / `migrate dev` (лок). |
| Потеряны данные после `docker compose down -v` | `-v` удаляет volume с БД. Без `-v` данные сохраняются.     |
