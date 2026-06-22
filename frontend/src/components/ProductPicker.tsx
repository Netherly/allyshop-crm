import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { Product } from '@/types';

export type PickedProduct = PickedItem;

// Формирует подпись товара для выпадающего списка.
export function productLabel(p: Product): string {
  const parts = [p.name];
  if (p.article) parts.push(p.article);
  if (p.size) parts.push('р.' + p.size);
  return parts.join(' · ');
}

interface Props {
  value: PickedProduct | null;
  onChange: (p: PickedProduct | null) => void;
}

export function ProductPicker({ value, onChange }: Props) {
  return (
    <SearchPicker<Product>
      value={value}
      onChange={onChange}
      endpoint="/products"
      placeholder="Начните вводить название или артикул…"
      mapItem={(p) => ({ id: p.id, label: productLabel(p) })}
    />
  );
}
