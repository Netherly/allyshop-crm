import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatMoney, getApiError, productTitle } from '@/lib/format';
import { ProductPicker, PickedProduct } from '@/components/ProductPicker';
import { SetPicker } from '@/components/SetPicker';
import { PickedItem } from '@/components/SearchPicker';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { ScanMovement } from '@/components/ScanMovement';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';
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
  const [showScan, setShowScan] = useState(false);
  const [type, setType] = useState('приход');
  const [itemType, setItemType] = useState<'product' | 'set'>('product');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [set, setSet] = useState<PickedItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Правка существующего движения.
  const [editing, setEditing] = useState<StockMovement | null>(null);
  const [editProduct, setEditProduct] = useState<PickedProduct | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');

  const create = useBusy();
  const edit = useBusy();

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

  function onSubmit(e: FormEvent) {
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
    create.run(async () => {
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
    });
  }

  // Открывает правку записи. Товар в наборных движениях менять нельзя (set_id != null).
  function openEdit(m: StockMovement) {
    setEditing(m);
    setEditProduct(m.product ? { id: m.product.id, label: productTitle(m.product) } : null);
    setEditQty(String(m.quantity));
    setEditPrice(String(Number(m.price)));
    setEditDesc(m.description ?? '');
    setEditError('');
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError('');
    const isSet = editing.set_id != null;
    edit.run(async () => {
      try {
        await api.patch(`/stock/movements/${editing.id}`, {
          product_id: !isSet ? editProduct?.id : undefined,
          quantity: Number(editQty),
          price: !isSet ? Number(editPrice) || 0 : undefined,
          description: editDesc || null,
        });
        setEditing(null);
        await load();
      } catch (err) {
        setEditError(getApiError(err, 'Не удалось сохранить движение'));
      }
    });
  }

  return (
    <div className="tab-pane">
      <div className="toolbar">
        <div className="text-muted">Приходы, расходы и корректировки склада</div>
        <button className="btn toolbar__right" onClick={() => setShowScan(true)}>
          Сканировать
        </button>
        <button
          className="btn btn--primary"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          Новое движение
        </button>
      </div>

      <Modal
        open={showScan}
        title="Приём / списание по штрих-коду"
        width={640}
        onClose={() => setShowScan(false)}
      >
        <ScanMovement
          onDone={() => {
            setShowScan(false);
            setPage(1);
            load();
          }}
        />
      </Modal>

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
                min="1"
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
                  min="0"
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
            <button className="btn btn--primary" type="submit" disabled={create.busy}>
              {create.busy ? <Spinner label="Создание…" /> : 'Создать'}
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

      <Modal
        open={!!editing}
        title="Редактировать движение"
        width={560}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submitEdit}>
          {editError && <div className="form-error">{editError}</div>}
          {editing?.set_id != null ? (
            // Наборное движение: товар зафиксирован составом набора.
            <div className="field">
              <label className="field__label">Товар (из набора)</label>
              <div className="input input--readonly">
                {editing?.product ? productTitle(editing.product) : '—'}
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="field__label">Товар</label>
              <ProductPicker value={editProduct} onChange={setEditProduct} />
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Количество</label>
              <input
                className="input"
                type="number"
                min="1"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
              />
            </div>
            {editing?.set_id == null && (
              <div className="field">
                <label className="field__label">Цена за единицу</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="field">
            <label className="field__label">Комментарий</label>
            <input
              className="input"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={edit.busy}>
              {edit.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
            <button className="btn" type="button" onClick={() => setEditing(null)}>
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>{formatDateTime(m.movement_date)}</td>
              <td>{typeBadge(m.movement_type)}</td>
              <td>
                {m.product
                  ? productTitle(m.product)
                  : m.set?.name ?? '—'}
              </td>
              <td>{m.quantity}</td>
              <td>{formatMoney(m.price)}</td>
              <td>{formatMoney(m.total)}</td>
              <td>{m.user?.full_name ?? '—'}</td>
              <td className="cell-clip" title={m.description ?? ''}>{m.description ?? '—'}</td>
              <td>
                {/* движения по заказу правятся через заказ — кнопку не показываем */}
                {m.order_id == null && (
                  <button className="btn btn--sm" onClick={() => openEdit(m)} title="Редактировать">
                    ✎
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted">
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
