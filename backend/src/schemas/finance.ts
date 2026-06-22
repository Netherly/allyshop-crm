import { z } from 'zod';
import { PAYMENT_TYPES } from '../lib/constants.js';

const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

export const createFinanceSchema = z.object({
  order_id: z.coerce.number().int().positive().nullable().optional(),
  payment_type: z.enum(PAYMENT_TYPES),
  amount: z.coerce.number().positive('Сумма должна быть больше нуля'),
  comment: optStr,
  date_time: z.coerce.date().optional(),
});

export type CreateFinanceInput = z.infer<typeof createFinanceSchema>;
