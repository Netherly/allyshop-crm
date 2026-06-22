import { User } from '@prisma/client';

// Убирает хэш пароля перед отдачей пользователя наружу.
export function publicUser(user: User) {
  const { password_hash: _password_hash, ...rest } = user;
  return rest;
}
