import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { AuditEntry, Paginated } from '@/types';

const ENTITY_LABELS: Record<string, string> = {
  orders: 'Заказы',
  products: 'Товары',
  clients: 'Клиенты',
  stock: 'Склад',
  finance: 'Финансы',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Создание',
  updated: 'Изменение',
  deleted: 'Архив',
  status_changed: 'Смена статуса',
  payment_added: 'Оплата',
  stock_written_off: 'Списание',
  stock_returned: 'Возврат',
};

// Краткое представление значения для колонки «детали».
function details(v: unknown): string {
  if (v == null) return '—';
  const s = JSON.stringify(v);
  return s.length > 70 ? s.slice(0, 70) + '…' : s;
}

export function AuditLog() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const res = await api.get<Paginated<AuditEntry>>('/audit', {
      params: { entity_type: entity || undefined, page, pageSize: 30 },
    });
    setItems(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [entity, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="page-title">История действий</h1>

      <div className="toolbar">
        <select
          className="select"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все разделы</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Пользователь</th>
            <th>Раздел</th>
            <th>Объект</th>
            <th>Действие</th>
            <th>Детали</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{formatDateTime(e.created_at)}</td>
              <td>{e.user?.full_name ?? 'система'}</td>
              <td>{ENTITY_LABELS[e.entity_type] ?? e.entity_type}</td>
              <td>#{e.entity_id}</td>
              <td>
                <span className="badge">{ACTION_LABELS[e.action] ?? e.action}</span>
              </td>
              <td className="text-muted">{details(e.new_value ?? e.old_value)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                Записей пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
