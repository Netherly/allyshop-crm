import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { publicUser } from '../lib/publicUser.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema } from '../schemas/auth.js';

const router = Router();

// Вход: проверка пароля и выдача JWT.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { login: data.login } });
    if (!user || !user.is_active || !(await bcrypt.compare(data.password, user.password_hash))) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ token, user: publicUser(user) });
  }),
);

// Текущий пользователь по токену.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json({ user: publicUser(user!) });
  }),
);

export default router;
