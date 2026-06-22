import { RequestHandler } from 'express';

// Прокидывает ошибки из async-обработчиков в общий error middleware.
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
