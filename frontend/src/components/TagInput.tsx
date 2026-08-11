import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  // Значение через запятую (карточка заказа). false — один тег (инлайн в списке заказов).
  multi?: boolean;
  // Enter, когда выпадашка закрыта (для «добавить тег» в списке заказов).
  onEnter?: () => void;
  onEscape?: () => void;
  onBlur?: () => void;
  // Клик по подсказке (в single-режиме) — сразу выбрать тег.
  onSelect?: (tag: string) => void;
}

// Поле тега с кастомной выпадашкой подсказок из сохранённых тегов (справочник /tags).
export function TagInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
  multi,
  onEnter,
  onEscape,
  onBlur,
  onSelect,
}: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ tag: string; count: number }[]>('/tags')
      .then((r) => setTags(r.data.map((t) => t.tag)))
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const parts = value.split(',').map((s) => s.trim());
  const current = (multi ? parts[parts.length - 1] : value).trim();
  const already = new Set((multi ? parts.slice(0, -1) : []).map((s) => s.toLowerCase()));
  const matches = tags
    .filter((t) => {
      const tl = t.toLowerCase();
      if (already.has(tl)) return false;
      if (tl === current.toLowerCase()) return false;
      return current === '' || tl.includes(current.toLowerCase());
    })
    .slice(0, 8);

  function pick(tag: string) {
    if (multi) {
      onChange([...parts.slice(0, -1), tag].join(', '));
    } else {
      onChange(tag);
      onSelect?.(tag);
    }
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.();
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
      onEscape?.();
    }
  }

  return (
    <div className="picker" ref={boxRef} style={{ display: 'block' }}>
      <input
        className={className ?? 'input'}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {open && matches.length > 0 && (
        <ul className="picker__list">
          {matches.map((t) => (
            // onMouseDown — чтобы выбор сработал раньше onBlur родителя
            <li key={t} className="picker__item" onMouseDown={() => pick(t)}>
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
