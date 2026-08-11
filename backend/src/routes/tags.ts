import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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

// Считает, в скольких заказах встречается каждый тег.
async function orderTagCounts(): Promise<Map<string, number>> {
  const orders = await prisma.order.findMany({
    where: { tags: { not: null } },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const o of orders) {
    for (const t of parseTags(o.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

// Список сохранённых тегов (справочник) с числом заказов — для автоподсказки и управления.
router.get(
  '/',
  requirePermission('orders.view'),
  asyncHandler(async (_req, res) => {
    const [tags, counts] = await Promise.all([
      prisma.tag.findMany({ orderBy: { name: 'asc' } }),
      orderTagCounts(),
    ]);
    res.json(tags.map((t) => ({ tag: t.name, count: counts.get(t.name) ?? 0 })));
  }),
);

const createSchema = z.object({ name: z.string().trim().min(1, 'Укажите название') });

// Создать сохранённый тег (супер-админ).
router.post(
  '/',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    try {
      const tag = await prisma.tag.create({ data: { name } });
      res.status(201).json({ tag: tag.name, count: 0 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        res.status(409).json({ error: 'Такой тег уже есть' });
        return;
      }
      throw e;
    }
  }),
);

const renameSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

// Переименовать тег в справочнике и во всех заказах (супер-админ).
router.patch(
  '/rename',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { from, to } = renameSchema.parse(req.body);

    // Справочник: если целевое имя уже есть — сливаем (удаляем исходный), иначе переименовываем.
    const [fromRow, toRow] = await Promise.all([
      prisma.tag.findUnique({ where: { name: from } }),
      prisma.tag.findUnique({ where: { name: to } }),
    ]);
    if (fromRow) {
      if (toRow) await prisma.tag.delete({ where: { name: from } });
      else await prisma.tag.update({ where: { name: from }, data: { name: to } });
    } else if (!toRow) {
      await prisma.tag.create({ data: { name: to } });
    }

    // Заказы: заменяем тег в строках.
    const orders = await prisma.order.findMany({
      where: { tags: { contains: from } },
      select: { id: true, tags: true },
    });
    let updated = 0;
    for (const o of orders) {
      const parts = parseTags(o.tags);
      if (!parts.includes(from)) continue;
      const next = [...new Set(parts.map((p) => (p === from ? to : p)))];
      await prisma.order.update({ where: { id: o.id }, data: { tags: next.join(', ') || null } });
      updated += 1;
    }
    res.json({ ok: true, updated });
  }),
);

// Удалить тег из справочника и из всех заказов (супер-админ).
router.delete(
  '/:tag',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const tag = decodeURIComponent(req.params.tag);
    await prisma.tag.deleteMany({ where: { name: tag } });

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
