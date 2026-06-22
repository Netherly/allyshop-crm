import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { createFinanceSchema } from '../schemas/finance.js';
import { recomputeOrderPayment } from '../services/finance.js';
import { parsePagination, paginated } from '../lib/pagination.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// Журнал финансовых операций с фильтрами по типу и заказу.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where: Prisma.FinanceTransactionWhereInput = {};
    if (req.query.payment_type) where.payment_type = String(req.query.payment_type);
    if (req.query.order_id) where.order_id = Number(req.query.order_id);

    const pg = parsePagination(req.query);
    const [items, total] = await Promise.all([
      prisma.financeTransaction.findMany({
        where,
        include: { user: { select: { full_name: true } } },
        orderBy: { id: 'desc' },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.financeTransaction.count({ where }),
    ]);

    res.json(paginated(items, total, pg));
  }),
);

// Создание операции. Если привязана к заказу — пересчитываем его оплату.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createFinanceSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      let orderNumber: string | null = null;
      if (data.order_id) {
        const order = await tx.order.findUnique({ where: { id: data.order_id } });
        if (!order) throw new Error('order_not_found');
        orderNumber = order.order_number;
      }

      const created = await tx.financeTransaction.create({
        data: {
          order_id: data.order_id ?? null,
          order_number: orderNumber,
          payment_type: data.payment_type,
          amount: data.amount,
          comment: data.comment ?? null,
          status: 'Подтверждена',
          user_id: req.user!.id,
          ...(data.date_time ? { date_time: data.date_time } : {}),
        },
      });

      if (data.order_id) {
        await recomputeOrderPayment(tx, data.order_id);
        await logAudit({
          client: tx,
          userId: req.user!.id,
          entityType: 'orders',
          entityId: data.order_id,
          action: 'payment_added',
          newValue: { payment_type: data.payment_type, amount: data.amount },
        });
      }
      return created;
    });

    res.status(201).json(result);
  }),
);

// Удаление операции с пересчётом оплаты связанного заказа.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      const tr = await tx.financeTransaction.findUnique({ where: { id } });
      if (!tr) return;
      await tx.financeTransaction.delete({ where: { id } });
      if (tr.order_id) await recomputeOrderPayment(tx, tr.order_id);
    });
    res.json({ ok: true });
  }),
);

export default router;
