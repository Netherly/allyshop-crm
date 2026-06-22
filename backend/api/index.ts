// Точка входа для Vercel: Express-приложение как serverless-функция.
// Локально/в Docker используется src/index.ts (обычный сервер).
import { createApp } from '../src/app.js';

export default createApp();
