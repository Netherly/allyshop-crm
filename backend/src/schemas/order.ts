import { z } from 'zod';
import { ORDER_TYPES, ORDER_STATUSES } from '../lib/constants.js';

const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

const orderItemSchema = z
  .object({
    item_type: z.enum(['product', 'set']),
    product_id: z.coerce.number().int().positive().optional(),
    set_id: z.coerce.number().int().positive().optional(),
    quantity: z.coerce.number().int().positive(),
    // цена за единицу; если не задана — берётся из типа заказа (опт/розница)
    price: z.coerce.number().min(0).optional(),
  })
  .refine((d) => (d.item_type === 'set' ? !!d.set_id : !!d.product_id), {
    message: 'Укажите товар или набор',
  });

export const createOrderSchema = z.object({
  client_id: z.coerce.number().int().positive().nullable().optional(),
  order_type: z.enum(ORDER_TYPES),
  source: optStr,
  status: z.enum(ORDER_STATUSES).optional(),
  tags: optStr,
  comment: optStr,
  discount_amount: z.coerce.number().min(0).default(0),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  items: z.array(orderItemSchema).min(1, 'Добавьте хотя бы одну позицию'),
});

export const updateOrderSchema = z.object({
  client_id: z.coerce.number().int().positive().nullable().optional(),
  order_type: z.enum(ORDER_TYPES).optional(),
  source: optStr,
  status: z.enum(ORDER_STATUSES).optional(),
  tags: optStr,
  comment: optStr,
  discount_amount: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  items: z.array(orderItemSchema).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
