import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney, getApiError } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { OrderPicker } from '@/components/OrderPicker';
import { PickedItem } from '@/components/SearchPicker';
import { PAYMENT_TYPES, PAYMENT_OUT_TYPES } from '@/lib/orderConstants';
import { FinanceTransaction, Paginated } from '@/types';

function amountCell(t: FinanceTransaction) {
  const out = PAYMENT_OUT_TYPES.includes(t.payment_type);
  return (
    <span className={out ? 'mv mv--out' : 'mv mv--in'}>
      {out ? '− ' : '+ '}
      {formatMoney(t.amount)}
    </span>
  );
}

export function Finance() {
  const [items, setItems] = useState<FinanceTransaction[]>([]);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('расход');
  const [formOrder, setFormOrder] = useState<PickedItem | null>(null);
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Paginated<FinanceTransaction>>('/finance', {
      params: { payment_type: type || undefined, page, pageSize: 20 },
    });
    setItems(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [type, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/finance', {
        order_id: formOrder?.id ?? null,
        payment_type: formType,
        amount: Number(amount),
        comment: comment || null,
      });
      setShowForm(false);
      setFormOrder(null);
      setAmount('');
      setComment('');
      setPage(1);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось создать операцию'));
    }
  }

  return (
    <div>
      <h1 className="page-title">Финансы</h1>

      <div className="toolbar">
        <select
          className="select"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все типы</option>
          {PAYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className="btn btn--primary toolbar__right"
          onClick={() => {
            setError('');
            setShowForm(true);
          }}
        >
          Добавить операцию
        </button>
      </div>

      <Modal open={showForm} title="Новая операция" onClose={() => setShowForm(false)}>
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Тип</label>
            <select className="select" value={formType} onChange={(e) => setFormType(e.target.value)}>
              {PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Заказ (необязательно)</label>
            <OrderPicker value={formOrder} onChange={setFormOrder} />
          </div>
          <div className="field">
            <label className="field__label">Сумма</label>
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Комментарий</label>
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit">
              Сохранить
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тип</th>
            <th>Заказ</th>
            <th>Сумма</th>
            <th>Комментарий</th>
            <th>Кто</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>{formatDateTime(t.date_time)}</td>
              <td>{t.payment_type}</td>
              <td>{t.order_number ?? '—'}</td>
              <td>{amountCell(t)}</td>
              <td>{t.comment ?? '—'}</td>
              <td>{t.user?.full_name ?? '—'}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                Операций пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
