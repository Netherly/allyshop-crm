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
      <h1 className="page-title">Теги</h1>
      <div className="text-muted" style={{ marginBottom: 16 }}>
        Все теги из заказов. Переименование и удаление применяются ко всем заказам сразу.
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
    </div>
  );
}
