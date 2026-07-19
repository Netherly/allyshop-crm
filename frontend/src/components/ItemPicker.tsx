import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { productTitle } from '@/lib/format';
import { Paginated, Product, ProductSet } from '@/types';

export interface PickedEntity {
  item_type: 'product' | 'set';
  id: number;
  label: string;
}

interface Props {
  value: PickedEntity | null;
  onChange: (e: PickedEntity | null) => void;
}

// Единый поиск позиции: в одном поле подтягиваются и товары, и наборы (без выбора типа).
export function ItemPicker({ value, onChange }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedEntity[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ищем параллельно товары и наборы, показываем общим списком.
  useEffect(() => {
    if (q.trim() === '') {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const [p, s] = await Promise.all([
        api.get<Paginated<Product>>('/products', { params: { q, pageSize: 6, status: 'active' } }),
        api.get<Paginated<ProductSet>>('/sets', { params: { q, pageSize: 4, status: 'active' } }),
      ]);
      const rp: PickedEntity[] = p.data.items.map((x) => ({ item_type: 'product', id: x.id, label: productTitle(x) }));
      const rs: PickedEntity[] = s.data.items.map((x) => ({ item_type: 'set', id: x.id, label: `Набор: ${x.name}` }));
      setResults([...rp, ...rs]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

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
        placeholder="Начните вводить товар или набор…"
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
              key={`${item.item_type}-${item.id}`}
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
