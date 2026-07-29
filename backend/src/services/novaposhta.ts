import { AppError } from '../lib/errors.js';

// Единая точка API Новой Почты. Ключ — только на сервере (env), во фронт не попадает.
const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';

function apiKey(): string {
  const key = process.env.NOVAPOSHTA_API_KEY;
  if (!key || key.trim() === '') {
    throw new AppError(503, 'API-ключ Новой Почты не настроен (NOVAPOSHTA_API_KEY)');
  }
  return key.trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>): Promise<any[]> {
  // Проверку ключа делаем ДО try, иначе её ошибка (503) перехватится как сетевая (502).
  const key = apiKey();
  let res: Response;
  try {
    res = await fetch(NP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key, modelName, calledMethod, methodProperties }),
    });
  } catch {
    throw new AppError(502, 'Не удалось связаться с сервисом Новой Почты');
  }
  const json = await res.json();
  if (!json.success) {
    const msg = Array.isArray(json.errors) && json.errors.length ? json.errors.join('; ') : 'Ошибка запроса к Новой Почте';
    throw new AppError(400, msg);
  }
  return json.data ?? [];
}

// Нормализуем ответ getStatusDocuments в поля нашей доставки.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeStatusDoc(d: any, ttn: string) {
  return {
    ttn,
    delivery_status: d.Status ?? null,
    status_code: d.StatusCode != null ? String(d.StatusCode) : null,
    recipient_name: d.RecipientFullName ?? null,
    recipient_phone: d.PhoneRecipient ?? null,
    city: d.CityRecipient ?? null,
    branch: d.WarehouseRecipient ?? null,
    sender_name: d.CounterpartySenderDescription ?? d.SenderFullNameEW ?? null,
    sender_city: d.CitySender ?? null,
    weight: d.DocumentWeight != null ? String(d.DocumentWeight) : null,
    delivery_cost: d.DocumentCost != null ? Number(d.DocumentCost) : null,
    scheduled_delivery_date: d.ScheduledDeliveryDate ?? null,
    actual_delivery_date: d.ActualDeliveryDate || d.RecipientDateTime || null,
    payer_type: d.PayerType ?? null,
    cargo_description: d.CargoDescriptionString ?? null,
    np_raw_status: d.Status ?? null,
  };
}

export type TrackedDoc = ReturnType<typeof normalizeStatusDoc>;

// Отслеживание по ТТН — возвращаем нормализованные поля доставки.
export async function trackByTtn(ttn: string, phone = '') {
  const data = await call('TrackingDocument', 'getStatusDocuments', {
    Documents: [{ DocumentNumber: ttn, Phone: phone }],
  });
  const d = data[0];
  if (!d || d.StatusCode === '3') throw new AppError(404, 'ТТН не найдена');
  return normalizeStatusDoc(d, ttn);
}

// Батч-трекинг: до 100 ТТН за один запрос. Возвращаем карту ttn → данные.
// Не найденные (StatusCode 3) пропускаем. Читающий метод — ограничение ключа не нарушаем.
export async function trackBatch(ttns: string[]): Promise<Map<string, TrackedDoc>> {
  const result = new Map<string, TrackedDoc>();
  for (let i = 0; i < ttns.length; i += 100) {
    const chunk = ttns.slice(i, i + 100);
    const data = await call('TrackingDocument', 'getStatusDocuments', {
      Documents: chunk.map((n) => ({ DocumentNumber: n, Phone: '' })),
    });
    for (const d of data) {
      const num = d.Number != null ? String(d.Number) : null;
      if (!num || d.StatusCode === '3') continue;
      result.set(num, normalizeStatusDoc(d, num));
    }
  }
  return result;
}

// Поиск населённых пунктов (автоподсказка города).
// ref — это CityRef (DeliveryCity) для последующего запроса отделений.
export async function searchCities(q: string) {
  const data = await call('Address', 'searchSettlements', { CityName: q, Limit: '10' });
  const addresses = data[0]?.Addresses ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return addresses.map((a: any) => ({ ref: a.DeliveryCity ?? a.Ref ?? null, name: a.Present ?? a.MainDescription ?? '' }));
}

// Кэш «название города → CityRef», чтобы не резолвить один и тот же город на каждый ввод.
const cityRefCache = new Map<string, { ref: string | null; ts: number }>();
const CITY_CACHE_TTL = 60 * 60 * 1000; // час

// Резолвит название города в CityRef (getWarehouses по названию с областью не находит).
async function resolveCityRef(city: string): Promise<string | null> {
  const key = city.trim().toLowerCase();
  const cached = cityRefCache.get(key);
  if (cached && Date.now() - cached.ts < CITY_CACHE_TTL) return cached.ref;
  const data = await call('Address', 'searchSettlements', { CityName: city, Limit: '1' });
  const a = data[0]?.Addresses?.[0];
  const ref = a?.DeliveryCity ?? a?.Ref ?? null;
  cityRefCache.set(key, { ref, ts: Date.now() });
  return ref;
}

// Отделения/почтоматы. Ищем по CityRef: если ref не передан — резолвим из названия города.
export async function getWarehouses(opts: { cityRef?: string; city?: string; q?: string }) {
  const cityRef = opts.cityRef?.trim() || (opts.city ? await resolveCityRef(opts.city) : null);
  if (!cityRef) return [];
  const data = await call('Address', 'getWarehouses', {
    CityRef: cityRef,
    FindByString: opts.q ?? '',
    Limit: '20',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((w: any) => ({ ref: w.Ref, name: w.Description }));
}
