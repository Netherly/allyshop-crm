import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const num = (x: Prisma.Decimal | number | null | undefined): number => Number(x ?? 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Типы платежей, увеличивающие оплату заказа, и уменьшающие (возврат денег клиенту).
export const PAYMENT_IN = ['предоплата', 'полная оплата', 'доплата'];
export const PAYMENT_OUT = ['возврат клиенту'];

// Сумма оплаты заказа по операциям: приходные плюс, возвраты минус, прочее не влияет.
export function computePaid(txs: { payment_type: string; amount: Prisma.Decimal | number }[]): number {
  return round2(
    txs.reduce((s, t) => {
      if (PAYMENT_IN.includes(t.payment_type)) return s + num(t.amount);
      if (PAYMENT_OUT.includes(t.payment_type)) return s - num(t.amount);
      return s;
    }, 0),
  );
}

// Статус оплаты по сумме оплаты и сумме заказа (§14 ТЗ).
export function computePaymentStatus(paid: number, total: number): string {
  if (paid <= 0) return 'Не оплачен';
  if (paid < total) return 'Частично оплачен';
  return 'Оплачен';
}

// Пересчитывает paid_amount и payment_status заказа по подтверждённым операциям.
export async function recomputeOrderPayment(tx: Tx, orderId: number) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const txs = await tx.financeTransaction.findMany({
    where: { order_id: orderId, status: 'Подтверждена' },
  });
  const paid = computePaid(txs);
  const status = computePaymentStatus(paid, num(order.total_amount));

  await tx.order.update({
    where: { id: orderId },
    data: { paid_amount: paid, payment_status: status },
  });
}
