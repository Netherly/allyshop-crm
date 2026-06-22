import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { User } from '@/types';

interface FormState {
  id: number | null;
  full_name: string;
  login: string;
  password: string;
  role: 'user' | 'super_admin';
}

const emptyForm: FormState = { id: null, full_name: '', login: '', password: '', role: 'user' };

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await api.get<User[]>('/users');
    setUsers(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function startEdit(u: User) {
    setForm({ id: u.id, full_name: u.full_name, login: u.login, password: '', role: u.role });
    setError('');
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        // при редактировании пароль отправляем только если заполнен
        const payload: Record<string, unknown> = {
          full_name: form.full_name,
          login: form.login,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${form.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Ошибка сохранения'));
    }
  }

  async function archive(u: User) {
    if (!confirm(`Заблокировать пользователя «${u.full_name}»?`)) return;
    await api.patch(`/users/${u.id}`, { is_active: false });
    await load();
  }

  async function activate(u: User) {
    await api.patch(`/users/${u.id}`, { is_active: true });
    await load();
  }

  async function remove(u: User) {
    if (!confirm(`Удалить пользователя «${u.full_name}» безвозвратно?`)) return;
    setError('');
    try {
      await api.delete(`/users/${u.id}`);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Не удалось удалить пользователя'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Пользователи</h1>
        <button className="btn btn--primary" onClick={startCreate}>
          Добавить
        </button>
      </div>

      {error && !showForm && <div className="form-error">{error}</div>}

      {showForm && (
        <form className="card" style={{ marginBottom: 16, maxWidth: 460 }} onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">ФИО</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Логин</label>
            <input
              className="input"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">
              Пароль {form.id && <span className="text-muted">(оставьте пустым, чтобы не менять)</span>}
            </label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label">Роль</label>
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as FormState['role'] })}
            >
              <option value="user">Пользователь</option>
              <option value="super_admin">Супер-админ</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" type="submit">
              Сохранить
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Логин</th>
            <th>Роль</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.login}</td>
              <td>{u.role === 'super_admin' ? 'Супер-админ' : 'Пользователь'}</td>
              <td>
                {u.is_active ? (
                  <span className="badge badge--green">Активен</span>
                ) : (
                  <span className="badge badge--gray">Заблокирован</span>
                )}
              </td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--sm" onClick={() => startEdit(u)}>
                  Изменить
                </button>
                {u.is_active ? (
                  <button className="btn btn--sm btn--danger" onClick={() => archive(u)}>
                    Заблокировать
                  </button>
                ) : (
                  <button className="btn btn--sm" onClick={() => activate(u)}>
                    Разблокировать
                  </button>
                )}
                <button className="btn btn--sm btn--danger" onClick={() => remove(u)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
