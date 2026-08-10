import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getStockMap } from '../services/stock.js';

const router = Router();
router.use(requireAuth, requirePermission('dashboard.view'));

const LOW_STOCK = 3; // порог низкого остатка

// Сводка для рабочего стола: показатели, низкие остатки, последние заказы.
// Фильтры: from/to (по дате заказа), order_type (опт/дроп/розница).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Фильтр по заказам из query. Товары/клиенты считаем без фильтра (это справочники).
    const orderWhere: Prisma.OrderWhereInput = {};
    if (req.query.order_type) orderWhere.order_type = String(req.query.order_type);
    if (req.query.status) orderWhere.status = String(req.query.status);
    if (req.query.payment_status) orderWhere.payment_status = String(req.query.payment_status);
    if (req.query.source) orderWhere.source = String(req.query.source);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if (from || to) {
      orderWhere.order_date = {};
      if (from && !Number.isNaN(from.getTime())) orderWhere.order_date.gte = from;
      // включаем весь день «to» — сдвигаем на конец суток
      if (to && !Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        orderWhere.order_date.lte = to;
      }
    }

    const [
      ordersTotal,
      productsCount,
      clientsCount,
      unpaidCount,
      paidAgg,
      turnoverAgg,
      openAgg,
      statusGroup,
      sourceGroup,
      orderItems,
      recent,
      products,
      deliveries,
    ] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.product.count({ where: { is_active: true } }),
      prisma.client.count({ where: { is_active: true } }),
      prisma.order.count({ where: { ...orderWhere, payment_status: { not: 'Оплачен' } } }),
      prisma.order.aggregate({ where: orderWhere, _sum: { paid_amount: true } }),
      // оборот — сумма заказов (в отличие от выручки, это начисленное, не оплаченное)
      prisma.order.aggregate({ where: orderWhere, _sum: { total_amount: true } }),
      // суммы по незакрытым заказам — для расчёта «к доплате»
      prisma.order.aggregate({
        where: { ...orderWhere, status: { notIn: ['Отменен', 'Завершен'] } },
        _sum: { total_amount: true, paid_amount: true },
      }),
      // разбивка заказов по статусам
      prisma.order.groupBy({ by: ['status'], where: orderWhere, _count: { _all: true } }),
      // разбивка заказов по источнику
      prisma.order.groupBy({ by: ['source'], where: orderWhere, _count: { _all: true } }),
      // строки заказов за период — для валовой прибыли (выручка минус себестоимость)
      prisma.orderItem.findMany({
        where: { order: orderWhere },
        select: { total: true, cost_price: true, quantity: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        orderBy: { id: 'desc' },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      prisma.product.findMany({
        where: { is_active: true },
        select: { id: true, name: true, article: true, size: true, color: true, model: true },
      }),
      // доставки с ТТН (для сводки по статусам НП) — с учётом фильтра заказов
      prisma.orderDelivery.findMany({
        where: { ttn: { not: null }, NOT: { ttn: '' }, order: orderWhere },
        select: { status_code: true },
      }),
    ]);

    // Сводка доставок НП по фазам (коды статусов getStatusDocuments).
    const deliveryBuckets = { in_transit: 0, arrived: 0, delivered: 0, returned: 0, other: 0 };
    for (const d of deliveries) {
      const c = d.status_code ?? '';
      if (['9', '10', '11', '14', '106'].includes(c)) deliveryBuckets.delivered += 1;
      else if (['7', '8'].includes(c)) deliveryBuckets.arrived += 1;
      else if (['4', '5', '41', '101'].includes(c)) deliveryBuckets.in_transit += 1;
      else if (['2', '3', '102', '103', '104', '105', '108'].includes(c)) deliveryBuckets.returned += 1;
      else deliveryBuckets.other += 1;
    }

    const stock = await getStockMap(products.map((p) => p.id));
    const lowStock = products
      .map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }))
      .filter((p) => p.stock <= LOW_STOCK)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const revenue = Number(paidAgg._sum.paid_amount ?? 0);
    const turnover = Number(turnoverAgg._sum.total_amount ?? 0);
    const avgCheck = ordersTotal > 0 ? Math.round((turnover / ordersTotal) * 100) / 100 : 0;
    const toPay = Math.max(
      0,
      Number(openAgg._sum.total_amount ?? 0) - Number(openAgg._sum.paid_amount ?? 0),
    );
    // валовая прибыль = сумма (выручка строки − себестоимость × кол-во)
    const profit = orderItems.reduce(
      (s, it) => s + Number(it.total) - Number(it.cost_price) * it.quantity,
      0,
    );
    const statusBreakdown = statusGroup
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => b.count - a.count);
    const sourceBreakdown = sourceGroup
      .map((g) => ({ source: g.source ?? 'Не указан', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    res.json({
      orders_total: ordersTotal,
      products_count: productsCount,
      clients_count: clientsCount,
      unpaid_count: unpaidCount,
      revenue,
      turnover,
      avg_check: avgCheck,
      profit: Math.round(profit * 100) / 100,
      to_pay: toPay,
      status_breakdown: statusBreakdown,
      source_breakdown: sourceBreakdown,
      delivery_breakdown: deliveryBuckets,
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
