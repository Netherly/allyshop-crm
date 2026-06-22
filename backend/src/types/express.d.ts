import 'express';

// Добавляет авторизованного пользователя в объект запроса.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string };
    }
  }
}
