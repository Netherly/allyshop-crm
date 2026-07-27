import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import * as np from '../services/novaposhta.js';

const router = Router();
router.use(requireAuth);

// Отслеживание по ТТН → нормализованные поля доставки.
router.get(
  '/track/:ttn',
  asyncHandler(async (req, res) => {
    const info = await np.trackByTtn(String(req.params.ttn).trim(), String(req.query.phone ?? ''));
    res.json(info);
  }),
);

// Автоподсказка городов.
router.get(
  '/cities',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    res.json(await np.searchCities(q));
  }),
);

// Автоподсказка отделений/почтоматов по городу.
router.get(
  '/warehouses',
  asyncHandler(async (req, res) => {
    const city = String(req.query.city ?? '').trim();
    const q = String(req.query.q ?? '').trim();
    if (!city) {
      res.json([]);
      return;
    }
    res.json(await np.getWarehouses(city, q));
  }),
);

export default router;
