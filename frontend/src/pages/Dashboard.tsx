import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatMoney, productTitle } from '@/lib/format';
import { ORDER_SOURCES, ORDER_STATUSES, ORDER_TYPES, PAYMENT_STATUSES } from '@/lib/orderConstants';

// Пресеты периода → сколько дней назад (null — всё время).
const PERIODS: { key: string; label: string; days: number | null }[] = [
  { key: 'all', label: 'Всё время', days: null },
  { key: 'today', label: 'Сегодня', days: 0 },
  { key: '7d', label: '7 дней', days: 7 },
  { key: '30d', label: '30 дней', days: 30 },
];

// Дата начала периода в формате YYYY-MM-DD (или пусто для «всё время»).
function periodFrom(days: number | null): string | undefined {
  if (days == null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface DashboardData {
  orders_total: number;
  products_count: number;
  clients_count: number;
  unpaid_count: number;
  revenue: number;
  turnover: number;
  avg_check: number;
  profit: number;
  to_pay: number;
  status_breakdown: { status: string; count: number }[];
  source_breakdown: { source: string; count: number }[];
  low_stock: {
    id: number;
    name: string;
    article: string | null;
    size: string | null;
    color: string | null;
    model: string | null;
    stock: number;
  }[];
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
  const [period, setPeriod] = useState('all');
  const [orderType, setOrderType] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [source, setSource] = useState('');

  const load = useCallback(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? null;
    api
      .get<DashboardData>('/dashboard', {
        params: {
          from: periodFrom(days),
          order_type: orderType || undefined,
          status: status || undefined,
          payment_status: paymentStatus || undefined,
          source: source || undefined,
        },
      })
      .then((res) => {
        setData(res.data);
        setState('ok');
      })
      .catch(() => setState('error'));
  }, [period, orderType, status, paymentStatus, source]);

  useEffect(() => {
    load();
  }, [load]);

  // Панель фильтров — общий блок для всех состояний.
  const filters = (
    <div className="toolbar">
      <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <select className="select" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
        <option value="">Все типы</option>
        {ORDER_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Все статусы</option>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="select"
        value={paymentStatus}
        onChange={(e) => setPaymentStatus(e.target.value)}
      >
        <option value="">Любая оплата</option>
        {PAYMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">Все источники</option>
        {ORDER_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );

  if (state === 'loading') {
    return (
      <div>
        <h1 className="page-title">Дашборд</h1>
        <p className="text-muted">Загрузка…</p>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div>
        <h1 className="page-title">Дашборд</h1>
        <p className="status-error">Не удалось загрузить данные</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Дашборд</h1>

      {filters}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Заказов</div>
          <div className="stat-card__value">{data.orders_total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Оборот (сумма заказов)</div>
          <div className="stat-card__value">{formatMoney(data.turnover)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Выручка (оплачено)</div>
          <div className="stat-card__value">{formatMoney(data.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Валовая прибыль</div>
          <div className="stat-card__value">{formatMoney(data.profit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Средний чек</div>
          <div className="stat-card__value">{formatMoney(data.avg_check)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">К доплате</div>
          <div className="stat-card__value">{formatMoney(data.to_pay)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Неоплаченных заказов</div>
          <div className="stat-card__value">{data.unpaid_count}</div>
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
          <h3 style={{ marginBottom: 12 }}>Заказы по статусам</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {data.status_breakdown.map((s) => (
                <tr key={s.status}>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                  <td>{s.count}</td>
                </tr>
              ))}
              {data.status_breakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-muted">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Заказы по источникам</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Источник</th>
                <th>Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {data.source_breakdown.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td>{s.count}</td>
                </tr>
              ))}
              {data.source_breakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-muted">
                    Нет данных
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
                  <td>{productTitle(p)}</td>
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
