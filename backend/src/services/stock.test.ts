import { describe, it, expect } from 'vitest';
import { computeBalance } from './stock.js';

describe('computeBalance', () => {
  it('складывает приходные и вычитает расходные движения', () => {
    const rows = [
      { movement_type: 'приход', quantity: 10 },
      { movement_type: 'возврат', quantity: 2 },
      { movement_type: 'корректировка_плюс', quantity: 3 },
      { movement_type: 'продажа', quantity: 4 },
      { movement_type: 'расход', quantity: 1 },
      { movement_type: 'корректировка_минус', quantity: 2 },
    ];
    // 10 + 2 + 3 − 4 − 1 − 2 = 8
    expect(computeBalance(rows)).toBe(8);
  });

  it('пустой список даёт ноль', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('может уходить в минус при перерасходе', () => {
    expect(computeBalance([{ movement_type: 'продажа', quantity: 5 }])).toBe(-5);
  });
});
