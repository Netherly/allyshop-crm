import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatMoney, getApiError } from '@/lib/format';
import { ProductPicker, PickedProduct } from '@/components/ProductPicker';
import { SetPicker } from '@/components/SetPicker';
import { PickedItem } from '@/components/SearchPicker';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { Paginated, StockMovement } from '@/types';

// Приходные типы показываем зелёным «+», расходные — красным «−».
const INCOMING = ['приход', 'возврат', 'корректировка_плюс'];

function typeBadge(type: string) {
  const incoming = INCOMING.includes(type);
  return (
    <span className={incoming ? 'mv mv--in' : 'mv mv--out'}>
      {incoming ? '+ ' : '− '}
      {type.replace('_', ' ')}
    </span>
  );
}

export function Movements() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [items, setItems] = useState<StockMovement[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('приход');
  const [itemType, setItemType] = useState<'product' | 'set'>('product');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [set, setSet] = useState<PickedItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Paginated<StockMovement>>('/stock/movements', {
      params: { page, pageSize: 20 },
    });
    setItems(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setType('приход');
    setItemType('product');
    setProduct(null);
    setSet(null);
    setQuantity('');
    setPrice('');
    setDescription('');
    setError('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (itemType === 'product' && !product) {
      setError('Выберите товар');
      return;
    }
    if (itemType === 'set' && !set) {
      setError('Выберите набор');
      return;
    }
    try {
      await api.post('/stock/movements', {
        movement_type: type,
        item_type: itemType,
        product_id: itemType === 'product' ? product!.id : undefined,
        set_id: itemType === 'set' ? set!.id : undefined,
        quantity: Number(quantity),
        // цена применяется только к товару; у набора компоненты идут с ценой 0
        price: itemType === 'product' ? Number(price) || 0 : 0,
        description: description || undefined,
      });
      resetForm();
      setShowForm(false);
      setPage(1);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось создать движение'));
    }
  }

  return (
    <div className="tab-pane">
      <div className="toolbar">
        <div className="text-muted">Приходы, расходы и корректировки склада</div>
        <button
          className="btn btn--primary toolbar__right"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          Новое движение
        </button>
      </div>

      <Modal
        open={showForm}
        title="Новое движение"
        width={560}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Тип движения</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="приход">Приход</option>
              <option value="расход">Расход</option>
              {isAdmin && <option value="корректировка_плюс">Корректировка +</option>}
              {isAdmin && <option value="корректировка_минус">Корректировка −</option>}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Что добавляем</label>
            <select
              className="select"
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value as 'product' | 'set');
                setProduct(null);
                setSet(null);
              }}
            >
              <option value="product">Товар</option>
              <option value="set">Набор</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">{itemType === 'set' ? 'Набор' : 'Товар'}</label>
            {itemType === 'set' ? (
              <SetPicker value={set} onChange={setSet} />
            ) : (
              <ProductPicker value={product} onChange={setProduct} />
            )}
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">
                {itemType === 'set' ? 'Количество наборов' : 'Количество'}
              </label>
              <input
                className="input"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {itemType === 'set' && (
                <span className="field__hint">
                  Товары спишутся/придут по составу набора × это число
                </span>
              )}
            </div>
            {itemType === 'product' && (
              <div className="field">
                <label className="field__label">Цена за единицу</label>
                <input
                  className="input"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="field">
            <label className="field__label">Комментарий</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit">
              Создать
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тип</th>
            <th>Товар</th>
            <th>Кол-во</th>
            <th>Цена</th>
            <th>Сумма</th>
            <th>Кто</th>
            <th>Комментарий</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>{formatDateTime(m.movement_date)}</td>
              <td>{typeBadge(m.movement_type)}</td>
              <td>
                {m.product
                  ? [m.product.name, m.product.size && 'р.' + m.product.size]
                      .filter(Boolean)
                      .join(' · ')
                  : m.set?.name ?? '—'}
              </td>
              <td>{m.quantity}</td>
              <td>{formatMoney(m.price)}</td>
              <td>{formatMoney(m.total)}</td>
              <td>{m.user?.full_name ?? '—'}</td>
              <td>{m.description ?? '—'}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="text-muted">
                Движений пока нет
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
