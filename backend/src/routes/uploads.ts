import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { env } from '../config/env.js';

// На serverless (Vercel) рабочая ФС read-only — каталог может не создаться, это не критично.
try {
  fs.mkdirSync(env.uploadDir, { recursive: true });
} catch (e) {
  console.error('Не удалось создать каталог загрузок:', e);
}

// Сохраняем файл на диск под случайным именем, сохраняя расширение.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
});

const router = Router();

// Загрузка одного изображения. Возвращает относительный URL.
router.post('/', requireAuth, requireSuperAdmin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: 'Ошибка загрузки файла' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Нужен файл изображения' });
      return;
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

export default router;
