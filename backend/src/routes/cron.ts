import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { refreshActiveDeliveries } from '../services/deliveryTracking.js';

const router = Router();

// Проверка секрета крона. Vercel Cron шлёт `Authorization: Bearer <CRON_SECRET>`.
// Для ручного вызова/локально принимаем ещё и ?secret=.
function authorized(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = String(req.headers['authorization'] ?? '');
  if (header === `Bearer ${secret}`) return true;
  return String(req.query.secret ?? '') === secret;
}

// Фоновое обновление статусов активных ТТН (по расписанию). Только чтение НП.
router.get(
  '/refresh-deliveries',
  asyncHandler(async (req, res) => {
    if (!authorized(req)) {
      res.status(401).json({ error: 'Не авторизовано' });
      return;
    }
    const result = await refreshActiveDeliveries();
    res.json({ ok: true, ...result });
  }),
);

export default router;
