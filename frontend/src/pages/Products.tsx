import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { assetUrl, formatMoney, getApiError } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { Paginated, Product } from '@/types';

interface FormState {
  id: number | null;
  name: string;
  article: string;
  barcode: string;
  color: string;
  model: string;
  size: string;
  comment: string;
  photo_url: string;
  cost_price: string;
  wholesale_price: string;
  retail_price: string;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  article: '',
  barcode: '',
  color: '',
  model: '',
  size: '',
  comment: '',
  photo_url: '',
  cost_price: '',
  wholesale_price: '',
  retail_price: '',
};

export function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<Paginated<Product>>('/products', {
      params: { q: q || undefined, status, page, pageSize: 20 },
    });
    setProducts(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Поиск и смена фильтра возвращают на первую страницу.
  function onSearch(value: string) {
    setQ(value);
    setPage(1);
  }

  function onStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      article: p.article ?? '',
      barcode: p.barcode ?? '',
      color: p.color ?? '',
      model: p.model ?? '',
      size: p.size ?? '',
      comment: p.comment ?? '',
      photo_url: p.photo_url ?? '',
      cost_price: p.cost_price,
      wholesale_price: p.wholesale_price,
      retail_price: p.retail_price,
    });
    setError('');
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      cost_price: Number(form.cost_price) || 0,
      wholesale_price: Number(form.wholesale_price) || 0,
      retail_price: Number(form.retail_price) || 0,
    };
    try {
      if (form.id) {
        await api.patch(`/products/${form.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить товар'));
    }
  }

  // Загружает выбранное фото и подставляет полученный URL в форму.
  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ url: string }>('/uploads', fd);
      setForm((f) => ({ ...f, photo_url: res.data.url }));
    } catch (err) {
      setError(getApiError(err, 'Не удалось загрузить фото'));
    } finally {
      setUploading(false);
    }
  }

  async function archive(p: Product) {
    if (!confirm(`Архивировать товар «${p.name}»?`)) return;
    await api.delete(`/products/${p.id}`);
    await load();
  }

  async function restore(p: Product) {
    await api.patch(`/products/${p.id}`, { is_active: true });
    await load();
  }

  return (
    <div className="tab-pane">
      <div className="toolbar">
        <input
          className="input"
          placeholder="Поиск по названию, артикулу, цвету…"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
        />
        <select className="select" value={status} onChange={(e) => onStatus(e.target.value)}>
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
        title={form.id ? 'Редактирование товара' : 'Новый товар'}
        width={640}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">
            <div className="field field--full">
              <label className="field__label">Название *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Артикул</label>
              <input
                className="input"
                value={form.article}
                onChange={(e) => setForm({ ...form, article: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Штрихкод</label>
              <input
                className="input"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Цвет</label>
              <input
                className="input"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Модель</label>
              <input
                className="input"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Размер</label>
              <input
                className="input"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Фото</label>
              <div className="photo-edit">
                {form.photo_url ? (
                  <img className="photo-preview" src={assetUrl(form.photo_url)} alt="" />
                ) : (
                  <span className="photo-preview photo-preview--empty">нет фото</span>
                )}
                <div className="photo-edit__controls">
                  <input type="file" accept="image/*" onChange={onPickPhoto} disabled={uploading} />
                  <input
                    className="input"
                    placeholder="или вставьте ссылку"
                    value={form.photo_url}
                    onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="field">
              <label className="field__label">Себестоимость</label>
              <input
                className="input"
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Оптовая цена</label>
              <input
                className="input"
                type="number"
                value={form.wholesale_price}
                onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Розничная цена</label>
              <input
                className="input"
                type="number"
                value={form.retail_price}
                onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
              />
            </div>
            <div className="field field--full">
              <label className="field__label">Комментарий</label>
              <input
                className="input"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
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

      <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Фото</th>
            <th>Название</th>
            <th>Артикул</th>
            <th>Цвет / Модель / Размер</th>
            <th>Розн. цена</th>
            <th>Остаток</th>
            <th>Статус</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                {p.photo_url ? (
                  <img className="thumb" src={assetUrl(p.photo_url)} alt="" loading="lazy" />
                ) : (
                  <span className="thumb thumb--empty" />
                )}
              </td>
              <td>{p.name}</td>
              <td>{p.article ?? '—'}</td>
              <td>{[p.color, p.model, p.size].filter(Boolean).join(' / ') || '—'}</td>
              <td>{formatMoney(p.retail_price)}</td>
              <td>{p.stock}</td>
              <td>
                {p.is_active ? (
                  <span className="badge badge--green">Активен</span>
                ) : (
                  <span className="badge badge--gray">Архив</span>
                )}
              </td>
              {isAdmin && (
                <td>
                  <div className="actions">
                    <button className="btn btn--sm" onClick={() => startEdit(p)}>
                      Изменить
                    </button>
                    {p.is_active ? (
                      <button className="btn btn--sm btn--danger" onClick={() => archive(p)}>
                        В архив
                      </button>
                    ) : (
                      <button className="btn btn--sm" onClick={() => restore(p)}>
                        Вернуть
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 8 : 7} className="text-muted">
                Товары не найдены
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
