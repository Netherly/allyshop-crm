import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  userId: number;
  role: string;
}

// Подписывает токен с полезной нагрузкой пользователя.
export function signToken(payload: JwtPayload): string {
  const options = { expiresIn: env.jwtExpiresIn } as jwt.SignOptions;
  return jwt.sign(payload, env.jwtSecret, options);
}

// Проверяет и декодирует токен (бросает исключение при ошибке).
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
