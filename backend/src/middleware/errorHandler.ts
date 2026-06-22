import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';

// Централизованная обработка ошибок API.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, ...err.extra });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Ошибка валидации', details: err.flatten() });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 — нарушение уникальности
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Запись с такими данными уже существует' });
      return;
    }
    // P2025 — запись не найдена
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    // P2003 — нарушение внешнего ключа (например, указан несуществующий товар)
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Указана несуществующая связанная запись' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
