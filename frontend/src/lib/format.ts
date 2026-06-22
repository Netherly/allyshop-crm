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
