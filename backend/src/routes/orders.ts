import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { createOrderSchema, updateOrderSchema } from '../schemas/order.js';
import { deliverySchema } from '../schemas/delivery.js';
import { createOrder, updateOrder, orderInclude } from '../services/orders.js';
import { parsePagination, paginated } from '../lib/pagination.js';

const router = Router();
router.use(requireAuth);

// Список заказов с фильтрами по статусу, типу, источнику и поиском.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const where: Prisma.OrderWhereInput = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.order_type) where.order_type = String(req.query.order_type);
    if (req.query.source) where.source = String(req.query.source);
    if (req.query.payment_status) where.payment_status = String(req.query.payment_status);
    if (q) {
      where.OR = [
        { order_number: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const pg = parsePagination(req.query);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: { select: { name: true } },
          manager: { select: { full_name: true } },
          _count: { select: { order_items: true } },
        },
        orderBy: { id: 'desc' },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json(
      paginated(
        items.map((o) => ({ ...o, items_count: o._count.order_items })),
        total,
        pg,
      ),
    );
  }),
);

// Полный заказ со строками, компонентами, клиентом, доставкой.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: orderInclude,
    });
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    res.json(order);
  }),
);

// Создание заказа.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    const order = await createOrder(data, req.user!.id);
    res.status(201).json(order);
  }),
);

// Доставка заказа (создать/обновить). Ручной ввод ТТН и статуса (API НП — позже).
router.put(
  '/:id/delivery',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    const data = deliverySchema.parse(req.body);
    const delivery = await prisma.orderDelivery.upsert({
      where: { order_id: orderId },
      create: { order_id: orderId, ...data },
      update: data,
    });
    res.json(delivery);
  }),
);

// Обновление заказа (шапка и при необходимости состав).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateOrderSchema.parse(req.body);
    const order = await updateOrder(Number(req.params.id), data, req.user!.id);
    res.json(order);
  }),
);

export default router;
