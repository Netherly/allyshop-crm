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
