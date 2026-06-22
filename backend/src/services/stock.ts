import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { MOVEMENT_IN } from '../lib/constants.js';

// Клиент Prisma или транзакционный клиент — чтобы считать остаток внутри транзакции.
type Db = typeof prisma | Prisma.TransactionClient;

// Чистая формула остатка по списку движений (приходные типы — плюс, остальные — минус).
export function computeBalance(rows: { movement_type: string; quantity: number }[]): number {
  return rows.reduce(
    (sum, r) => sum + (MOVEMENT_IN.includes(r.movement_type) ? r.quantity : -r.quantity),
    0,
  );
}

// Считает остатки товаров по движениям:
// приход + возврат + корректировка_плюс − расход − продажа − корректировка_минус.
// Возвращает Map<product_id, остаток>. Без аргумента считает по всем товарам.
export async function getStockMap(
  productIds?: number[],
  client: Db = prisma,
): Promise<Map<number, number>> {
  const grouped = await client.stockMovement.groupBy({
    by: ['product_id', 'movement_type'],
    _sum: { quantity: true },
    where: {
      product_id: productIds ? { in: productIds } : { not: null },
    },
  });

  const stock = new Map<number, number>();
  for (const row of grouped) {
    if (row.product_id == null) continue;
    const qty = row._sum.quantity ?? 0;
    const sign = MOVEMENT_IN.includes(row.movement_type) ? 1 : -1;
    stock.set(row.product_id, (stock.get(row.product_id) ?? 0) + sign * qty);
  }
  return stock;
}

// Остаток одного товара.
export async function getProductStock(productId: number): Promise<number> {
  const map = await getStockMap([productId]);
  return map.get(productId) ?? 0;
}
