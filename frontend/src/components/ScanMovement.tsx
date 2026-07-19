import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError, productTitle } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Paginated, Product, ProductSet } from '@/types';

interface ScanLine {
  key: string;
  item_type: 'product' | 'set';
  ref_id: number;
  label: string;
  quantity: string;
  price: string;
}

interface Result {
  item_type: 'product' | 'set';
  id: number;
  label: string;
}

interface Props {
  onDone: () => void;
}

// Форма приёма/списания сканированием: одна строка ввода (название или штрих-код),
// позиции копятся вниз (по 1 шт), каждая при сохранении — отдельное движение.
export function ScanMovement({ onDone }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [movementType, setMovementType] = useState('приход');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Поиск по названию: товары + наборы.
  useEffect(() => {
    const v = query.trim();
    if (v === '') {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const [p, s] = await Promise.all([
        api.get<Paginated<Product>>('/products', { params: { q: v, pageSize: 6, status: 'active' } }),
        api.get<Paginated<ProductSet>>('/sets', { params: { q: v, pageSize: 4, status: 'active' } }),
      ]);
      const rp: Result[] = p.data.items.map((x) => ({ item_type: 'product', id: x.id, label: productTitle(x) }));
      const rs: Result[] = s.data.items.map((x) => ({ item_type: 'set', id: x.id, label: `Набор: ${x.name}` }));
      setResults([...rp, ...rs]);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addLine(item_type: 'product' | 'set', ref_id: number, label: string) {
    setLines((prev) => [
      ...prev,
      { key: `${Date.now()}-${Math.random()}`, item_type, ref_id, label, quantity: '1', price: '0' },
    ]);
    setQuery('');
    setResults([]);
    setError('');
    inputRef.current?.focus();
  }

  async function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = query.trim();
    if (!v) return;

    // Только цифры — считаем штрих-кодом, ищем товар по коду.
    if (/^\d{6,}$/.test(v)) {
      try {
        const r = await api.get<Product>(`/products/lookup/${v}`);
        addLine('product', r.data.id, productTitle(r.data));
      } catch {
        setError(`Штрих-код ${v} не найден`);
        setQuery('');
        inputRef.current?.focus();
      }
      return;
    }

    // Иначе, если найден ровно один — добавляем его.
    if (results.length === 1) addLine(results[0].item_type, results[0].id, results[0].label);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function setLineField(key: string, field: 'quantity' | 'price', value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (lines.length === 0) {
      setError('Отсканируйте хотя бы одну позицию');
      return;
    }
    setBusy(true);
    try {
      await api.post('/stock/movements/bulk', {
        movement_type: movementType,
        items: lines.map((l) => ({
          item_type: l.item_type,
          product_id: l.item_type === 'product' ? l.ref_id : undefined,
          set_id: l.item_type === 'set' ? l.ref_id : undefined,
          quantity: Number(l.quantity) || 1,
          price: Number(l.price) || 0,
        })),
      });
      onDone();
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить движения'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label className="field__label">Тип движения</label>
        <select className="select" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
          <option value="приход">Приход</option>
          <option value="расход">Расход</option>
          {isAdmin && <option value="корректировка_плюс">Корректировка +</option>}
          {isAdmin && <option value="корректировка_минус">Корректировка −</option>}
        </select>
      </div>

      <div className="field">
        <label className="field__label">Штрих-код или название</label>
        <div className="picker">
          <input
            ref={inputRef}
            className="input"
            autoFocus
            placeholder="Отсканируйте код или начните вводить название…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          {results.length > 0 && (
            <ul className="picker__list">
              {results.map((r) => (
                <li
                  key={`${r.item_type}-${r.id}`}
                  className="picker__item"
                  onClick={() => addLine(r.item_type, r.id, r.label)}
                >
                  {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="field__hint">
          Скан штрих-кода добавляет товар по 1 шт; название можно выбрать из списка.
        </span>
      </div>

      <table className="table" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Позиция</th>
            <th style={{ width: 90 }}>Кол-во</th>
            <th style={{ width: 110 }}>Цена</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key}>
              <td>{l.label}</td>
              <td>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={l.quantity}
                  onChange={(e) => setLineField(l.key, 'quantity', e.target.value)}
                />
              </td>
              <td>
                {l.item_type === 'product' ? (
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={l.price}
                    onChange={(e) => setLineField(l.key, 'price', e.target.value)}
                  />
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => removeLine(l.key)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted">
                Отсканируйте товары — они появятся здесь
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="actions">
        <button className="btn btn--primary" type="submit" disabled={busy || lines.length === 0}>
          {busy ? 'Сохранение…' : `Сохранить (${lines.length})`}
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Отмена
        </button>
      </div>
    </form>
  );
}
