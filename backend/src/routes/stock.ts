import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { manualMovementSchema, updateMovementSchema, bulkMovementSchema } from '../schemas/movement.js';
import { createManualMovement, updateMovement, createBulkMovements } from '../services/stockMovements.js';
import { parsePagination, paginated } from '../lib/pagination.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

const CORRECTIONS = ['корректировка_плюс', 'корректировка_минус'];

// Журнал движений с фильтрами по товару и типу.
router.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const where: Prisma.StockMovementWhereInput = {};
    if (req.query.product_id) where.product_id = Number(req.query.product_id);
    if (req.query.movement_type) where.movement_type = String(req.query.movement_type);

    const pg = parsePagination(req.query);
    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, article: true, size: true, color: true, model: true } },
          set: { select: { name: true } },
          user: { select: { full_name: true } },
          counterparty: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json(paginated(items, total, pg));
  }),
);

// Создание движения вручную. Корректировки — только супер-админ.
router.post(
  '/movements',
  asyncHandler(async (req, res) => {
    const data = manualMovementSchema.parse(req.body);

    if (CORRECTIONS.includes(data.movement_type) && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Корректировки склада доступны только супер-админу' });
      return;
    }

    const created = await createManualMovement(
      { ...data, counterparty_id: data.counterparty_id ?? null },
      req.user!.id,
    );
    await logAudit({
      userId: req.user!.id,
      entityType: 'stock',
      entityId: data.product_id ?? data.set_id ?? 0,
      action: 'created',
      newValue: { movement_type: data.movement_type, item_type: data.item_type, quantity: data.quantity },
    });
    res.status(201).json(created);
  }),
);

// Массовое создание движений сканированием штрих-кодов (каждый пик — отдельная запись).
router.post(
  '/movements/bulk',
  asyncHandler(async (req, res) => {
    const data = bulkMovementSchema.parse(req.body);

    if (CORRECTIONS.includes(data.movement_type) && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Корректировки склада доступны только супер-админу' });
      return;
    }

    const created = await createBulkMovements(data, req.user!.id);
    await logAudit({
      userId: req.user!.id,
      entityType: 'stock',
      entityId: 0,
      action: 'created',
      newValue: { movement_type: data.movement_type, scanned: data.items.length },
    });
    res.status(201).json({ count: created.length });
  }),
);

// Правка движения. Корректировки — только супер-админ; движения по заказу править нельзя.
router.patch(
  '/movements/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.stockMovement.findUnique({
      where: { id },
      select: { movement_type: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Движение не найдено' });
      return;
    }
    if (CORRECTIONS.includes(existing.movement_type) && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Корректировки склада доступны только супер-админу' });
      return;
    }

    const data = updateMovementSchema.parse(req.body);
    const updated = await updateMovement(id, data, req.user!.id);
    await logAudit({
      userId: req.user!.id,
      entityType: 'stock',
      entityId: id,
      action: 'updated',
      newValue: { quantity: data.quantity, price: data.price },
    });
    res.json(updated);
  }),
);

export default router;
