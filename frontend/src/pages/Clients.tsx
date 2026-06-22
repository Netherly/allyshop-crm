import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { Client, CounterpartyType, Paginated } from '@/types';

const COUNTERPARTY_LABELS: Record<CounterpartyType, string> = {
  client: 'Клиент',
  supplier: 'Поставщик',
  both: 'Оба',
  other: 'Другое',
};

const CLIENT_TYPES = ['опт', 'дроп', 'розница', 'другое'];

interface FormState {
  id: number | null;
  name: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  np_branch: string;
  counterparty_type: CounterpartyType;
  client_type: string;
  comment: string;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  phone: '',
  email: '',
  instagram: '',
  city: '',
  np_branch: '',
  counterparty_type: 'client',
  client_type: '',
  comment: '',
};

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [ctype, setCtype] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Paginated<Client>>('/clients', {
      params: {
        q: q || undefined,
        status,
        counterparty_type: ctype || undefined,
        page,
        pageSize: 20,
      },
    });
    setClients(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [q, status, ctype, page]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function startEdit(c: Client) {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      instagram: c.instagram ?? '',
      city: c.city ?? '',
      np_branch: c.np_branch ?? '',
      counterparty_type: c.counterparty_type,
      client_type: c.client_type ?? '',
      comment: c.comment ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { id, ...payload } = form;
    try {
      if (id) {
        await api.patch(`/clients/${id}`, payload);
      } else {
        await api.post('/clients', payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить клиента'));
    }
  }

  async function archive(c: Client) {
    if (!confirm(`Архивировать «${c.name}»?`)) return;
    await api.delete(`/clients/${c.id}`);
    await load();
  }

  async function restore(c: Client) {
    await api.patch(`/clients/${c.id}`, { is_active: true });
    await load();
  }

  return (
    <div>
      <h1 className="page-title">Клиенты</h1>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Поиск по имени, телефону, Instagram…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={ctype}
          onChange={(e) => {
            setCtype(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все типы</option>
          <option value="client">Клиенты</option>
          <option value="supplier">Поставщики</option>
          <option value="both">Оба</option>
          <option value="other">Другое</option>
        </select>
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
        <button className="btn btn--primary toolbar__right" onClick={startCreate}>
          Добавить
        </button>
      </div>

      <Modal
        open={showForm}
        title={form.id ? 'Редактирование клиента' : 'Новый клиент'}
        width={640}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">
            <div className="field field--full">
              <label className="field__label">Имя *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Телефон</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Instagram</label>
              <input
                className="input"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Email</label>
              <input
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Город</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Отделение/почтомат НП</label>
              <input
                className="input"
                value={form.np_branch}
                onChange={(e) => setForm({ ...form, np_branch: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Тип контрагента</label>
              <select
                className="select"
                value={form.counterparty_type}
                onChange={(e) =>
                  setForm({ ...form, counterparty_type: e.target.value as CounterpartyType })
                }
              >
                <option value="client">Клиент</option>
                <option value="supplier">Поставщик</option>
                <option value="both">Оба</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Тип клиента</label>
              <select
                className="select"
                value={form.client_type}
                onChange={(e) => setForm({ ...form, client_type: e.target.value })}
              >
                <option value="">—</option>
                {CLIENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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

      <table className="table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Телефон</th>
            <th>Instagram</th>
            <th>Тип</th>
            <th>Город</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.phone ?? '—'}</td>
              <td>{c.instagram ?? '—'}</td>
              <td>
                {COUNTERPARTY_LABELS[c.counterparty_type]}
                {c.client_type ? ` · ${c.client_type}` : ''}
              </td>
              <td>{c.city ?? '—'}</td>
              <td>
                {c.is_active ? (
                  <span className="badge badge--green">Активен</span>
                ) : (
                  <span className="badge badge--gray">Архив</span>
                )}
              </td>
              <td>
                <div className="actions">
                  <button className="btn btn--sm" onClick={() => startEdit(c)}>
                    Изменить
                  </button>
                  {c.is_active ? (
                    <button className="btn btn--sm btn--danger" onClick={() => archive(c)}>
                      В архив
                    </button>
                  ) : (
                    <button className="btn btn--sm" onClick={() => restore(c)}>
                      Вернуть
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted">
                Клиенты не найдены
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  );
}
