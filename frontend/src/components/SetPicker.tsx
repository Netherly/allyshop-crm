import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { ProductSet } from '@/types';

interface Props {
  value: PickedItem | null;
  onChange: (p: PickedItem | null) => void;
}

// Поиск набора по названию.
export function SetPicker({ value, onChange }: Props) {
  return (
    <SearchPicker<ProductSet>
      value={value}
      onChange={onChange}
      endpoint="/sets"
      placeholder="Начните вводить название набора…"
      mapItem={(s) => ({ id: s.id, label: s.name })}
    />
  );
}
