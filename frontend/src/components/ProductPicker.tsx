import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { productTitle } from '@/lib/format';
import { Product } from '@/types';

export type PickedProduct = PickedItem;

// Формирует подпись товара для выпадающего списка: Название · цвет · размер · модель.
export function productLabel(p: Product): string {
  return productTitle(p);
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
