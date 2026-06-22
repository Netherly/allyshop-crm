import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { createClientSchema, updateClientSchema } from '../schemas/client.js';
import { parsePagination, paginated } from '../lib/pagination.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// Список клиентов с поиском, фильтром по типу контрагента и статусу.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined) ?? 'active';
    const counterpartyType = req.query.counterparty_type as string | undefined;

    const where: Prisma.ClientWhereInput = {};
    if (status === 'active') where.is_active = true;
    if (status === 'archived') where.is_active = false;
    if (counterpartyType) where.counterparty_type = counterpartyType;

    if (q) {
      const contains: Prisma.StringFilter = { contains: q, mode: 'insensitive' };
      where.OR = [{ name: contains }, { phone: contains }, { instagram: contains }, { email: contains }];
    }

    const pg = parsePagination(req.query);
    const [items, total] = await Promise.all([
      prisma.client.findMany({ where, orderBy: { id: 'desc' }, skip: pg.skip, take: pg.take }),
      prisma.client.count({ where }),
    ]);

    res.json(paginated(items, total, pg));
  }),
);

// Один клиент.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: Number(req.params.id) } });
    if (!client) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }
    res.json(client);
  }),
);

// Создание клиента.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createClientSchema.parse(req.body);
    const client = await prisma.client.create({ data });
    await logAudit({ userId: req.user!.id, entityType: 'clients', entityId: client.id, action: 'created', newValue: client });
    res.status(201).json(client);
  }),
);

// Обновление клиента.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateClientSchema.parse(req.body);
    const id = Number(req.params.id);
    const client = await prisma.client.update({ where: { id }, data });
    await logAudit({ userId: req.user!.id, entityType: 'clients', entityId: id, action: 'updated', newValue: client });
    res.json(client);
  }),
);

// Архивирование вместо удаления.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const client = await prisma.client.update({ where: { id }, data: { is_active: false } });
    await logAudit({ userId: req.user!.id, entityType: 'clients', entityId: id, action: 'deleted' });
    res.json(client);
  }),
);

export default router;
