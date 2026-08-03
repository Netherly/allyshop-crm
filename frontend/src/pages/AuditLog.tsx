import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
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

// Приводит значение аудита к объекту (или null).
function asDict(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function money(v: unknown): string {
  return formatMoney(Number(v ?? 0));
}

// Русское склонение по числу.
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// Ссылка на объект в человеческом виде («Заказ №5», «Товар #3»).
function objectLabel(e: AuditEntry): string {
  if (e.entity_type === 'orders') return `Заказ №${e.entity_id}`;
  if (e.entity_type === 'products') return `Товар #${e.entity_id}`;
  if (e.entity_type === 'clients') return `Клиент #${e.entity_id}`;
  if (e.entity_type === 'stock') return `Движение #${e.entity_id}`;
  return `#${e.entity_id}`;
}

// Человекочитаемое описание события вместо сырого JSON.
function describe(e: AuditEntry): string {
  const nv = asDict(e.new_value);
  const ov = asDict(e.old_value);

  if (e.action === 'payment_added') {
    return nv ? `${str(nv.payment_type)} на сумму ${money(nv.amount)}` : 'Оплата добавлена';
  }
  if (e.action === 'status_changed') {
    return `Статус: «${str(ov?.status) || '—'}» → «${str(nv?.status) || '—'}»`;
  }
  if (e.action === 'stock_written_off' || e.action === 'stock_returned') {
    const qtys = nv ? Object.values(nv).map((x) => Number(x)) : [];
    const totalQty = qtys.reduce((a, b) => a + b, 0);
    const n = qtys.length;
    const verb = e.action === 'stock_written_off' ? 'Списано со склада' : 'Возвращено на склад';
    return `${verb}: ${totalQty} шт по ${n} ${plural(n, 'позиции', 'позициям', 'позициям')}`;
  }

  switch (e.entity_type) {
    case 'orders':
      if (e.action === 'created' && nv)
        return `Создан заказ №${str(nv.order_number)} на ${money(nv.total_amount)}, статус «${str(nv.status)}»`;
      if (e.action === 'updated') return 'Изменены данные заказа';
      break;
    case 'stock':
      if (e.action === 'created' && nv) {
        const mv = str(nv.movement_type).replace('_', ' ');
        const unit = nv.item_type === 'set' ? 'наб.' : 'шт';
        return `${mv}: ${str(nv.quantity)} ${unit}`;
      }
      if (e.action === 'updated' && nv) {
        const parts: string[] = [];
        if (nv.quantity != null) parts.push(`кол-во → ${str(nv.quantity)}`);
        if (nv.price != null) parts.push(`цена → ${money(nv.price)}`);
        return parts.length ? `Правка движения: ${parts.join(', ')}` : 'Правка движения';
      }
      break;
    case 'products':
      if ((e.action === 'created' || e.action === 'updated') && nv) return `Товар «${str(nv.name)}»`;
      if (e.action === 'deleted') return 'Товар перемещён в архив';
      break;
    case 'clients':
      if ((e.action === 'created' || e.action === 'updated') && nv) return `Клиент «${str(nv.name)}»`;
      if (e.action === 'deleted') return 'Клиент перемещён в архив';
      break;
  }
  return '—';
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
    <div className="page-fill">
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

      <div className="table-scroll">
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
              <td>{objectLabel(e)}</td>
              <td>
                <span className="badge">{ACTION_LABELS[e.action] ?? e.action}</span>
              </td>
              <td>{describe(e)}</td>
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
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
