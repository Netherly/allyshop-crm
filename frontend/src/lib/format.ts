// Форматирует денежное значение (строку или число) в рублёвый вид.
export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Форматирует дату-время в коротком русском виде.
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Относительное время: «только что / N мин / N ч / N дн назад». Для «обновлено … назад».
export function formatAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

// Дата-время без года: ДД.ММ ЧЧ:ММ — для таблиц, где год не нужен.
export function formatDateShort(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Подпись товара: Название · цвет · размер · модель (пустые поля пропускаем).
export function productTitle(p: {
  name: string;
  color?: string | null;
  size?: string | null;
  model?: string | null;
}): string {
  return [p.name, p.color, p.size ? 'р.' + p.size : null, p.model].filter(Boolean).join(' · ');
}

// Строит полный URL до файла на сервере. Внешние ссылки возвращает как есть.
export function assetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return origin + url;
}

// Достаёт текст ошибки из ответа API.
export function getApiError(err: unknown, fallback = 'Ошибка'): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const r = (err as { response?: { data?: { error?: string } } }).response;
    if (r?.data?.error) return r.data.error;
  }
  return fallback;
}
