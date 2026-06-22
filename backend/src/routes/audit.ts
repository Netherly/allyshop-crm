import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { parsePagination, paginated } from '../lib/pagination.js';

const router = Router();
router.use(requireAuth, requireSuperAdmin);

// Журнал действий с фильтром по сущности.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where: Prisma.AuditLogWhereInput = {};
    if (req.query.entity_type) where.entity_type = String(req.query.entity_type);

    const pg = parsePagination(req.query);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { full_name: true } } },
        orderBy: { id: 'desc' },
        skip: pg.skip,
        take: pg.take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json(paginated(items, total, pg));
  }),
);

export default router;
