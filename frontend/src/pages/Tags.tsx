import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';

interface TagRow {
  tag: string;
  count: number;
}

// Управление тегами (супер-админ): переименование и удаление во всех заказах.
export function Tags() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const save = useBusy();

  // Создание нового тега.
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const createBusy = useBusy();

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreateError('');
    createBusy.run(async () => {
      try {
        await api.post('/tags', { name });
        setCreating(false);
        setCreateName('');
        await load();
      } catch (err) {
        setCreateError(getApiError(err, 'Не удалось создать тег'));
      }
    });
  }

  const load = useCallback(async () => {
    const r = await api.get<TagRow[]>('/tags');
    setRows(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startRename(row: TagRow) {
    setEditing(row);
    setNewName(row.tag);
    setError('');
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const to = newName.trim();
    if (!to || to === editing.tag) {
      setEditing(null);
      return;
    }
    setError('');
    save.run(async () => {
      try {
        await api.patch('/tags/rename', { from: editing.tag, to });
        setEditing(null);
        await load();
      } catch (err) {
        setError(getApiError(err, 'Не удалось переименовать тег'));
      }
    });
  }

  async function remove(row: TagRow) {
    if (!confirm(`Удалить тег «${row.tag}» из всех заказов (${row.count})?`)) return;
    try {
      await api.delete(`/tags/${encodeURIComponent(row.tag)}`);
      await load();
    } catch (err) {
      alert(getApiError(err, 'Не удалось удалить тег'));
    }
  }

  return (
    <div className="page-fill">
      <div className="page-header">
        <h1 className="page-title">Теги</h1>
        <button
          className="btn btn--primary"
          onClick={() => {
            setCreateName('');
            setCreateError('');
            setCreating(true);
          }}
        >
          Создать тег
        </button>
      </div>
      <div className="text-muted" style={{ marginBottom: 16 }}>
        Сохранённые теги — из них берётся автоподсказка. Переименование и удаление применяются ко
        всем заказам. Теги, введённые в заказе, но не сохранённые здесь, действуют только в своём
        заказе.
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Тег</th>
              <th>Заказов</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tag}>
                <td>{r.tag}</td>
                <td>{r.count}</td>
                <td>
                  <div className="actions">
                    <button className="btn btn--sm" onClick={() => startRename(r)}>
                      Переименовать
                    </button>
                    <button className="btn btn--sm btn--danger" onClick={() => remove(r)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted">
                  Тегов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} title="Переименовать тег" onClose={() => setEditing(null)}>
        <form onSubmit={submitRename}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="field__label">Новое название</label>
            <input
              className="input"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={save.busy}>
              {save.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
            </button>
            <button className="btn" type="button" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={creating} title="Новый тег" onClose={() => setCreating(false)}>
        <form onSubmit={submitCreate}>
          {createError && <div className="form-error">{createError}</div>}
          <div className="field">
            <label className="field__label">Название</label>
            <input
              className="input"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="например: Иван дроп"
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={createBusy.busy}>
              {createBusy.busy ? <Spinner label="Создание…" /> : 'Создать'}
            </button>
            <button className="btn" type="button" onClick={() => setCreating(false)}>
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
