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
  minChars?: number; // с какой длины запроса подгружать (0 — даже пустой, для отделений)
  onSelect?: (item: NpItem) => void; // выбор пункта из списка (даёт ref)
}

// Поле с автоподсказкой из справочников Новой Почты. Если API недоступно (нет ключа) —
// просто работает как обычный текстовый ввод (подсказок нет, но печатать можно).
export function NpAutocomplete({
  value,
  onChange,
  fetchItems,
  placeholder,
  disabled,
  minChars = 2,
  onSelect,
}: Props) {
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
    if (q.length < minChars) {
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

  // Подгрузка при фокусе (нужно для minChars=0: показать список отделений без ввода).
  async function fetchNow() {
    const q = value.trim();
    if (q.length < minChars) return;
    try {
      setItems(await fetchItems(q));
    } catch {
      setItems([]);
    }
  }

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
        onFocus={() => {
          setOpen(true);
          if (items.length === 0) fetchNow();
        }}
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
                onSelect?.(it);
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
