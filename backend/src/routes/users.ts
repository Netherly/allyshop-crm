import { Router } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { publicUser } from '../lib/publicUser.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { createUserSchema, updateUserSchema } from '../schemas/user.js';

const router = Router();

// Все операции с пользователями доступны только супер-админу.
router.use(requireAuth, requireSuperAdmin);

// Список пользователей.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    res.json(users.map(publicUser));
  }),
);

// Один пользователь.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json(publicUser(user));
  }),
);

// Создание пользователя.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const password_hash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        full_name: data.full_name,
        login: data.login,
        password_hash,
        role: data.role,
      },
    });
    res.status(201).json(publicUser(user));
  }),
);

// Обновление пользователя (пароль меняется только если передан).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const { password, ...rest } = data;
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        ...rest,
        ...(password ? { password_hash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    res.json(publicUser(user));
  }),
);

// Физическое удаление пользователя (блокировка — отдельно, через PATCH is_active).
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Нельзя удалить самого себя' });
      return;
    }
    try {
      await prisma.user.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      // P2003 — на пользователя ссылаются заказы/движения/финансы/история
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        res.status(409).json({
          error: 'Нельзя удалить: у пользователя есть связанные записи. Используйте блокировку.',
        });
        return;
      }
      throw e;
    }
  }),
);

export default router;
