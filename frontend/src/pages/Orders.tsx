import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { ORDER_STATUSES, ORDER_TYPES } from '@/lib/orderConstants';
import { OrderListItem, Paginated } from '@/types';

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [orderType, setOrderType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const res = await api.get<Paginated<OrderListItem>>('/orders', {
      params: {
        q: q || undefined,
        status: status || undefined,
        order_type: orderType || undefined,
        page,
        pageSize: 20,
      },
    });
    setOrders(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [q, status, orderType, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="page-title">Заказы</h1>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Поиск по номеру или клиенту…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={orderType}
          onChange={(e) => {
            setOrderType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все типы</option>
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="btn btn--primary toolbar__right" onClick={() => navigate('/orders/new')}>
          Создать заказ
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>№</th>
            <th>Дата</th>
            <th>Клиент</th>
            <th>Тип</th>
            <th>Позиций</th>
            <th>Статус</th>
            <th>Оплата</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/orders/${o.id}`)}
            >
              <td>{o.order_number}</td>
              <td>{formatDateTime(o.created_at)}</td>
              <td>{o.client?.name ?? '—'}</td>
              <td>{o.order_type}</td>
              <td>{o.items_count}</td>
              <td>
                <span className="badge">{o.status}</span>
              </td>
              <td>{o.payment_status}</td>
              <td>{formatMoney(o.total_amount)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={8} className="text-muted">
                Заказов не найдено
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
