import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

// Проверяет JWT и подгружает активного пользователя в req.user.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
      return;
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

// Пропускает только супер-админа.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Недостаточно прав' });
    return;
  }
  next();
}
