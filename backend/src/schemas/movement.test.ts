import { describe, it, expect } from 'vitest';
import { updateMovementSchema } from './movement.js';

describe('updateMovementSchema', () => {
  it('разрешает менять тип движения', () => {
    const r = updateMovementSchema.safeParse({ movement_type: 'расход' });
    expect(r.success).toBe(true);
  });

  it('принимает корректировки как тип', () => {
    for (const t of ['приход', 'расход', 'корректировка_плюс', 'корректировка_минус']) {
      expect(updateMovementSchema.safeParse({ movement_type: t }).success).toBe(true);
    }
  });

  it('отклоняет неизвестный тип движения', () => {
    const r = updateMovementSchema.safeParse({ movement_type: 'продажа' });
    expect(r.success).toBe(false);
  });

  it('все поля необязательны — пустая правка валидна', () => {
    expect(updateMovementSchema.safeParse({}).success).toBe(true);
  });

  it('разрешает менять всё сразу: тип, товар, количество, цену, комментарий', () => {
    const r = updateMovementSchema.safeParse({
      movement_type: 'приход',
      product_id: 5,
      quantity: 3,
      price: 120.5,
      description: 'правка',
    });
    expect(r.success).toBe(true);
  });

  it('отклоняет нулевое/отрицательное количество', () => {
    expect(updateMovementSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(updateMovementSchema.safeParse({ quantity: -2 }).success).toBe(false);
  });
});
