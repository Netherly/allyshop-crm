import { describe, it, expect } from 'vitest';
import { formatMoney, assetUrl, getApiError } from './format';

describe('formatMoney', () => {
  it('форматирует число', () => {
    expect(formatMoney(1200)).toMatch(/1\D?200/);
  });

  it('принимает строку (Decimal)', () => {
    expect(formatMoney('4750')).toMatch(/4\D?750/);
  });

  it('некорректное значение → 0', () => {
    expect(formatMoney('abc')).toBe('0');
  });
});

describe('assetUrl', () => {
  it('внешнюю ссылку возвращает как есть', () => {
    expect(assetUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  });

  it('относительный путь дополняет origin API', () => {
    expect(assetUrl('/uploads/x.png')).toContain('/uploads/x.png');
    expect(assetUrl('/uploads/x.png')).not.toContain('/api/');
  });

  it('пусто → пустая строка', () => {
    expect(assetUrl(null)).toBe('');
  });
});

describe('getApiError', () => {
  it('достаёт error из ответа', () => {
    const err = { response: { data: { error: 'Нет остатка' } } };
    expect(getApiError(err)).toBe('Нет остатка');
  });

  it('иначе — fallback', () => {
    expect(getApiError(new Error('x'), 'По умолчанию')).toBe('По умолчанию');
  });
});
