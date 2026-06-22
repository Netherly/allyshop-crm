import { describe, it, expect } from 'vitest';
import { aggregateOrderProducts } from './orderStock.js';

describe('aggregateOrderProducts', () => {
  it('товарные строки складываются по product_id', () => {
    const items = [
      { item_type: 'product', product_id: 1, quantity: 2, components: [] },
      { item_type: 'product', product_id: 1, quantity: 3, components: [] },
      { item_type: 'product', product_id: 2, quantity: 1, components: [] },
    ];
    const map = aggregateOrderProducts(items);
    expect(map.get(1)).toBe(5);
    expect(map.get(2)).toBe(1);
  });

  it('строка-набор учитывается по компонентам', () => {
    const items = [
      {
        item_type: 'set',
        product_id: null,
        quantity: 1,
        components: [
          { product_id: 10, quantity: 2 },
          { product_id: 11, quantity: 2 },
        ],
      },
    ];
    const map = aggregateOrderProducts(items);
    expect(map.get(10)).toBe(2);
    expect(map.get(11)).toBe(2);
  });

  it('товар и набор с пересечением по товару суммируются', () => {
    const items = [
      { item_type: 'product', product_id: 10, quantity: 1, components: [] },
      { item_type: 'set', product_id: null, quantity: 1, components: [{ product_id: 10, quantity: 2 }] },
    ];
    const map = aggregateOrderProducts(items);
    expect(map.get(10)).toBe(3);
  });
});
