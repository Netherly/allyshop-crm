import { z } from 'zod';

const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

const itemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

export const createSetSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  description: optStr,
  is_active: z.boolean().optional(),
  items: z.array(itemSchema).default([]),
});

export const updateSetSchema = createSetSchema.partial();

export type CreateSetInput = z.infer<typeof createSetSchema>;
export type UpdateSetInput = z.infer<typeof updateSetSchema>;
