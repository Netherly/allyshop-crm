import { prisma } from '../lib/prisma.js';
import { getStockMap } from './stock.js';

// Доступность набора = минимум по составу из floor(остаток_товара / количество_в_составе).
// Если состав пуст — 0.
export function computeSetAvailability(
  items: { product_id: number; quantity: number }[],
  stock: Map<number, number>,
): number {
  if (items.length === 0) return 0;
  return Math.min(
    ...items.map((i) => {
      if (i.quantity <= 0) return 0;
      return Math.floor((stock.get(i.product_id) ?? 0) / i.quantity);
    }),
  );
}

// Считает доступность для нескольких наборов разом (один проход по остаткам).
export async function getSetsAvailability(setIds: number[]): Promise<Map<number, number>> {
  if (setIds.length === 0) return new Map();

  const setItems = await prisma.setItem.findMany({ where: { set_id: { in: setIds } } });
  const productIds = [...new Set(setItems.map((i) => i.product_id))];
  const stock = await getStockMap(productIds);

  const bySet = new Map<number, { product_id: number; quantity: number }[]>();
  for (const it of setItems) {
    const arr = bySet.get(it.set_id) ?? [];
    arr.push({ product_id: it.product_id, quantity: it.quantity });
    bySet.set(it.set_id, arr);
  }

  const result = new Map<number, number>();
  for (const id of setIds) {
    result.set(id, computeSetAvailability(bySet.get(id) ?? [], stock));
  }
  return result;
}
