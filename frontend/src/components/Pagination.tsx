interface Props {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

// Простая постраничная навигация: назад/вперёд + текущая страница.
export function Pagination({ page, totalPages, total, onChange }: Props) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <button className="btn btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Назад
      </button>
      <span className="pagination__info">
        Стр. {page} из {totalPages} · всего {total}
      </span>
      <button
        className="btn btn--sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Вперёд
      </button>
    </div>
  );
}
