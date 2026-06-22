import { prisma } from '../lib/prisma.js';
import { MOVEMENT_OUT } from '../lib/constants.js';
import { AppError } from '../lib/errors.js';
import { getStockMap } from './stock.js';

// Разворачивает набор в список товаров: количество каждого = состав × множитель.
export function expandSet(
  setItems: { product_id: number; quantity: number }[],
  multiplier: number,
): { product_id: number; quantity: number }[] {
  return setItems.map((si) => ({ product_id: si.product_id, quantity: si.quantity * multiplier }));
}

interface MovementInput {
  movement_type: string;
  item_type: 'product' | 'set';
  product_id?: number;
  set_id?: number;
  quantity: number;
  price: number;
  counterparty_id?: number | null;
  description?: string | null;
  movement_date?: Date;
  order_id?: number | null;
}

// Создаёт движение(я). Набор раскладывается на товары; для расходных типов проверяется остаток.
export async function createManualMovement(input: MovementInput, userId: number) {
  let items: { product_id: number; quantity: number; price: number }[];

  if (input.item_type === 'set') {
    const set = await prisma.set.findUnique({
      where: { id: input.set_id! },
      include: { set_items: true },
    });
    if (!set) throw new AppError(404, 'Набор не найден');
    if (set.set_items.length === 0) throw new AppError(400, 'В наборе нет товаров');
    // цена набора не делится по товарам — у компонентных движений price = 0
    items = expandSet(set.set_items, input.quantity).map((i) => ({ ...i, price: 0 }));
  } else {
    items = [{ product_id: input.product_id!, quantity: input.quantity, price: input.price }];
  }

  // Для расходных движений проверяем наличие каждого товара.
  if (MOVEMENT_OUT.includes(input.movement_type)) {
    const stock = await getStockMap(items.map((i) => i.product_id));
    const shortages = items
      .map((it) => ({ product_id: it.product_id, need: it.quantity, have: stock.get(it.product_id) ?? 0 }))
      .filter((s) => s.have < s.need);
    if (shortages.length > 0) {
      throw new AppError(409, 'Недостаточно остатка', { shortages });
    }
  }

  const date = input.movement_date ?? new Date();
  return prisma.$transaction(
    items.map((it) =>
      prisma.stockMovement.create({
        data: {
          movement_date: date,
          movement_type: input.movement_type,
          product_id: it.product_id,
          set_id: input.item_type === 'set' ? input.set_id : null,
          quantity: it.quantity,
          price: it.price,
          total: it.price * it.quantity,
          counterparty_id: input.counterparty_id ?? null,
          order_id: input.order_id ?? null,
          description: input.description ?? null,
          user_id: userId,
        },
      }),
    ),
  );
}
