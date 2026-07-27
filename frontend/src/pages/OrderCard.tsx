import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatMoney, getApiError, productTitle } from '@/lib/format';
import { ItemPicker, PickedEntity } from '@/components/ItemPicker';
import { NpAutocomplete } from '@/components/NpAutocomplete';
import { PickedItem } from '@/components/SearchPicker';
import { ClientPicker } from '@/components/ClientPicker';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';
import { useAuth } from '@/lib/auth';
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
  const { hasPermission } = useAuth();
  const canSave = isNew ? hasPermission('orders.create') : hasPermission('orders.edit');
  const canDelete = hasPermission('orders.delete');
  const canPay = hasPermission('finance.create');

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

  // Защита от повторного сабмита (двойные клики → дубли).
  const submit = useBusy();
  const pay = useBusy();
  const deliv = useBusy();

  // Конструктор позиции: единый пикер товара/набора (без выбора типа).
  const [builderPick, setBuilderPick] = useState<PickedEntity | null>(null);
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
    sender_name: '',
    sender_city: '',
    weight: '',
    scheduled_delivery_date: '',
    actual_delivery_date: '',
    payer_type: '',
    cargo_description: '',
    status_code: '',
  });
  const [deliverySaved, setDeliverySaved] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const track = useBusy();

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
        label: productTitle(it),
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
      sender_name: d?.sender_name ?? '',
      sender_city: d?.sender_city ?? '',
      weight: d?.weight ?? '',
      scheduled_delivery_date: d?.scheduled_delivery_date ?? '',
      actual_delivery_date: d?.actual_delivery_date ?? '',
      payer_type: d?.payer_type ?? '',
      cargo_description: d?.cargo_description ?? '',
      status_code: d?.status_code ?? '',
    });
  }, [id, isNew]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Автоподстановка цены при выборе товара в конструкторе (для наборов цена не нужна — раскладываются).
  useEffect(() => {
    if (!builderPick || builderPick.item_type === 'set') return;
    defaultPrice('product', builderPick.id, orderType).then((p) => setBuilderPrice(String(p)));
  }, [builderPick, orderType]);

  async function addLine() {
    if (!builderPick) return;
    const setQty = Number(builderQty) || 1;

    if (builderPick.item_type === 'set') {
      // Набор разворачиваем в отдельные товарные строки, чтобы можно было убрать любой из них.
      const s = (await api.get(`/sets/${builderPick.id}`)).data;
      type SetItem = {
        quantity: number;
        product: {
          id: number;
          name: string;
          size?: string | null;
          color?: string | null;
          model?: string | null;
          wholesale_price: string;
          retail_price: string;
        };
      };
      const newLines: DraftLine[] = (s.set_items ?? []).map((si: SetItem) => ({
        key: `${Date.now()}-${Math.random()}`,
        item_type: 'product' as const,
        ref_id: si.product.id,
        label: productTitle(si.product),
        quantity: si.quantity * setQty,
        price: String(Number(orderType === 'опт' ? si.product.wholesale_price : si.product.retail_price)),
      }));
      setLines((prev) => [...prev, ...newLines]);
    } else {
      setLines((prev) => [
        ...prev,
        {
          key: `${Date.now()}-${Math.random()}`,
          item_type: 'product',
          ref_id: builderPick.id,
          label: builderPick.label,
          quantity: setQty,
          price: builderPrice || '0',
        },
      ]);
    }

    setBuilderPick(null);
    setBuilderQty('1');
    setBuilderPrice('');
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // Уменьшить количество позиции на 1; если дошло до 0 — удаляем строку.
  function decrementLine(key: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l)).filter((l) => l.quantity > 0),
    );
  }

  // Ручное редактирование количества и цены строки.
  function setLineQuantity(key: string, value: string) {
    const q = Math.max(1, Math.floor(Number(value) || 1));
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: q } : l)));
  }
  function setLinePrice(key: string, value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, price: value } : l)));
  }

  // После списания со склада состав менять нельзя.
  const writtenOff = !!order?.stock_written_off;

  const subtotal = lines.reduce((s, l) => s + Number(l.price) * l.quantity, 0);
  const total = Math.max(
    0,
    subtotal - Number(discountAmount || 0) - (subtotal * Number(discountPercent || 0)) / 100,
  );

  function addPayment(e: FormEvent) {
    e.preventDefault();
    setPayError('');
    pay.run(async () => {
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
    });
  }

  async function deletePayment(txId: number) {
    if (!confirm('Удалить операцию?')) return;
    await api.delete(`/finance/${txId}`);
    await loadOrder();
  }

  function saveDelivery(e: FormEvent) {
    e.preventDefault();
    setDeliveryError('');
    setDeliverySaved(false);
    deliv.run(async () => {
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
    });
  }

  function setDeliveryField(field: string, value: string) {
    setDelivery((d) => ({ ...d, [field]: value }));
    setDeliverySaved(false);
  }

  // Подтянуть данные по ТТН из API Новой Почты и заполнить форму.
  function trackTtn() {
    const ttn = delivery.ttn.trim();
    if (!ttn) {
      setDeliveryError('Укажите ТТН');
      return;
    }
    setDeliveryError('');
    track.run(async () => {
      try {
        const { data } = await api.get(`/np/track/${ttn}`);
        setDelivery((d) => ({
          ...d,
          recipient_name: data.recipient_name ?? d.recipient_name,
          recipient_phone: data.recipient_phone ?? d.recipient_phone,
          city: data.city ?? d.city,
          branch: data.branch ?? d.branch,
          delivery_status: data.delivery_status ?? d.delivery_status,
          status_code: data.status_code ?? d.status_code,
          sender_name: data.sender_name ?? d.sender_name,
          sender_city: data.sender_city ?? d.sender_city,
          weight: data.weight ?? d.weight,
          delivery_cost: data.delivery_cost != null ? String(data.delivery_cost) : d.delivery_cost,
          scheduled_delivery_date: data.scheduled_delivery_date ?? d.scheduled_delivery_date,
          actual_delivery_date: data.actual_delivery_date ?? d.actual_delivery_date,
          payer_type: data.payer_type ?? d.payer_type,
          cargo_description: data.cargo_description ?? d.cargo_description,
        }));
        setDeliverySaved(false);
      } catch (err) {
        setDeliveryError(getApiError(err, 'Не удалось получить данные по ТТН'));
      }
    });
  }

  function handleSave() {
    setError('');
    if (lines.length === 0) {
      setError('Добавьте хотя бы одну позицию');
      return;
    }
    submit.run(doSubmit);
  }

  async function removeOrder() {
    if (!confirm(`Удалить заказ № ${order?.order_number}? Оплаты и складские движения по нему тоже удалятся.`)) {
      return;
    }
    try {
      await api.delete(`/orders/${id}`);
      navigate('/orders');
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить заказ'));
    }
  }

  async function doSubmit() {
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
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && order && canDelete && (
            <button className="btn btn--danger" onClick={removeOrder}>
              Удалить заказ
            </button>
          )}
          <button className="btn" onClick={() => navigate('/orders')}>
            ← К списку
          </button>
        </div>
      </div>

      {!isNew && order && (
        <div className="text-muted" style={{ marginBottom: 16 }}>
          Менеджер: {order.manager?.full_name ?? '—'} · Оплата: {order.payment_status} · Списан со
          склада: {order.stock_written_off ? 'да' : 'нет'}
          {order.stock_returned ? ' · Возвращён на склад: да' : ''}
        </div>
      )}

      <div className="order-edit">
        {error && <div className="form-error">{error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Клиент (необязательно)</label>
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
                  <td>
                    {writtenOff ? (
                      l.quantity
                    ) : (
                      <input
                        className="input"
                        style={{ width: 70 }}
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) => setLineQuantity(l.key, e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {writtenOff ? (
                      formatMoney(l.price)
                    ) : (
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min="0"
                        value={l.price}
                        onChange={(e) => setLinePrice(l.key, e.target.value)}
                      />
                    )}
                  </td>
                  <td>{formatMoney(Number(l.price) * l.quantity)}</td>
                  <td>
                    {!writtenOff && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => decrementLine(l.key)}
                          title="Убрать 1 штуку"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => removeLine(l.key)}
                          title="Удалить позицию целиком"
                        >
                          ×
                        </button>
                      </div>
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
            <div style={{ flex: 1, minWidth: 260 }}>
              <ItemPicker value={builderPick} onChange={setBuilderPick} />
            </div>
            <input
              className="input"
              style={{ width: 80 }}
              type="number"
              min="1"
              placeholder={builderPick?.item_type === 'set' ? 'наборов' : 'кол-во'}
              value={builderQty}
              onChange={(e) => setBuilderQty(e.target.value)}
            />
            {builderPick?.item_type !== 'set' && (
              <input
                className="input"
                style={{ width: 100 }}
                type="number"
                min="0"
                placeholder="цена"
                value={builderPrice}
                onChange={(e) => setBuilderPrice(e.target.value)}
              />
            )}
            <button type="button" className="btn" onClick={addLine} disabled={!builderPick}>
              Добавить
            </button>
          </div>
          )}
        </div>

      </div>

      <div className="order-lower">
        <div className="card">
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
          {canSave && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn--primary" type="button" onClick={handleSave} disabled={submit.busy}>
                {submit.busy ? (
                  <Spinner label={isNew ? 'Создание…' : 'Сохранение…'} />
                ) : isNew ? (
                  'Создать заказ'
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          )}
        </div>

      {!isNew && order && (
        <div className="card">
          <div className="page-header">
            <h3>Оплаты</h3>
            {canPay && (
              <button className="btn btn--sm btn--primary" onClick={() => setPayOpen(true)}>
                Добавить оплату
              </button>
            )}
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
        <form className="card" onSubmit={saveDelivery}>
          <h3 style={{ marginBottom: 12 }}>Доставка (Новая Почта)</h3>
          {deliveryError && <div className="form-error">{deliveryError}</div>}
          <div className="form-grid">
            <div className="field field--full">
              <label className="field__label">ТТН</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={delivery.ttn}
                  onChange={(e) => setDeliveryField('ttn', e.target.value)}
                  placeholder="номер накладной Новой Почты"
                />
                <button
                  type="button"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={trackTtn}
                  disabled={track.busy || !delivery.ttn.trim()}
                >
                  {track.busy ? <Spinner label="Загрузка…" /> : 'Подтянуть по ТТН'}
                </button>
              </div>
            </div>

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
              <NpAutocomplete
                value={delivery.city}
                onChange={(v) => setDeliveryField('city', v)}
                fetchItems={(q) => api.get('/np/cities', { params: { q } }).then((r) => r.data)}
                placeholder="начните вводить город"
              />
            </div>
            <div className="field">
              <label className="field__label">Отделение / почтомат</label>
              <NpAutocomplete
                value={delivery.branch}
                onChange={(v) => setDeliveryField('branch', v)}
                fetchItems={(q) =>
                  api.get('/np/warehouses', { params: { city: delivery.city, q } }).then((r) => r.data)
                }
                placeholder={delivery.city ? 'начните вводить отделение' : 'сначала выберите город'}
                disabled={!delivery.city}
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
              <label className="field__label">Тип плательщика (НП)</label>
              <input
                className="input"
                value={delivery.payer_type}
                onChange={(e) => setDeliveryField('payer_type', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Вес, кг</label>
              <input
                className="input"
                value={delivery.weight}
                onChange={(e) => setDeliveryField('weight', e.target.value)}
              />
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
            <div className="field">
              <label className="field__label">Плановая дата</label>
              <input
                className="input"
                value={delivery.scheduled_delivery_date}
                onChange={(e) => setDeliveryField('scheduled_delivery_date', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Фактическая дата</label>
              <input
                className="input"
                value={delivery.actual_delivery_date}
                onChange={(e) => setDeliveryField('actual_delivery_date', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Отправитель</label>
              <input
                className="input"
                value={delivery.sender_name}
                onChange={(e) => setDeliveryField('sender_name', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Город отправителя</label>
              <input
                className="input"
                value={delivery.sender_city}
                onChange={(e) => setDeliveryField('sender_city', e.target.value)}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Описание груза</label>
              <input
                className="input"
                value={delivery.cargo_description}
                onChange={(e) => setDeliveryField('cargo_description', e.target.value)}
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
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={deliv.busy}>
              {deliv.busy ? <Spinner label="Сохранение…" /> : 'Сохранить доставку'}
            </button>
            {deliverySaved && <span className="status-ok">Сохранено</span>}
          </div>
        </form>
      )}
      </div>

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
            <button className="btn btn--primary" type="submit" disabled={pay.busy}>
              {pay.busy ? <Spinner label="Добавление…" /> : 'Добавить'}
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
