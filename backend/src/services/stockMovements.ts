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

// Удаляет движение. Остаток пересчитывается из движений; проверяем, что не ушли в минус.
export async function deleteMovement(id: number) {
  const existing = await prisma.stockMovement.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Движение не найдено');
  if (existing.order_id) throw new AppError(409, 'Движение относится к заказу — удаляйте через заказ');

  return prisma.$transaction(async (tx) => {
    await tx.stockMovement.delete({ where: { id } });
    if (existing.product_id != null) {
      const stock = await getStockMap([existing.product_id], tx);
      if ((stock.get(existing.product_id) ?? 0) < 0) {
        throw new AppError(409, 'Удаление приведёт к отрицательному остатку');
      }
    }
    return { ok: true };
  });
}

interface BulkLine {
  item_type: 'product' | 'set';
  product_id?: number;
  set_id?: number;
  quantity: number;
  price: number;
}

// Массовое создание движений: каждая строка (пик) — отдельная запись; наборы разворачиваем.
// Для расходных типов проверяем суммарный остаток по всем затронутым товарам.
export async function createBulkMovements(
  input: { movement_type: string; items: BulkLine[] },
  userId: number,
) {
  // Готовим итоговые движения, раскрывая наборы на товары.
  const movements: { product_id: number; set_id: number | null; quantity: number; price: number }[] = [];
  for (const line of input.items) {
    if (line.item_type === 'set') {
      const set = await prisma.set.findUnique({
        where: { id: line.set_id! },
        include: { set_items: true },
      });
      if (!set) throw new AppError(404, 'Набор не найден');
      if (set.set_items.length === 0) throw new AppError(400, 'В наборе нет товаров');
      for (const si of set.set_items) {
        movements.push({
          product_id: si.product_id,
          set_id: set.id,
          quantity: si.quantity * line.quantity,
          price: 0,
        });
      }
    } else {
      movements.push({ product_id: line.product_id!, set_id: null, quantity: line.quantity, price: line.price });
    }
  }

  // Для расходных движений проверяем суммарную нехватку.
  if (MOVEMENT_OUT.includes(input.movement_type)) {
    const need = new Map<number, number>();
    for (const m of movements) need.set(m.product_id, (need.get(m.product_id) ?? 0) + m.quantity);
    const stock = await getStockMap([...need.keys()]);
    const shortages = [...need.entries()]
      .map(([product_id, n]) => ({ product_id, need: n, have: stock.get(product_id) ?? 0 }))
      .filter((s) => s.have < s.need);
    if (shortages.length > 0) throw new AppError(409, 'Недостаточно остатка', { shortages });
  }

  const date = new Date();
  return prisma.$transaction(
    movements.map((m) =>
      prisma.stockMovement.create({
        data: {
          movement_date: date,
          movement_type: input.movement_type,
          product_id: m.product_id,
          set_id: m.set_id,
          quantity: m.quantity,
          price: m.price,
          total: m.price * m.quantity,
          user_id: userId,
          description: 'Ввод по штрих-коду',
        },
      }),
    ),
  );
}

interface UpdateInput {
  product_id?: number;
  quantity?: number;
  price?: number;
  description?: string | null;
  movement_date?: Date;
}

// Правит существующее движение. Остаток пересчитывается из движений автоматически,
// поэтому после правки просто проверяем, что затронутые товары не ушли в минус.
export async function updateMovement(id: number, input: UpdateInput, _userId: number) {
  const existing = await prisma.stockMovement.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Движение не найдено');
  if (existing.order_id) {
    throw new AppError(409, 'Движение относится к заказу — правьте через заказ');
  }

  const quantity = input.quantity ?? existing.quantity;
  const price = input.price ?? Number(existing.price);
  const productId = input.product_id ?? existing.product_id;

  return prisma.$transaction(async (tx) => {
    await tx.stockMovement.update({
      where: { id },
      data: {
        product_id: productId,
        quantity,
        price,
        total: price * quantity,
        description: input.description !== undefined ? input.description : existing.description,
        movement_date: input.movement_date ?? existing.movement_date,
      },
    });

    // Затронутые товары: старый и новый (если менялся) — ни один не должен уйти в минус.
    const affected = [...new Set([existing.product_id, productId].filter((x): x is number => x != null))];
    const stock = await getStockMap(affected, tx);
    if (affected.some((pid) => (stock.get(pid) ?? 0) < 0)) {
      throw new AppError(409, 'Правка приведёт к отрицательному остатку');
    }

    return tx.stockMovement.findUnique({ where: { id } });
  });
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
