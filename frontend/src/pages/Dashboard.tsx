import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';

interface DashboardData {
  orders_total: number;
  products_count: number;
  clients_count: number;
  revenue: number;
  to_pay: number;
  low_stock: { id: number; name: string; article: string | null; size: string | null; stock: number }[];
  recent_orders: {
    id: number;
    order_number: string;
    client: string | null;
    status: string;
    total_amount: string;
    created_at: string;
  }[];
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then((res) => {
        setData(res.data);
        setState('ok');
      })
      .catch(() => setState('error'));
  }, []);

  if (state === 'loading') {
    return (
      <div>
        <h1 className="page-title">Рабочий стол</h1>
        <p className="text-muted">Загрузка…</p>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div>
        <h1 className="page-title">Рабочий стол</h1>
        <p className="status-error">Не удалось загрузить данные</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Рабочий стол</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Заказов всего</div>
          <div className="stat-card__value">{data.orders_total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Выручка (оплачено)</div>
          <div className="stat-card__value">{formatMoney(data.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">К доплате</div>
          <div className="stat-card__value">{formatMoney(data.to_pay)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Товаров</div>
          <div className="stat-card__value">{data.products_count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Клиентов</div>
          <div className="stat-card__value">{data.clients_count}</div>
        </div>
      </div>

      <div className="dashboard-cols">
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Последние заказы</h3>
          <table className="table">
            <thead>
              <tr>
                <th>№</th>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td>{o.order_number}</td>
                  <td>{o.client ?? '—'}</td>
                  <td>
                    <span className="badge">{o.status}</span>
                  </td>
                  <td>{formatMoney(o.total_amount)}</td>
                </tr>
              ))}
              {data.recent_orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Заказов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Низкие остатки (≤ 3)</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Артикул</th>
                <th>Остаток</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock.map((p) => (
                <tr key={p.id}>
                  <td>{[p.name, p.size && 'р.' + p.size].filter(Boolean).join(' · ')}</td>
                  <td>{p.article ?? '—'}</td>
                  <td>
                    <span className={p.stock <= 0 ? 'badge badge--gray' : 'badge'}>{p.stock} шт</span>
                  </td>
                </tr>
              ))}
              {data.low_stock.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-muted">
                    Низких остатков нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
