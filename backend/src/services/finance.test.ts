import { describe, it, expect } from 'vitest';
import { computePaid, computePaymentStatus } from './finance.js';

describe('computePaid', () => {
  it('суммирует приходные платежи', () => {
    expect(
      computePaid([
        { payment_type: 'предоплата', amount: 300 },
        { payment_type: 'доплата', amount: 200 },
      ]),
    ).toBe(500);
  });

  it('вычитает возврат клиенту', () => {
    expect(
      computePaid([
        { payment_type: 'полная оплата', amount: 1000 },
        { payment_type: 'возврат клиенту', amount: 400 },
      ]),
    ).toBe(600);
  });

  it('расход и другое не влияют на оплату заказа', () => {
    expect(
      computePaid([
        { payment_type: 'предоплата', amount: 500 },
        { payment_type: 'расход', amount: 999 },
        { payment_type: 'другое', amount: 999 },
      ]),
    ).toBe(500);
  });
});

describe('computePaymentStatus', () => {
  it('ноль — не оплачен', () => {
    expect(computePaymentStatus(0, 1000)).toBe('Не оплачен');
  });

  it('меньше суммы — частично', () => {
    expect(computePaymentStatus(400, 1000)).toBe('Частично оплачен');
  });

  it('равно сумме — оплачен', () => {
    expect(computePaymentStatus(1000, 1000)).toBe('Оплачен');
  });

  it('больше суммы — оплачен', () => {
    expect(computePaymentStatus(1200, 1000)).toBe('Оплачен');
  });
});
