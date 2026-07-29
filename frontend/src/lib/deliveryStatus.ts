// Подсказка следующего статуса заказа по статусу ТТН (не автомат — решает менеджер).
const DELIVERED = ['9', '10', '11', '14', '106']; // отримано / доставлено
const ON_THE_WAY = ['4', '5', '7', '8', '41', '101']; // в дорозі / прибуло у відділення

// Порядок этапов заказа — чтобы предлагать только движение вперёд.
const ORDER_FLOW = [
  'Новый',
  'В работе',
  'Ожидает оплату',
  'Оплачен',
  'Собирается',
  'Отправлен',
  'Получен',
  'Завершен',
];
const TERMINAL = ['Отменен', 'Возврат', 'Завершен'];

// Возвращает предлагаемый статус заказа или null (если предлагать нечего).
export function suggestOrderStatus(code: string | null | undefined, current: string): string | null {
  const c = String(code ?? '').trim();
  if (TERMINAL.includes(current)) return null; // отменённые/возвраты/завершённые не трогаем
  if (DELIVERED.includes(c)) return current === 'Получен' ? null : 'Получен';
  if (ON_THE_WAY.includes(c)) {
    const idx = ORDER_FLOW.indexOf(current);
    return idx >= 0 && idx < ORDER_FLOW.indexOf('Отправлен') ? 'Отправлен' : null;
  }
  return null;
}
