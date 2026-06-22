import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { OrderItemInput } from '../schemas/order.js';
import { applyStockTransition } from './orderStock.js';
import { logAudit } from './audit.js';

const num = (x: Prisma.Decimal | number | null | undefined): number => Number(x ?? 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Цена товара на момент продажи: явная, иначе по типу заказа (опт — оптовая, иначе розничная).
export function selectProductPrice(
  product: { wholesale_price: Prisma.Decimal | number; retail_price: Prisma.Decimal | number },
  orderType: string,
  provided?: number | null,
): number {
  if (provided != null) return provided;
  if (orderType === 'опт') return num(product.wholesale_price);
  return num(product.retail_price);
}

// Итог заказа: подытог минус скидка в деньгах и минус процент. Не меньше нуля.
export function computeOrderTotal(
  subtotal: number,
  discountAmount: number,
  discountPercent: number,
): number {
  const percentPart = (subtotal * discountPercent) / 100;
  return Math.max(0, round2(subtotal - discountAmount - percentPart));
}

// Что включаем при отдаче заказа наружу.
export const orderInclude = {
  client: true,
  manager: { select: { id: true, full_name: true } },
  order_items: {
    include: { components: { include: { product: { select: { id: true, name: true, size: true } } } } },
  },
  finance_transactions: { orderBy: { id: 'desc' }, include: { user: { select: { full_name: true } } } },
  delivery: true,
} satisfies Prisma.OrderInclude;

type LineData = Prisma.OrderItemCreateWithoutOrderInput;

// Собирает данные одной строки заказа со снимком цены/себестоимости на момент продажи.
async function buildLine(item: OrderItemInput, orderType: string): Promise<{ data: LineData; total: number }> {
  if (item.item_type === 'product') {
    const p = await prisma.product.findUnique({ where: { id: item.product_id! } });
    if (!p) throw new AppError(400, 'Товар не найден');
    const price = selectProductPrice(p, orderType, item.price ?? null);
    const total = round2(price * item.quantity);
    return {
      total,
      data: {
        item_type: 'product',
        product: { connect: { id: p.id } },
        name: p.name,
        article: p.article,
        barcode: p.barcode,
        color: p.color,
        model: p.model,
        size: p.size,
        quantity: item.quantity,
        price,
        total,
        cost_price: num(p.cost_price),
      },
    };
  }

  // Набор: снимок состава в order_item_components, себестоимость = сумма по составу.
  const set = await prisma.set.findUnique({
    where: { id: item.set_id! },
    include: { set_items: { include: { product: true } } },
  });
  if (!set) throw new AppError(400, 'Набор не найден');
  if (set.set_items.length === 0) throw new AppError(400, 'В наборе нет товаров');

  const costPerSet = round2(
    set.set_items.reduce((s, si) => s + num(si.product.cost_price) * si.quantity, 0),
  );
  const price =
    item.price ??
    round2(set.set_items.reduce((s, si) => s + selectProductPrice(si.product, orderType, null) * si.quantity, 0));
  const total = round2(price * item.quantity);

  const components = set.set_items.map((si) => ({
    product: { connect: { id: si.product_id } },
    quantity: si.quantity * item.quantity,
    cost_price: num(si.product.cost_price),
  }));

  return {
    total,
    data: {
      item_type: 'set',
      set: { connect: { id: set.id } },
      name: set.name,
      quantity: item.quantity,
      price,
      total,
      cost_price: costPerSet,
      components: { create: components },
    },
  };
}

// Собирает строки и подытог для набора позиций.
async function buildLines(items: OrderItemInput[], orderType: string) {
  const lines: LineData[] = [];
  let subtotal = 0;
  for (const item of items) {
    const line = await buildLine(item, orderType);
    lines.push(line.data);
    subtotal += line.total;
  }
  return { lines, subtotal: round2(subtotal) };
}

interface CreateInput {
  client_id?: number | null;
  order_type: string;
  source?: string | null;
  status?: string;
  tags?: string | null;
  comment?: string | null;
  discount_amount: number;
  discount_percent: number;
  items: OrderItemInput[];
}

// Создаёт заказ со строками. order_number = id заказа (padded) — присваивается после вставки.
export async function createOrder(input: CreateInput, managerId: number) {
  const { lines, subtotal } = await buildLines(input.items, input.order_type);
  const total = computeOrderTotal(subtotal, input.discount_amount, input.discount_percent);

  const status = input.status ?? 'Новый';
  return prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        order_number: `tmp-${randomUUID()}`,
        order_type: input.order_type,
        source: input.source ?? null,
        status,
        tags: input.tags ?? null,
        comment: input.comment ?? null,
        manager_id: managerId,
        client_id: input.client_id ?? null,
        discount_amount: input.discount_amount,
        discount_percent: input.discount_percent,
        total_amount: total,
        order_items: { create: lines },
      },
    });
    const orderNumber = String(created.id).padStart(5, '0');
    await tx.order.update({ where: { id: created.id }, data: { order_number: orderNumber } });

    await logAudit({
      client: tx,
      userId: managerId,
      entityType: 'orders',
      entityId: created.id,
      action: 'created',
      newValue: { order_number: orderNumber, total_amount: total, status },
    });

    // если заказ сразу создаётся в статусе списания — спишем со склада
    await applyStockTransition(
      tx,
      { id: created.id, order_number: orderNumber, stock_written_off: false, stock_returned: false },
      status,
      managerId,
    );

    return tx.order.findUnique({ where: { id: created.id }, include: orderInclude });
  });
}

interface UpdateInput {
  client_id?: number | null;
  order_type?: string;
  source?: string | null;
  status?: string;
  tags?: string | null;
  comment?: string | null;
  discount_amount?: number;
  discount_percent?: number;
  items?: OrderItemInput[];
}

// Обновляет заказ. Если переданы позиции — пересобирает их (запрещено после списания склада).
// Смена статуса может запускать списание/возврат склада (атомарно).
export async function updateOrder(id: number, input: UpdateInput, userId: number) {
  const existing = await prisma.order.findUnique({ where: { id }, include: { order_items: true } });
  if (!existing) throw new AppError(404, 'Заказ не найден');

  if (input.items && existing.stock_written_off) {
    throw new AppError(409, 'Нельзя менять состав после списания со склада');
  }

  const orderType = input.order_type ?? existing.order_type;
  const discountAmount = input.discount_amount ?? num(existing.discount_amount);
  const discountPercent = input.discount_percent ?? num(existing.discount_percent);
  const newStatus = input.status ?? existing.status;

  return prisma.$transaction(async (tx) => {
    let subtotal: number;

    if (input.items) {
      const built = await buildLines(input.items, orderType);
      subtotal = built.subtotal;
      await tx.orderItem.deleteMany({ where: { order_id: id } });
      for (const line of built.lines) {
        await tx.orderItem.create({ data: { ...line, order: { connect: { id } } } });
      }
    } else {
      subtotal = round2(existing.order_items.reduce((s, it) => s + num(it.total), 0));
    }

    const total = computeOrderTotal(subtotal, discountAmount, discountPercent);

    await tx.order.update({
      where: { id },
      data: {
        ...(input.client_id !== undefined ? { client_id: input.client_id } : {}),
        ...(input.order_type !== undefined ? { order_type: input.order_type } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        discount_amount: discountAmount,
        discount_percent: discountPercent,
        total_amount: total,
      },
    });

    if (input.status !== undefined && newStatus !== existing.status) {
      await logAudit({
        client: tx,
        userId,
        entityType: 'orders',
        entityId: id,
        action: 'status_changed',
        oldValue: { status: existing.status },
        newValue: { status: newStatus },
      });
    } else {
      await logAudit({ client: tx, userId, entityType: 'orders', entityId: id, action: 'updated' });
    }

    // списание/возврат по новому статусу (нехватка остатка откатит транзакцию)
    await applyStockTransition(
      tx,
      {
        id,
        order_number: existing.order_number,
        stock_written_off: existing.stock_written_off,
        stock_returned: existing.stock_returned,
      },
      newStatus,
      userId,
    );

    return tx.order.findUnique({ where: { id }, include: orderInclude });
  });
}
