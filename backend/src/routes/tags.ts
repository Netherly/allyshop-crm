import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requirePermission, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Разбирает строку тегов заказа в массив (разделитель — запятая).
function parseTags(s: string | null): string[] {
  return (s ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Список всех тегов с числом заказов (для автоподсказки и управления).
router.get(
  '/',
  requirePermission('orders.view'),
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({
      where: { tags: { not: null } },
      select: { tags: true },
    });
    const counts = new Map<string, number>();
    for (const o of orders) {
      for (const t of parseTags(o.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const list = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
    res.json(list);
  }),
);

const renameSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

// Переименовать тег во всех заказах (супер-админ).
router.patch(
  '/rename',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { from, to } = renameSchema.parse(req.body);
    const orders = await prisma.order.findMany({
      where: { tags: { contains: from } },
      select: { id: true, tags: true },
    });
    let updated = 0;
    for (const o of orders) {
      const parts = parseTags(o.tags);
      if (!parts.includes(from)) continue; // contains может дать частичное совпадение — сверяем точно
      const next = [...new Set(parts.map((p) => (p === from ? to : p)))];
      await prisma.order.update({ where: { id: o.id }, data: { tags: next.join(', ') || null } });
      updated += 1;
    }
    res.json({ ok: true, updated });
  }),
);

// Удалить тег из всех заказов (супер-админ).
router.delete(
  '/:tag',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const tag = decodeURIComponent(req.params.tag);
    const orders = await prisma.order.findMany({
      where: { tags: { contains: tag } },
      select: { id: true, tags: true },
    });
    let updated = 0;
    for (const o of orders) {
      const parts = parseTags(o.tags);
      if (!parts.includes(tag)) continue;
      const next = parts.filter((p) => p !== tag);
      await prisma.order.update({ where: { id: o.id }, data: { tags: next.join(', ') || null } });
      updated += 1;
    }
    res.json({ ok: true, updated });
  }),
);

export default router;
