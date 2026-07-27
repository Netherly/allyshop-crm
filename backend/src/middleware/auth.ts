import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { ALL_PERMISSION_KEYS } from '../lib/permissions.js';

// Проверяет JWT и подгружает активного пользователя (с доступами роли) в req.user.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role_ref: true },
    });
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
      return;
    }
    // super_admin — полный доступ; обычный пользователь — доступы своей роли.
    const permissions =
      user.role === 'super_admin' ? ALL_PERMISSION_KEYS : user.role_ref?.permissions ?? [];
    req.user = { id: user.id, role: user.role, permissions };
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

// Пропускает только супер-админа (управление ролями/пользователями).
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Недостаточно прав' });
    return;
  }
  next();
}

// Пропускает, если у пользователя есть нужный доступ (super_admin — всегда).
export function requirePermission(key: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'super_admin' || req.user?.permissions?.includes(key)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Недостаточно прав для этого действия' });
  };
}
