import { describe, it, expect } from 'vitest';
import { parsePagination, paginated } from './pagination.js';

describe('parsePagination', () => {
  it('значения по умолчанию', () => {
    expect(parsePagination({})).toMatchObject({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });

  it('считает skip по странице', () => {
    expect(parsePagination({ page: 3, pageSize: 10 })).toMatchObject({ skip: 20, take: 10 });
  });

  it('ограничивает размер страницы максимумом', () => {
    expect(parsePagination({ pageSize: 5000 }).pageSize).toBe(100);
  });

  it('некорректные значения сбрасывает к дефолтам', () => {
    expect(parsePagination({ page: -2, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 20 });
  });
});

describe('paginated', () => {
  it('считает totalPages', () => {
    const r = paginated([1, 2], 45, { page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(r.totalPages).toBe(3);
    expect(r.total).toBe(45);
  });

  it('при нуле записей totalPages = 1', () => {
    expect(paginated([], 0, { page: 1, pageSize: 20, skip: 0, take: 20 }).totalPages).toBe(1);
  });
});
