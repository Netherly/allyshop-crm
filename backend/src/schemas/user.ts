import { z } from 'zod';

export const createUserSchema = z.object({
  full_name: z.string().min(1, 'Укажите ФИО'),
  login: z.string().min(3, 'Логин минимум 3 символа'),
  password: z.string().min(4, 'Пароль минимум 4 символа'),
  role: z.enum(['user', 'super_admin']).default('user'),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  login: z.string().min(3).optional(),
  password: z.string().min(4).optional(),
  role: z.enum(['user', 'super_admin']).optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
