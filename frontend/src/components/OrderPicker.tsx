import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { OrderListItem } from '@/types';

interface Props {
  value: PickedItem | null;
  onChange: (p: PickedItem | null) => void;
}

// Поиск заказа по номеру или клиенту.
export function OrderPicker({ value, onChange }: Props) {
  return (
    <SearchPicker<OrderListItem>
      value={value}
      onChange={onChange}
      endpoint="/orders"
      placeholder="Номер заказа или клиент…"
      params={{}}
      mapItem={(o) => ({
        id: o.id,
        label: o.client ? `№${o.order_number} · ${o.client.name}` : `№${o.order_number}`,
      })}
    />
  );
}
