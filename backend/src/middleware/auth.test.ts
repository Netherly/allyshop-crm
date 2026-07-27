import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireSuperAdmin, requirePermission } from './auth.js';

// Заглушки req/res для проверки контроля доступа.
function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireSuperAdmin', () => {
  it('пропускает супер-админа', () => {
    const req = { user: { id: 1, role: 'super_admin', permissions: [] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('блокирует обычного пользователя с 403', () => {
    const req = { user: { id: 2, role: 'user', permissions: [] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requirePermission', () => {
  it('пропускает при наличии доступа', () => {
    const req = { user: { id: 3, role: 'user', permissions: ['orders.create'] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('orders.create')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('пропускает супер-админа без явного доступа', () => {
    const req = { user: { id: 4, role: 'super_admin', permissions: [] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('orders.delete')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('блокирует без нужного доступа с 403', () => {
    const req = { user: { id: 5, role: 'user', permissions: ['orders.view'] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('orders.delete')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
