import { z } from 'zod';

const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

// Кто платит доставку: клиент или компания (или не указано).
const payer = z
  .union([z.enum(['клиент', 'компания']), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v === '' || v == null ? null : v));

export const deliverySchema = z.object({
  recipient_name: optStr,
  recipient_phone: optStr,
  city: optStr,
  branch: optStr,
  ttn: optStr,
  delivery_payer: payer,
  delivery_cost: z.coerce.number().min(0).default(0),
  delivery_status: optStr,
  np_raw_status: optStr,
});

export type DeliveryInput = z.infer<typeof deliverySchema>;
