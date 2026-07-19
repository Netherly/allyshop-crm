import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Db = typeof prisma | Prisma.TransactionClient;

// Генерирует уникальный 8-значный штрих-код: следующий за максимальным существующим.
// Первый код — 10000001 (как в примере). Ручные/нестандартные barcode игнорируем.
export async function generateBarcode(client: Db = prisma): Promise<string> {
  const rows = await client.product.findMany({
    where: { barcode: { not: null } },
    select: { barcode: true },
  });

  let max = 10000000;
  for (const r of rows) {
    if (r.barcode && /^\d{8}$/.test(r.barcode)) {
      max = Math.max(max, Number(r.barcode));
    }
  }
  return String(max + 1);
}
