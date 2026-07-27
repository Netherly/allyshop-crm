import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatDateShort, formatMoney, getApiError } from '@/lib/format';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useBusy } from '@/lib/useBusy';
import { useAuth } from '@/lib/auth';
import { ORDER_STATUSES, ORDER_TYPES } from '@/lib/orderConstants';
import { OrderListItem, Paginated, Role } from '@/types';

// Короткая подпись роли автора заказа.
function roleLabel(role?: Role): string {
  if (role === 'super_admin') return 'Админ';
  if (role === 'user') return 'Менеджер';
  return '';
}

// Разбивает строку тегов на отдельные значения (разделитель — запятая).
function parseTags(tags: string | null): string[] {
  return (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function Orders() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('orders.create');
  const canEdit = hasPermission('orders.edit');
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [orderType, setOrderType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Инлайн-добавление тега: id заказа, у которого открыт ввод, и текст.
  const [addingTagFor, setAddingTagFor] = useState<number | null>(null);
  const [newTag, setNewTag] = useState('');

  // Правка комментария из списка.
  const [editing, setEditing] = useState<OrderListItem | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editError, setEditError] = useState('');
  const saveBusy = useBusy();

  const load = useCallback(async () => {
    const res = await api.get<Paginated<OrderListItem>>('/orders', {
      params: {
        q: q || undefined,
        status: status || undefined,
        order_type: orderType || undefined,
        page,
        pageSize: 20,
      },
    });
    setOrders(res.data.items);
    setTotalPages(res.data.totalPages);
    setTotal(res.data.total);
  }, [q, status, orderType, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Сохраняет набор тегов заказа и перезагружает список.
  async function saveTags(o: OrderListItem, tags: string[]) {
    await api.patch(`/orders/${o.id}`, { tags: tags.join(', ') || null });
    await load();
  }

  function removeTag(o: OrderListItem, tag: string) {
    saveTags(o, parseTags(o.tags).filter((t) => t !== tag));
  }

  async function addTag(o: OrderListItem) {
    const t = newTag.trim();
    const existing = parseTags(o.tags);
    if (t && !existing.includes(t)) {
      await saveTags(o, [...existing, t]);
    }
    setAddingTagFor(null);
    setNewTag('');
  }

  function openComment(o: OrderListItem) {
    setEditing(o);
    setEditComment(o.comment ?? '');
    setEditError('');
  }

  function saveComment(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError('');
    saveBusy.run(async () => {
      try {
        await api.patch(`/orders/${editing.id}`, { comment: editComment.trim() || null });
        setEditing(null);
        await load();
      } catch (err) {
        setEditError(getApiError(err, 'Не удалось сохранить'));
      }
    });
  }

  return (
    <div>
      <h1 className="page-title">Заказы</h1>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Поиск по номеру или клиенту…"
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
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={orderType}
          onChange={(e) => {
            setOrderType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все типы</option>
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {canCreate && (
          <button className="btn btn--primary toolbar__right" onClick={() => navigate('/orders/new')}>
            Создать заказ
          </button>
        )}
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>№</th>
              <th>Дата</th>
              <th>Теги</th>
              <th>Клиент</th>
              <th>Чей заказ?</th>
              <th>Тип</th>
              <th>Поз.</th>
              <th>Статус</th>
              <th>Оплата</th>
              <th>Сумма</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/orders/${o.id}`)}
              >
                <td>{o.order_number}</td>
                <td>{formatDateShort(o.order_date ?? o.created_at)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="tag-list">
                    {parseTags(o.tags).map((t) => (
                      <span
                        key={t}
                        className="tag-chip"
                        title={canEdit ? 'Нажмите, чтобы удалить' : ''}
                        onClick={canEdit ? () => removeTag(o, t) : undefined}
                        style={canEdit ? undefined : { cursor: 'default' }}
                      >
                        {t}
                        {canEdit && <span className="tag-chip__x">×</span>}
                      </span>
                    ))}
                    {parseTags(o.tags).length === 0 && !canEdit && <span className="text-muted">—</span>}
                    {canEdit &&
                      (addingTagFor === o.id ? (
                        <input
                          autoFocus
                          className="tag-input"
                          placeholder="Enter — добавить"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addTag(o);
                            if (e.key === 'Escape') {
                              setAddingTagFor(null);
                              setNewTag('');
                            }
                          }}
                          onBlur={() => {
                            setAddingTagFor(null);
                            setNewTag('');
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="tag-add"
                          title="Добавить тег"
                          onClick={() => {
                            setAddingTagFor(o.id);
                            setNewTag('');
                          }}
                        >
                          +
                        </button>
                      ))}
                  </div>
                </td>
                <td>{o.client?.name ?? '—'}</td>
                <td>
                  {o.manager?.full_name ?? '—'}
                  {o.manager && <span className="text-muted"> · {roleLabel(o.manager.role)}</span>}
                </td>
                <td>{o.order_type}</td>
                <td>{o.items_count}</td>
                <td>
                  <span className="badge">{o.status}</span>
                </td>
                <td>{o.payment_status}</td>
                <td>{formatMoney(o.total_amount)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="comment-cell">
                    <span className="cell-clip" title={o.comment ?? ''}>
                      {o.comment || '—'}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn--sm"
                        title="Изменить комментарий"
                        onClick={() => openComment(o)}
                      >
                        ✎
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={11} className="text-muted">
                  Заказов не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal
        open={!!editing}
        title={editing ? `Комментарий к заказу № ${editing.order_number}` : ''}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={saveComment}>
          {editError && <div className="form-error">{editError}</div>}
          <div className="field">
            <label className="field__label">Комментарий</label>
            <textarea
              className="input"
              rows={3}
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
            />
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={saveBusy.busy}>
              {saveBusy.busy ? <Spinner label="Сохранение…" /> : 'Сохранить'}
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
