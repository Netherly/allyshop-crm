import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import productsRouter from './routes/products.js';
import uploadsRouter from './routes/uploads.js';
import stockRouter from './routes/stock.js';
import setsRouter from './routes/sets.js';
import clientsRouter from './routes/clients.js';
import ordersRouter from './routes/orders.js';
import financeRouter from './routes/finance.js';
import auditRouter from './routes/audit.js';
import dashboardRouter from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';

// Собирает приложение Express. Вынесено отдельно, чтобы переиспользовать в тестах.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());

  // Раздача загруженных файлов
  app.use('/uploads', express.static(env.uploadDir));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/sets', setsRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(errorHandler);

  return app;
}
