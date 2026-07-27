import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';
import { AppRole, PermissionGroup } from '@/types';

export function Access() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const save = useBusy();

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      api.get<AppRole[]>('/roles'),
      api.get<PermissionGroup[]>('/roles/permissions'),
    ]);
    setRoles(r.data);
    setCatalog(c.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditId(null);
    setName('');
    setSelected(new Set());
    setError('');
    setShowForm(true);
  }

  function startEdit(role: AppRole) {
    setEditId(role.id);
    setName(role.name);
    setSelected(new Set(role.permissions));
    setError('');
    setShowForm(true);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(group: PermissionGroup, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      group.items.forEach((i) => (on ? next.add(i.key) : next.delete(i.key)));
      return next;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = { name: name.trim(), permissions: [...selected] };
    save.run(async () => {
      try {
        if (editId) await api.patch(`/roles/${editId}`, payload);
        else await api.post('/roles', payload);
        setShowForm(false);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Не удалось сохранить роль'));
      }
    });
  }

  async function remove(role: AppRole) {
    if (!confirm(`Удалить роль «${role.name}»?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      await load();
    } catch (err) {
      alert(getApiError(err, 'Не удалось удалить роль'));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Доступы</h1>
        <button className="btn btn--primary" onClick={startCreate}>
          Создать роль
        </button>
      </div>

      <div className="text-muted" style={{ marginBottom: 16 }}>
        Роли и их права. При создании пользователя выбирается одна из этих ролей. Супер-админ имеет
        полный доступ и настраивается отдельно.
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Роль</th>
            <th>Доступов</th>
            <th>Пользователей</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.permissions.length}</td>
              <td>{r.users_count ?? 0}</td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--sm" onClick={() => startEdit(r)} disabled={r.is_system}>
                  Настроить
                </button>
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => remove(r)}
                  disabled={r.is_system}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted">
                Ролей пока нет — создайте первую.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        open={showForm}
        title={editId ? 'Настройка роли' : 'Новая роль'}
        width={560}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Название роли</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field__label" style={{ marginBottom: 8 }}>
            Доступы
          </div>
          {catalog.map((group) => {
            const allOn = group.items.every((i) => selected.has(i.key));
            return (
              <div key={group.group} className="perm-group">
                <label className="perm-group__head">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => toggleGroup(group, e.target.checked)}
                  />
                  <span>{group.group}</span>
                </label>
                <div className="perm-group__items">
                  {group.items.map((it) => (
                    <label key={it.key} className="perm-item">
                      <input
                        type="checkbox"
                        checked={selected.has(it.key)}
                        onChange={() => toggle(it.key)}
                      />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn btn--primary" type="submit" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
