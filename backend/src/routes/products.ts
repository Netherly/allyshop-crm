import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createProductSchema, updateProductSchema } from '../schemas/product.js';
import { getStockMap } from '../services/stock.js';
import { parsePagination, paginated } from '../lib/pagination.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// Ищет товар-дубль по ключу уникальности (article+color+model+size).
async function findDuplicate(
  key: { article: string | null; color: string | null; model: string | null; size: string | null },
  excludeId?: number,
) {
  return prisma.product.findFirst({
    where: {
      article: key.article,
      color: key.color,
      model: key.model,
      size: key.size,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

// Список товаров с поиском, фильтром по статусу и текущим остатком.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined) ?? 'active';

    const where: Prisma.ProductWhereInput = {};
    if (status === 'active') where.is_active = true;
    if (status === 'archived') where.is_active = false;

    if (q) {
      const contains: Prisma.StringFilter = { contains: q, mode: 'insensitive' };
      where.OR = [
        { name: contains },
        { article: contains },
        { barcode: contains },
        { color: contains },
        { model: contains },
        { size: contains },
      ];
    }

    const pg = parsePagination(req.query);
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { id: 'desc' }, skip: pg.skip, take: pg.take }),
      prisma.product.count({ where }),
    ]);
    // остаток считаем только для товаров текущей страницы
    const stock = await getStockMap(products.map((p) => p.id));

    res.json(paginated(products.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 })), total, pg));
  }),
);

// Один товар с остатком.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }
    const stock = await getStockMap([id]);
    res.json({ ...product, stock: stock.get(id) ?? 0 });
  }),
);

// Создание товара (только супер-админ).
router.post(
  '/',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body);

    const dup = await findDuplicate({
      article: data.article,
      color: data.color,
      model: data.model,
      size: data.size,
    });
    if (dup) {
      res.status(409).json({ error: 'Товар с таким артикулом, цветом, моделью и размером уже есть' });
      return;
    }

    const product = await prisma.product.create({ data });
    await logAudit({ userId: req.user!.id, entityType: 'products', entityId: product.id, action: 'created', newValue: product });
    res.status(201).json({ ...product, stock: 0 });
  }),
);

// Обновление товара (только супер-админ).
router.patch(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = updateProductSchema.parse(req.body);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    // Ключ уникальности — из новых значений, где переданы, иначе из текущих.
    const key = {
      article: data.article !== undefined ? data.article : existing.article,
      color: data.color !== undefined ? data.color : existing.color,
      model: data.model !== undefined ? data.model : existing.model,
      size: data.size !== undefined ? data.size : existing.size,
    };
    const dup = await findDuplicate(key, id);
    if (dup) {
      res.status(409).json({ error: 'Товар с таким артикулом, цветом, моделью и размером уже есть' });
      return;
    }

    const product = await prisma.product.update({ where: { id }, data });
    await logAudit({ userId: req.user!.id, entityType: 'products', entityId: id, action: 'updated', oldValue: existing, newValue: product });
    const stock = await getStockMap([id]);
    res.json({ ...product, stock: stock.get(id) ?? 0 });
  }),
);

// Архивирование (is_active=false) вместо удаления.
router.delete(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = await prisma.product.update({ where: { id }, data: { is_active: false } });
    await logAudit({ userId: req.user!.id, entityType: 'products', entityId: id, action: 'deleted' });
    res.json(product);
  }),
);

export default router;
