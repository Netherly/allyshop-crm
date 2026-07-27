import { z } from 'zod';
import { ALL_PERMISSION_KEYS } from '../lib/permissions.js';

const permKey = z.string().refine((k) => ALL_PERMISSION_KEYS.includes(k), {
  message: 'Неизвестный доступ',
});

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Укажите название роли'),
  permissions: z.array(permKey).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  permissions: z.array(permKey).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
