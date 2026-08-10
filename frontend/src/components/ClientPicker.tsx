import { SearchPicker, PickedItem } from '@/components/SearchPicker';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Client } from '@/types';

interface Props {
  value: PickedItem | null;
  onChange: (p: PickedItem | null) => void;
  // разрешить создание нового клиента прямо из поиска (по доступу clients.create)
  allowCreate?: boolean;
}

// Поиск клиента по имени/телефону. При allowCreate — можно завести нового прямо из заказа.
export function ClientPicker({ value, onChange, allowCreate }: Props) {
  return (
    <SearchPicker<Client>
      value={value}
      onChange={onChange}
      endpoint="/clients"
      placeholder="Начните вводить имя или телефон…"
      mapItem={(c) => ({ id: c.id, label: c.phone ? `${c.name} · ${c.phone}` : c.name })}
      onCreate={
        allowCreate
          ? async (name) => {
              try {
                const { data } = await api.post<Client>('/clients', { name });
                return { id: data.id, label: data.name };
              } catch (err) {
                alert(getApiError(err, 'Не удалось создать клиента'));
                throw err;
              }
            }
          : undefined
      }
    />
  );
}
