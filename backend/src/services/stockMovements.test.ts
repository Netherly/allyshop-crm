import { describe, it, expect } from 'vitest';
import { expandSet } from './stockMovements.js';

describe('expandSet', () => {
  it('разворачивает набор с учётом количества состава и множителя', () => {
    const setItems = [
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 2 },
    ];
    // 1 набор: товар1×1, товар2×2
    expect(expandSet(setItems, 1)).toEqual([
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 2 },
    ]);
    // 3 набора: количества умножаются на 3
    expect(expandSet(setItems, 3)).toEqual([
      { product_id: 1, quantity: 3 },
      { product_id: 2, quantity: 6 },
    ]);
  });

  it('пустой состав даёт пустой список', () => {
    expect(expandSet([], 5)).toEqual([]);
  });
});
