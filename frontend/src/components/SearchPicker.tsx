import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Paginated } from '@/types';

export interface PickedItem {
  id: number;
  label: string;
}

interface Props<T> {
  value: PickedItem | null;
  onChange: (p: PickedItem | null) => void;
  endpoint: string;
  placeholder: string;
  mapItem: (raw: T) => PickedItem;
  // доп. query-параметры запроса (по умолчанию фильтр активных)
  params?: Record<string, unknown>;
}

// Универсальный поиск сущности по мере ввода (не тянет весь список сразу).
export function SearchPicker<T>({
  value,
  onChange,
  endpoint,
  placeholder,
  mapItem,
  params = { status: 'active' },
}: Props<T>) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim() === '') {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api.get<Paginated<T>>(endpoint, {
        params: { q, pageSize: 8, ...params },
      });
      setResults(res.data.items.map(mapItem));
    }, 250);
    return () => clearTimeout(t);
    // mapItem/endpoint стабильны на время поиска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Закрываем выпадашку по клику вне компонента.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (value) {
    return (
      <div className="picker-chip">
        <span>{value.label}</span>
        <button type="button" className="picker-chip__clear" onClick={() => onChange(null)}>
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="picker" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <ul className="picker__list">
          {results.map((item) => (
            <li
              key={item.id}
              className="picker__item"
              onClick={() => {
                onChange(item);
                setQ('');
                setOpen(false);
              }}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
