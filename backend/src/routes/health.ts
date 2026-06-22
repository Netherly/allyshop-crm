import { Router } from 'express';

const router = Router();

// Проверка живости API.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default router;
