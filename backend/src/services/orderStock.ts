import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { WRITE_OFF_STATUS, RETURN_STATUSES } from '../lib/constants.js';
import { getStockMap } from './stock.js';
import { logAudit } from './audit.js';

type Tx = Prisma.TransactionClient;

interface ItemWithComponents {
  item_type: string;
  product_id: number | null;
  quantity: number;
  components: { product_id: number; quantity: number }[];
}

// Сколько каждого товара в заказе: товары напрямую + компоненты наборов.
export function aggregateOrderProducts(items: ItemWithComponents[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const it of items) {
    if (it.item_type === 'set') {
      for (const c of it.components) {
        map.set(c.product_id, (map.get(c.product_id) ?? 0) + c.quantity);
      }
    } else if (it.product_id != null) {
      map.set(it.product_id, (map.get(it.product_id) ?? 0) + it.quantity);
    }
  }
  return map;
}

interface OrderFlags {
  id: number;
  order_number: string;
  stock_written_off: boolean;
  stock_returned: boolean;
}

// Применяет складской переход по новому статусу заказа (внутри транзакции).
// Списание — при статусе «Собирается». Возврат — при «Отменен»/«Возврат» (если был списан).
// Повторное списание/возврат не выполняется. Нехватка остатка откатывает всю транзакцию.
export async function applyStockTransition(
  tx: Tx,
  order: OrderFlags,
  newStatus: string,
  userId: number,
) {
  const isWriteOff = newStatus === WRITE_OFF_STATUS;
  const isReturn = RETURN_STATUSES.includes(newStatus);

  if (isWriteOff && !order.stock_written_off) {
    const items = await tx.orderItem.findMany({
      where: { order_id: order.id },
      include: { components: true },
    });
    const productQty = aggregateOrderProducts(items);
    const ids = [...productQty.keys()];
    const stock = await getStockMap(ids, tx);

    const shortages = [...productQty.entries()]
      .map(([product_id, need]) => ({ product_id, need, have: stock.get(product_id) ?? 0 }))
      .filter((s) => s.have < s.need);
    if (shortages.length > 0) {
      throw new AppError(409, 'Недостаточно остатка для списания заказа', { shortages });
    }

    for (const [product_id, quantity] of productQty) {
      await tx.stockMovement.create({
        data: {
          movement_type: 'продажа',
          product_id,
          quantity,
          order_id: order.id,
          user_id: userId,
          description: `Списание по заказу ${order.order_number}`,
        },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { stock_written_off: true } });
    await logAudit({
      client: tx,
      userId,
      entityType: 'orders',
      entityId: order.id,
      action: 'stock_written_off',
      newValue: Object.fromEntries(productQty),
    });
    return;
  }

  if (isReturn && order.stock_written_off && !order.stock_returned) {
    const items = await tx.orderItem.findMany({
      where: { order_id: order.id },
      include: { components: true },
    });
    const productQty = aggregateOrderProducts(items);

    for (const [product_id, quantity] of productQty) {
      await tx.stockMovement.create({
        data: {
          movement_type: 'возврат',
          product_id,
          quantity,
          order_id: order.id,
          user_id: userId,
          description: `Возврат по заказу ${order.order_number}`,
        },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { stock_returned: true } });
    await logAudit({
      client: tx,
      userId,
      entityType: 'orders',
      entityId: order.id,
      action: 'stock_returned',
      newValue: Object.fromEntries(productQty),
    });
  }
}
