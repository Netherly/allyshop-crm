// Цветной бейдж статуса заказа. Цвета согласованы с клиентом.
const STATUS_CLASS: Record<string, string> = {
  Новый: 'badge--blue', // голубой
  'В работе': 'badge--amber', // жёлтый
  'Ожидает оплату': 'badge--amber',
  Оплачен: 'badge--green',
  Собирается: 'badge--gray',
  Отправлен: 'badge--purple', // фиолетовый
  'В дороге': 'badge--white', // белый — синхронизировано с трекингом НП
  Получен: 'badge--green', // зелёный
  Отменен: 'badge--gray',
  Возврат: 'badge--red', // красный
  Завершен: 'badge--gray',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'badge--gray'}`}>{status}</span>;
}
