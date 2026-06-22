import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

describe('jwt', () => {
  it('подписывает и проверяет токен', () => {
    const token = signToken({ userId: 7, role: 'super_admin' });
    const payload = verifyToken(token);
    expect(payload.userId).toBe(7);
    expect(payload.role).toBe('super_admin');
  });

  it('отклоняет повреждённый токен', () => {
    expect(() => verifyToken('не-токен')).toThrow();
  });
});
