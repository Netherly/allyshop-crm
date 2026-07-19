import { describe, it, expect } from 'vitest';
import { createSetSchema, updateSetSchema } from './set.js';

describe('createSetSchema', () => {
  it('принимает набор с товарами', () => {
    const r = createSetSchema.safeParse({ name: 'Ростовка', items: [{ product_id: 1, quantity: 2 }] });
    expect(r.success).toBe(true);
  });

  it('отклоняет набор без товаров', () => {
    const r = createSetSchema.safeParse({ name: 'Пустой', items: [] });
    expect(r.success).toBe(false);
  });

  it('отклоняет набор без поля items', () => {
    const r = createSetSchema.safeParse({ name: 'Без состава' });
    expect(r.success).toBe(false);
  });
});

describe('updateSetSchema', () => {
  it('разрешает обновление без состава (только имя)', () => {
    const r = updateSetSchema.safeParse({ name: 'Новое имя' });
    expect(r.success).toBe(true);
  });

  it('отклоняет обновление с пустым составом', () => {
    const r = updateSetSchema.safeParse({ items: [] });
    expect(r.success).toBe(false);
  });
});
