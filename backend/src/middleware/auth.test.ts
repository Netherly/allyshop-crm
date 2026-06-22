import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireSuperAdmin } from './auth.js';

// Заглушки req/res для проверки контроля доступа по роли.
function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireSuperAdmin', () => {
  it('пропускает супер-админа', () => {
    const req = { user: { id: 1, role: 'super_admin' } } as Request;
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('блокирует обычного пользователя с 403', () => {
    const req = { user: { id: 2, role: 'user' } } as Request;
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
