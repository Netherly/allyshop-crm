import { z } from 'zod';

// Пустую строку и undefined приводим к null — чтобы уникальность SKU работала единообразно.
const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  });

const money = z.coerce.number().min(0).default(0);

export const createProductSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  article: optStr,
  barcode: optStr,
  color: optStr,
  model: optStr,
  size: optStr,
  comment: optStr,
  photo_url: optStr,
  cost_price: money,
  wholesale_price: money,
  retail_price: money,
  is_active: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
