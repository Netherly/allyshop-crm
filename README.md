# allyshop-crm

CRM для учёта одежды: товары/SKU, склад через движения, наборы/ростовки, клиенты,
заказы, оплаты, возвраты, доставка Новой Почтой, финансы и аудит.

## Структура

```
backend/    Express API + Prisma (Node + TypeScript)
frontend/   React SPA (Vite + TypeScript)
```

## Документы

- [PLAN.md](PLAN.md) — план разработки и чек-лист по этапам.
- [DEPLOYMENT.md](DEPLOYMENT.md) — развёртывание через Docker и Vercel.
- [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md) — прод на своём VPS: домен, HTTPS, бэкапы.
- [deploy/ALLYSHOP_WORK.md](deploy/ALLYSHOP_WORK.md) — продолжение деплоя для **allyshop.work** (с шага 6).
- `tz_text.txt` — текстовая версия ТЗ.

## Быстрый старт (Docker)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

Фронтенд — http://localhost:5173, API — http://localhost:4000/api.
Подробности — в [DEPLOYMENT.md](DEPLOYMENT.md).
