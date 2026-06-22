import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getStockMap } from '../services/stock.js';

const router = Router();
router.use(requireAuth);

const LOW_STOCK = 3; // порог низкого остатка

// Сводка для рабочего стола: показатели, низкие остатки, последние заказы.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [ordersTotal, productsCount, clientsCount, paidAgg, openAgg, recent, products] =
      await Promise.all([
        prisma.order.count(),
        prisma.product.count({ where: { is_active: true } }),
        prisma.client.count({ where: { is_active: true } }),
        prisma.order.aggregate({ _sum: { paid_amount: true } }),
        // суммы по незакрытым заказам — для расчёта «к доплате»
        prisma.order.aggregate({
          where: { status: { notIn: ['Отменен', 'Завершен'] } },
          _sum: { total_amount: true, paid_amount: true },
        }),
        prisma.order.findMany({
          orderBy: { id: 'desc' },
          take: 5,
          include: { client: { select: { name: true } } },
        }),
        prisma.product.findMany({
          where: { is_active: true },
          select: { id: true, name: true, article: true, size: true },
        }),
      ]);

    const stock = await getStockMap(products.map((p) => p.id));
    const lowStock = products
      .map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }))
      .filter((p) => p.stock <= LOW_STOCK)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const revenue = Number(paidAgg._sum.paid_amount ?? 0);
    const toPay = Math.max(
      0,
      Number(openAgg._sum.total_amount ?? 0) - Number(openAgg._sum.paid_amount ?? 0),
    );

    res.json({
      orders_total: ordersTotal,
      products_count: productsCount,
      clients_count: clientsCount,
      revenue,
      to_pay: toPay,
      low_stock: lowStock,
      recent_orders: recent.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        client: o.client?.name ?? null,
        status: o.status,
        total_amount: o.total_amount,
        created_at: o.created_at,
      })),
    });
  }),
);

export default router;
