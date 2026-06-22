import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatMoney, getApiError } from '@/lib/format';
import { ProductPicker } from '@/components/ProductPicker';
import { SetPicker } from '@/components/SetPicker';
import { PickedItem } from '@/components/SearchPicker';
import { ClientPicker } from '@/components/ClientPicker';
import { Modal } from '@/components/Modal';
import { ORDER_SOURCES, ORDER_STATUSES, ORDER_TYPES, PAYMENT_TYPES, PAYMENT_OUT_TYPES } from '@/lib/orderConstants';
import { Order } from '@/types';

interface DraftLine {
  key: string;
  item_type: 'product' | 'set';
  ref_id: number;
  label: string;
  quantity: number;
  price: string;
}

// Цена позиции по умолчанию: товар — по типу заказа, набор — сумма по составу.
async function defaultPrice(itemType: 'product' | 'set', id: number, orderType: string): Promise<number> {
  if (itemType === 'product') {
    const p = (await api.get(`/products/${id}`)).data;
    return Number(orderType === 'опт' ? p.wholesale_price : p.retail_price);
  }
  const s = (await api.get(`/sets/${id}`)).data;
  return (s.set_items ?? []).reduce(
    (sum: number, si: { quantity: number; product: { wholesale_price: string; retail_price: string } }) =>
      sum + Number(orderType === 'опт' ? si.product.wholesale_price : si.product.retail_price) * si.quantity,
    0,
  );
}

export function OrderCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [order, setOrder] = useState<Order | null>(null);
  const [client, setClient] = useState<PickedItem | null>(null);
  const [orderType, setOrderType] = useState('розница');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('Новый');
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');

  // Конструктор позиции
  const [builderType, setBuilderType] = useState<'product' | 'set'>('product');
  const [builderPick, setBuilderPick] = useState<PickedItem | null>(null);
  const [builderQty, setBuilderQty] = useState('1');
  const [builderPrice, setBuilderPrice] = useState('');

  // Оплата
  const [payOpen, setPayOpen] = useState(false);
  const [payType, setPayType] = useState('предоплата');
  const [payAmount, setPayAmount] = useState('');
  const [payComment, setPayComment] = useState('');
  const [payError, setPayError] = useState('');

  // Доставка
  const [delivery, setDelivery] = useState({
    recipient_name: '',
    recipient_phone: '',
    city: '',
    branch: '',
    ttn: '',
    delivery_payer: '',
    delivery_cost: '0',
    delivery_status: '',
  });
  const [deliverySaved, setDeliverySaved] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  const loadOrder = useCallback(async () => {
    if (isNew) return;
    const res = await api.get<Order>(`/orders/${id}`);
    const o = res.data;
    setOrder(o);
    setClient(o.client ? { id: o.client.id, label: o.client.name } : null);
    setOrderType(o.order_type);
    setSource(o.source ?? '');
    setStatus(o.status);
    setTags(o.tags ?? '');
    setComment(o.comment ?? '');
    setDiscountAmount(String(Number(o.discount_amount)));
    setDiscountPercent(String(Number(o.discount_percent)));
    setLines(
      o.order_items.map((it) => ({
        key: String(it.id),
        item_type: it.item_type,
        ref_id: (it.item_type === 'product' ? it.product_id : it.set_id) ?? 0,
        label: [it.name, it.size && 'р.' + it.size].filter(Boolean).join(' · '),
        quantity: it.quantity,
        price: String(Number(it.price)),
      })),
    );

    const d = o.delivery;
    setDelivery({
      recipient_name: d?.recipient_name ?? o.client?.name ?? '',
      recipient_phone: d?.recipient_phone ?? o.client?.phone ?? '',
      city: d?.city ?? o.client?.city ?? '',
      branch: d?.branch ?? o.client?.np_branch ?? '',
      ttn: d?.ttn ?? '',
      delivery_payer: d?.delivery_payer ?? '',
      delivery_cost: d ? String(Number(d.delivery_cost)) : '0',
      delivery_status: d?.delivery_status ?? '',
    });
  }, [id, isNew]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Автоподстановка цены при выборе позиции в конструкторе.
  useEffect(() => {
    if (!builderPick) return;
    defaultPrice(builderType, builderPick.id, orderType).then((p) => setBuilderPrice(String(p)));
  }, [builderPick, builderType, orderType]);

  function addLine() {
    if (!builderPick) return;
    setLines([
      ...lines,
      {
        key: `${Date.now()}-${Math.random()}`,
        item_type: builderType,
        ref_id: builderPick.id,
        label: builderPick.label,
        quantity: Number(builderQty) || 1,
        price: builderPrice || '0',
      },
    ]);
    setBuilderPick(null);
    setBuilderQty('1');
    setBuilderPrice('');
  }

  function removeLine(key: string) {
    setLines(lines.filter((l) => l.key !== key));
  }

  // После списания со склада состав менять нельзя.
  const writtenOff = !!order?.stock_written_off;

  const subtotal = lines.reduce((s, l) => s + Number(l.price) * l.quantity, 0);
  const total = Math.max(
    0,
    subtotal - Number(discountAmount || 0) - (subtotal * Number(discountPercent || 0)) / 100,
  );

  async function addPayment(e: FormEvent) {
    e.preventDefault();
    setPayError('');
    try {
      await api.post('/finance', {
        order_id: Number(id),
        payment_type: payType,
        amount: Number(payAmount),
        comment: payComment || null,
      });
      setPayOpen(false);
      setPayAmount('');
      setPayComment('');
      await loadOrder();
    } catch (err) {
      setPayError(getApiError(err, 'Не удалось добавить оплату'));
    }
  }

  async function deletePayment(txId: number) {
    if (!confirm('Удалить операцию?')) return;
    await api.delete(`/finance/${txId}`);
    await loadOrder();
  }

  async function saveDelivery(e: FormEvent) {
    e.preventDefault();
    setDeliveryError('');
    setDeliverySaved(false);
    try {
      await api.put(`/orders/${id}/delivery`, {
        ...delivery,
        delivery_cost: Number(delivery.delivery_cost) || 0,
      });
      setDeliverySaved(true);
      await loadOrder();
    } catch (err) {
      setDeliveryError(getApiError(err, 'Не удалось сохранить доставку'));
    }
  }

  function setDeliveryField(field: string, value: string) {
    setDelivery((d) => ({ ...d, [field]: value }));
    setDeliverySaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (lines.length === 0) {
      setError('Добавьте хотя бы одну позицию');
      return;
    }
    const payload: Record<string, unknown> = {
      client_id: client?.id ?? null,
      order_type: orderType,
      source: source || null,
      status,
      tags: tags || null,
      comment: comment || null,
      discount_amount: Number(discountAmount) || 0,
      discount_percent: Number(discountPercent) || 0,
    };
    // после списания состав менять нельзя — позиции не отправляем (иначе бэкенд вернёт 409)
    if (!writtenOff) {
      payload.items = lines.map((l) => ({
        item_type: l.item_type,
        product_id: l.item_type === 'product' ? l.ref_id : undefined,
        set_id: l.item_type === 'set' ? l.ref_id : undefined,
        quantity: l.quantity,
        price: Number(l.price),
      }));
    }
    try {
      if (isNew) {
        const res = await api.post<Order>('/orders', payload);
        navigate(`/orders/${res.data.id}`);
      } else {
        await api.patch(`/orders/${id}`, payload);
        await loadOrder();
      }
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить заказ'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {isNew ? 'Новый заказ' : `Заказ № ${order?.order_number ?? ''}`}
        </h1>
        <button className="btn" onClick={() => navigate('/orders')}>
          ← К списку
        </button>
      </div>

      {!isNew && order && (
        <div className="text-muted" style={{ marginBottom: 16 }}>
          Менеджер: {order.manager?.full_name ?? '—'} · Оплата: {order.payment_status} · Списан со
          склада: {order.stock_written_off ? 'да' : 'нет'}
          {order.stock_returned ? ' · Возвращён на склад: да' : ''}
        </div>
      )}

      <form onSubmit={onSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Клиент</label>
              <ClientPicker value={client} onChange={setClient} />
            </div>
            <div className="field">
              <label className="field__label">Тип заказа</label>
              <select className="select" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                {ORDER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Источник</label>
              <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">—</option>
                {ORDER_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Статус</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Теги</label>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="field field--full">
              <label className="field__label">Комментарий</label>
              <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Позиции</h3>

          <table className="table" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Тип</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.label}</td>
                  <td>{l.item_type === 'set' ? 'Набор' : 'Товар'}</td>
                  <td>{l.quantity}</td>
                  <td>{formatMoney(l.price)}</td>
                  <td>{formatMoney(Number(l.price) * l.quantity)}</td>
                  <td>
                    {!writtenOff && (
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => removeLine(l.key)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Позиции не добавлены
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {writtenOff ? (
            <div className="text-muted">Заказ списан со склада — состав изменить нельзя.</div>
          ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <select
              className="select"
              style={{ width: 120 }}
              value={builderType}
              onChange={(e) => {
                setBuilderType(e.target.value as 'product' | 'set');
                setBuilderPick(null);
                setBuilderPrice('');
              }}
            >
              <option value="product">Товар</option>
              <option value="set">Набор</option>
            </select>
            <div style={{ flex: 1, minWidth: 220 }}>
              {builderType === 'set' ? (
                <SetPicker value={builderPick} onChange={setBuilderPick} />
              ) : (
                <ProductPicker value={builderPick} onChange={setBuilderPick} />
              )}
            </div>
            <input
              className="input"
              style={{ width: 80 }}
              type="number"
              placeholder="кол-во"
              value={builderQty}
              onChange={(e) => setBuilderQty(e.target.value)}
            />
            <input
              className="input"
              style={{ width: 100 }}
              type="number"
              placeholder="цена"
              value={builderPrice}
              onChange={(e) => setBuilderPrice(e.target.value)}
            />
            <button type="button" className="btn" onClick={addLine} disabled={!builderPick}>
              Добавить
            </button>
          </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16, maxWidth: 360 }}>
          <div className="order-total-row">
            <span>Подытог</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="order-total-row">
            <span>Скидка, ₽</span>
            <input
              className="input"
              style={{ width: 120 }}
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
          <div className="order-total-row">
            <span>Скидка, %</span>
            <input
              className="input"
              style={{ width: 120 }}
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </div>
          <div className="order-total-row order-total-row--final">
            <span>Итого</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn btn--primary" type="submit">
            {isNew ? 'Создать заказ' : 'Сохранить'}
          </button>
        </div>
      </form>

      {!isNew && order && (
        <div className="card" style={{ marginTop: 16, maxWidth: 560 }}>
          <div className="page-header">
            <h3>Оплаты</h3>
            <button className="btn btn--sm btn--primary" onClick={() => setPayOpen(true)}>
              Добавить оплату
            </button>
          </div>
          <div className="text-muted" style={{ marginBottom: 12 }}>
            Оплачено: {formatMoney(order.paid_amount)} из {formatMoney(order.total_amount)} ·{' '}
            {order.payment_status}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Сумма</th>
                <th>Комментарий</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(order.finance_transactions ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.payment_type}</td>
                  <td>
                    <span className={PAYMENT_OUT_TYPES.includes(t.payment_type) ? 'mv mv--out' : 'mv mv--in'}>
                      {PAYMENT_OUT_TYPES.includes(t.payment_type) ? '− ' : '+ '}
                      {formatMoney(t.amount)}
                    </span>
                  </td>
                  <td>{t.comment ?? '—'}</td>
                  <td>
                    <button className="btn btn--sm btn--danger" onClick={() => deletePayment(t.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {(order.finance_transactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Оплат пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isNew && order && (
        <form className="card" style={{ marginTop: 16, maxWidth: 560 }} onSubmit={saveDelivery}>
          <h3 style={{ marginBottom: 12 }}>Доставка (Новая Почта)</h3>
          {deliveryError && <div className="form-error">{deliveryError}</div>}
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Получатель</label>
              <input
                className="input"
                value={delivery.recipient_name}
                onChange={(e) => setDeliveryField('recipient_name', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Телефон</label>
              <input
                className="input"
                value={delivery.recipient_phone}
                onChange={(e) => setDeliveryField('recipient_phone', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Город</label>
              <input
                className="input"
                value={delivery.city}
                onChange={(e) => setDeliveryField('city', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Отделение / почтомат</label>
              <input
                className="input"
                value={delivery.branch}
                onChange={(e) => setDeliveryField('branch', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">ТТН</label>
              <input
                className="input"
                value={delivery.ttn}
                onChange={(e) => setDeliveryField('ttn', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Статус доставки</label>
              <input
                className="input"
                value={delivery.delivery_status}
                onChange={(e) => setDeliveryField('delivery_status', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Кто платит</label>
              <select
                className="select"
                value={delivery.delivery_payer}
                onChange={(e) => setDeliveryField('delivery_payer', e.target.value)}
              >
                <option value="">—</option>
                <option value="клиент">Клиент</option>
                <option value="компания">Компания</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Стоимость доставки</label>
              <input
                className="input"
                type="number"
                value={delivery.delivery_cost}
                onChange={(e) => setDeliveryField('delivery_cost', e.target.value)}
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit">
              Сохранить доставку
            </button>
            {deliverySaved && <span className="status-ok">Сохранено</span>}
          </div>
        </form>
      )}

      <Modal open={payOpen} title="Новая оплата" onClose={() => setPayOpen(false)}>
        <form onSubmit={addPayment}>
          {payError && <div className="form-error">{payError}</div>}
          <div className="field">
            <label className="field__label">Тип платежа</label>
            <select className="select" value={payType} onChange={(e) => setPayType(e.target.value)}>
              {PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Сумма</label>
            <input
              className="input"
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Комментарий</label>
            <input
              className="input"
              value={payComment}
              onChange={(e) => setPayComment(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit">
              Добавить
            </button>
            <button className="btn" type="button" onClick={() => setPayOpen(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
