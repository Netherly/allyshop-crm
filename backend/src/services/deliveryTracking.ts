import { prisma } from '../lib/prisma.js';
import { trackBatch } from './novaposhta.js';

// Терминальные коды статуса НП — по ним посылку больше не опрашиваем.
// Получено/доставлено + отказ/возврат/удалено/не найдено.
const TERMINAL_CODES = new Set(['9', '10', '11', '14', '106', '2', '3', '102', '103', '104', '105', '108']);

// Обновляет статусы всех «активных» доставок (есть ТТН и статус не терминальный).
// Всё через getStatusDocuments — только чтение. Возвращает счётчики.
export async function refreshActiveDeliveries() {
  const active = await prisma.orderDelivery.findMany({
    where: {
      ttn: { not: null },
      NOT: { ttn: '' },
    },
    select: { id: true, ttn: true, status_code: true },
  });

  // Отсекаем уже терминальные (доставленные/возвраты) — их не трогаем.
  const toTrack = active.filter((d) => !d.status_code || !TERMINAL_CODES.has(d.status_code));
  if (toTrack.length === 0) return { checked: 0, updated: 0 };

  const ttns = [...new Set(toTrack.map((d) => d.ttn!.trim()).filter(Boolean))];
  const tracked = await trackBatch(ttns);

  const now = new Date();
  let updated = 0;
  for (const d of toTrack) {
    const info = tracked.get(d.ttn!.trim());
    if (!info) {
      // не нашли в ответе — просто отметим время попытки
      await prisma.orderDelivery.update({ where: { id: d.id }, data: { last_tracked_at: now } });
      continue;
    }
    await prisma.orderDelivery.update({
      where: { id: d.id },
      data: {
        delivery_status: info.delivery_status,
        status_code: info.status_code,
        np_raw_status: info.np_raw_status,
        sender_name: info.sender_name ?? undefined,
        sender_city: info.sender_city ?? undefined,
        weight: info.weight ?? undefined,
        scheduled_delivery_date: info.scheduled_delivery_date ?? undefined,
        actual_delivery_date: info.actual_delivery_date ?? undefined,
        payer_type: info.payer_type ?? undefined,
        cargo_description: info.cargo_description ?? undefined,
        last_tracked_at: now,
      },
    });
    updated += 1;
  }
  return { checked: toTrack.length, updated };
}
