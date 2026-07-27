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

// Отслеживание по ТТН — возвращаем нормализованные поля доставки.
export async function trackByTtn(ttn: string, phone = '') {
  const data = await call('TrackingDocument', 'getStatusDocuments', {
    Documents: [{ DocumentNumber: ttn, Phone: phone }],
  });
  const d = data[0];
  if (!d || d.StatusCode === '3') throw new AppError(404, 'ТТН не найдена');
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

// Поиск населённых пунктов (автоподсказка города).
export async function searchCities(q: string) {
  const data = await call('Address', 'searchSettlements', { CityName: q, Limit: '10' });
  const addresses = data[0]?.Addresses ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return addresses.map((a: any) => ({ ref: a.Ref ?? a.DeliveryCity ?? null, name: a.Present ?? a.MainDescription ?? '' }));
}

// Отделения/почтоматы по городу.
export async function getWarehouses(city: string, q = '') {
  const data = await call('Address', 'getWarehouses', { CityName: city, FindByString: q, Limit: '20' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((w: any) => ({ ref: w.Ref, name: w.Description }));
}
