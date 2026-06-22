// Ошибка приложения с HTTP-статусом и доп. полями (например, список нехваток остатка).
export class AppError extends Error {
  status: number;
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
