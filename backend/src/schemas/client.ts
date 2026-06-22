import { z } from 'zod';
import { COUNTERPARTY_TYPES, CLIENT_TYPES } from '../lib/constants.js';

const optStr = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

// Тип клиента: один из допустимых или пусто.
const clientType = z
  .union([z.enum(CLIENT_TYPES), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v === '' || v == null ? null : v));

export const createClientSchema = z.object({
  name: z.string().min(1, 'Укажите имя'),
  phone: optStr,
  email: optStr,
  instagram: optStr,
  city: optStr,
  np_branch: optStr,
  counterparty_type: z.enum(COUNTERPARTY_TYPES).default('client'),
  client_type: clientType,
  comment: optStr,
  is_active: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
