import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { Client } from '@/types';

interface Props {
  value: PickedItem | null;
  onChange: (p: PickedItem | null) => void;
}

// Поиск клиента по имени/телефону.
export function ClientPicker({ value, onChange }: Props) {
  return (
    <SearchPicker<Client>
      value={value}
      onChange={onChange}
      endpoint="/clients"
      placeholder="Начните вводить имя или телефон…"
      mapItem={(c) => ({ id: c.id, label: c.phone ? `${c.name} · ${c.phone}` : c.name })}
    />
  );
}
