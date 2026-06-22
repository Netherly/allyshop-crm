import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createSetSchema, updateSetSchema } from '../schemas/set.js';
import { getSetsAvailability } from '../services/sets.js';
import { parsePagination, paginated } from '../lib/pagination.js';

const router = Router();
router.use(requireAuth);

// Состав набора с данными товаров.
const itemsInclude = {
  set_items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          article: true,
          size: true,
          cost_price: true,
          wholesale_price: true,
          retail_price: true,
        },
      },
    },
  },
} as const;

// Список наборов с числом позиций и доступностью.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined) ?? 'active';

    const where: Prisma.SetWhereInput = {};
    if (status === 'active') where.is_active = true;
    if (status === 'archived') where.is_active = false;
    if (q) where.name = { contains: q, mode: 'insensitive' };

    const pg = parsePagination(req.query);
    const [sets, total] = await Promise.all([
      prisma.set.findMany({
        where,
        include: { _count: { select: { set_items: true } } },
        orderBy: { id: 'desc' },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.set.count({ where }),
    ]);

    const avail = await getSetsAvailability(sets.map((s) => s.id));
    res.json(
      paginated(
        sets.map((s) => ({
          ...s,
          items_count: s._count.set_items,
          availability: avail.get(s.id) ?? 0,
        })),
        total,
        pg,
      ),
    );
  }),
);

// Один набор с составом и доступностью.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const set = await prisma.set.findUnique({ where: { id }, include: itemsInclude });
    if (!set) {
      res.status(404).json({ error: 'Набор не найден' });
      return;
    }
    const avail = await getSetsAvailability([id]);
    res.json({ ...set, availability: avail.get(id) ?? 0 });
  }),
);

// Создание набора с составом (только супер-админ).
router.post(
  '/',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const data = createSetSchema.parse(req.body);
    const set = await prisma.set.create({
      data: {
        name: data.name,
        description: data.description,
        set_items: { create: data.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) },
      },
      include: itemsInclude,
    });
    res.status(201).json(set);
  }),
);

// Обновление набора. Если передан состав — заменяем его целиком.
router.patch(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = updateSetSchema.parse(req.body);

    const set = await prisma.$transaction(async (tx) => {
      await tx.set.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        },
      });
      if (data.items) {
        await tx.setItem.deleteMany({ where: { set_id: id } });
        await tx.setItem.createMany({
          data: data.items.map((i) => ({ set_id: id, product_id: i.product_id, quantity: i.quantity })),
        });
      }
      return tx.set.findUnique({ where: { id }, include: itemsInclude });
    });

    res.json(set);
  }),
);

// Архивирование вместо удаления.
router.delete(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const set = await prisma.set.update({ where: { id }, data: { is_active: false } });
    res.json(set);
  }),
);

export default router;
