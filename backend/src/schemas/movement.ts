import { z } from 'zod';

// Вручную создаются только эти типы движений.
// продажа/возврат создаются автоматически из заказов (этап 8).
export const manualMovementSchema = z
  .object({
    movement_type: z.enum(['приход', 'расход', 'корректировка_плюс', 'корректировка_минус']),
    item_type: z.enum(['product', 'set']).default('product'),
    product_id: z.coerce.number().int().positive().optional(),
    set_id: z.coerce.number().int().positive().optional(),
    quantity: z.coerce.number().int().positive('Количество должно быть больше нуля'),
    price: z.coerce.number().min(0).default(0),
    counterparty_id: z.coerce.number().int().positive().nullable().optional(),
    description: z.string().trim().optional().nullable(),
    movement_date: z.coerce.date().optional(),
  })
  .refine((d) => (d.item_type === 'set' ? !!d.set_id : !!d.product_id), {
    message: 'Укажите товар или набор',
  });

export type ManualMovementInput = z.infer<typeof manualMovementSchema>;

// Правка существующего движения: только количество, цена, товар, комментарий, дата.
// Тип движения и «наборность» не меняем — иначе пришлось бы пересобирать компоненты.
export const updateMovementSchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().positive('Количество должно быть больше нуля').optional(),
  price: z.coerce.number().min(0).optional(),
  description: z.string().trim().nullable().optional(),
  movement_date: z.coerce.date().optional(),
});

export type UpdateMovementInput = z.infer<typeof updateMovementSchema>;
