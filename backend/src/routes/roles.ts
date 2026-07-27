import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { PERMISSION_CATALOG } from '../lib/permissions.js';
import { createRoleSchema, updateRoleSchema } from '../schemas/role.js';

const router = Router();
// Управление ролями и доступами — только супер-админ.
router.use(requireAuth, requireSuperAdmin);

// Каталог доступов проекта (для галочек при настройке роли).
router.get('/permissions', (_req, res) => {
  res.json(PERMISSION_CATALOG);
});

// Список ролей с числом пользователей.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const roles = await prisma.appRole.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    res.json(roles.map((r) => ({ ...r, users_count: r._count.users })));
  }),
);

// Создание роли.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createRoleSchema.parse(req.body);
    try {
      const role = await prisma.appRole.create({
        data: { name: data.name, permissions: data.permissions },
      });
      res.status(201).json(role);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        res.status(409).json({ error: 'Роль с таким названием уже существует' });
        return;
      }
      throw e;
    }
  }),
);

// Редактирование роли (название и/или доступы).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.appRole.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Роль не найдена' });
      return;
    }
    if (existing.is_system) {
      res.status(409).json({ error: 'Системную роль нельзя изменять' });
      return;
    }
    const data = updateRoleSchema.parse(req.body);
    try {
      const role = await prisma.appRole.update({ where: { id }, data });
      res.json(role);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        res.status(409).json({ error: 'Роль с таким названием уже существует' });
        return;
      }
      throw e;
    }
  }),
);

// Удаление роли (нельзя, если системная или к ней привязаны пользователи).
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.appRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Роль не найдена' });
      return;
    }
    if (existing.is_system) {
      res.status(409).json({ error: 'Системную роль нельзя удалить' });
      return;
    }
    if (existing._count.users > 0) {
      res.status(409).json({ error: 'К роли привязаны пользователи — сначала переназначьте их' });
      return;
    }
    await prisma.appRole.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

export default router;
