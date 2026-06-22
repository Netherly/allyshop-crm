export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Разбирает page/pageSize из query с ограничением максимального размера страницы.
export function parsePagination(
  query: { page?: unknown; pageSize?: unknown },
  defaults = { pageSize: 20, max: 100 },
): PaginationParams {
  let page = Number(query.page) || 1;
  if (page < 1) page = 1;

  let pageSize = Number(query.pageSize) || defaults.pageSize;
  if (pageSize < 1) pageSize = defaults.pageSize;
  if (pageSize > defaults.max) pageSize = defaults.max;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Оборачивает выборку в ответ с метаданными пагинации.
export function paginated<T>(items: T[], total: number, p: PaginationParams): PaginatedResult<T> {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}
