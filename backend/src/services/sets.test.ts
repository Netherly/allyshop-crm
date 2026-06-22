import { describe, it, expect } from 'vitest';
import { computeSetAvailability } from './sets.js';

describe('computeSetAvailability', () => {
  it('минимум по составу с учётом количества', () => {
    const items = [
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 1 },
    ];
    const stock = new Map([
      [1, 5],
      [2, 3],
    ]);
    // min(5, 3) = 3
    expect(computeSetAvailability(items, stock)).toBe(3);
  });

  it('учитывает количество товара в составе (делит остаток)', () => {
    const items = [{ product_id: 1, quantity: 2 }];
    const stock = new Map([[1, 5]]);
    // floor(5 / 2) = 2
    expect(computeSetAvailability(items, stock)).toBe(2);
  });

  it('если какого-то товара нет — доступность 0', () => {
    const items = [
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 1 },
    ];
    const stock = new Map([[1, 10]]); // товара 2 нет
    expect(computeSetAvailability(items, stock)).toBe(0);
  });

  it('пустой состав — 0', () => {
    expect(computeSetAvailability([], new Map())).toBe(0);
  });

  it('ростовка 8 размеров по 1 шт', () => {
    const items = [42, 44, 46, 48, 50, 52, 54, 56].map((s, idx) => ({
      product_id: idx + 1,
      quantity: 1,
    }));
    const stock = new Map(items.map((i) => [i.product_id, 4]));
    expect(computeSetAvailability(items, stock)).toBe(4);
  });
});
