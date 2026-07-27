import { useEffect, useRef, useState } from 'react';

export interface NpItem {
  ref: string | null;
  name: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  fetchItems: (q: string) => Promise<NpItem[]>;
  placeholder?: string;
  disabled?: boolean;
}

// Поле с автоподсказкой из справочников Новой Почты. Если API недоступно (нет ключа) —
// просто работает как обычный текстовый ввод (подсказок нет, но печатать можно).
export function NpAutocomplete({ value, onChange, fetchItems, placeholder, disabled }: Props) {
  const [items, setItems] = useState<NpItem[]>([]);
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setItems(await fetchItems(q));
      } catch {
        setItems([]);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="picker" ref={boxRef}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && items.length > 0 && (
        <ul className="picker__list">
          {items.map((it, i) => (
            <li
              key={it.ref ?? i}
              className="picker__item"
              onClick={() => {
                skipNext.current = true;
                onChange(it.name);
                setOpen(false);
              }}
            >
              {it.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
