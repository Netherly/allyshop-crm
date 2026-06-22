import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/format';
import { ProductPicker, PickedProduct } from '@/components/ProductPicker';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { Paginated, ProductSet } from '@/types';

interface CompItem {
  product_id: number;
  label: string;
  quantity: number;
}

export function Sets() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [sets, setSets] = useState<ProductSet[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<CompItem[]>([]);
  const [pick, setPick] = useState<PickedProduct | null>(null);
  const [pickQty, setPickQty] = useState('1');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Paginated<ProductSet>>('/sets', {
      params: { q: q || undefined, status, page, pageSize: 20 },
    });
    setSets(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditId(null);
    setName('');
    setDescription('');
    setItems([]);
    setPick(null);
    setPickQty('1');
    setError('');
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  async function startEdit(s: ProductSet) {
    resetForm();
    const res = await api.get<ProductSet>(`/sets/${s.id}`);
    const full = res.data;
    setEditId(full.id);
    setName(full.name);
    setDescription(full.description ?? '');
    setItems(
      (full.set_items ?? []).map((si) => ({
        product_id: si.product_id,
        label: [si.product?.name, si.product?.size && 'р.' + si.product.size]
          .filter(Boolean)
          .join(' · '),
        quantity: si.quantity,
      })),
    );
    setShowForm(true);
  }

  function addItem() {
    if (!pick) return;
    setItems([...items, { product_id: pick.id, label: pick.label, quantity: Number(pickQty) || 1 }]);
    setPick(null);
    setPickQty('1');
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      description: description || null,
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    };
    try {
      if (editId) {
        await api.patch(`/sets/${editId}`, payload);
      } else {
        await api.post('/sets', payload);
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить набор'));
    }
  }

  async function archive(s: ProductSet) {
    if (!confirm(`Архивировать набор «${s.name}»?`)) return;
    await api.delete(`/sets/${s.id}`);
    await load();
  }

  async function restore(s: ProductSet) {
    await api.patch(`/sets/${s.id}`, { is_active: true });
    await load();
  }

  return (
    <div className="tab-pane">
      <div className="toolbar">
        <input
          className="input"
          placeholder="Поиск по названию набора…"
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
          <option value="active">Активные</option>
          <option value="archived">Архив</option>
          <option value="all">Все</option>
        </select>
        {isAdmin && (
          <button className="btn btn--primary toolbar__right" onClick={startCreate}>
            Добавить
          </button>
        )}
      </div>

      <Modal
        open={showForm}
        title={editId ? 'Редактирование набора' : 'Новый набор'}
        width={560}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Название *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Описание</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label">Состав набора</label>
            {items.length > 0 && (
              <table className="table" style={{ marginBottom: 8 }}>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.label}</td>
                      <td style={{ width: 80 }}>× {it.quantity}</td>
                      <td style={{ width: 40 }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => removeItem(idx)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <ProductPicker value={pick} onChange={setPick} />
              </div>
              <input
                className="input"
                type="number"
                style={{ width: 80 }}
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value)}
              />
              <button type="button" className="btn" onClick={addItem} disabled={!pick}>
                Добавить
              </button>
            </div>
          </div>

          <div className="actions">
            <button className="btn btn--primary" type="submit">
              Сохранить
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
            <th>Название</th>
            <th>Позиций</th>
            <th>Доступно</th>
            <th>Статус</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.items_count ?? 0}</td>
              <td>
                <span className={`badge ${s.availability ? 'badge--green' : 'badge--gray'}`}>
                  {s.availability ?? 0} шт
                </span>
              </td>
              <td>
                {s.is_active ? (
                  <span className="badge badge--green">Активен</span>
                ) : (
                  <span className="badge badge--gray">Архив</span>
                )}
              </td>
              {isAdmin && (
                <td>
                  <div className="actions">
                    <button className="btn btn--sm" onClick={() => startEdit(s)}>
                      Изменить
                    </button>
                    {s.is_active ? (
                      <button className="btn btn--sm btn--danger" onClick={() => archive(s)}>
                        В архив
                      </button>
                    ) : (
                      <button className="btn btn--sm" onClick={() => restore(s)}>
                        Вернуть
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {sets.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 5 : 4} className="text-muted">
                Наборы не найдены
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
