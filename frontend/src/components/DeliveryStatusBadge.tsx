// Бейдж статуса доставки Новой Почты: цвет — по коду статуса НП, подпись — текст статуса.
type Props = {
  status?: string | null;
  code?: string | null;
};

// Группируем коды статусов НП в цветовые категории (см. TrackingDocument.getStatusDocuments).
function tone(code?: string | null): string {
  const c = String(code ?? '').trim();
  if (['9', '10', '11', '14', '106'].includes(c)) return 'green'; // отримано / доставлено
  if (['7', '8'].includes(c)) return 'amber'; // прибуло у відділення, очікує отримання
  if (['4', '5', '41', '101'].includes(c)) return 'blue'; // прямує / кур'єр в дорозі
  if (['2', '3', '102', '103', '104', '105', '108'].includes(c)) return 'red'; // не знайдено / відмова / повернення
  return 'gray'; // створено (1) та інше
}

export function DeliveryStatusBadge({ status, code }: Props) {
  const label = (status ?? '').trim();
  if (!label && !code) return <span className="text-muted">—</span>;
  return <span className={`badge badge--${tone(code)}`}>{label || `Статус ${code}`}</span>;
}
