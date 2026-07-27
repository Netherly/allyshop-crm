// Каталог доступов проекта. Единый источник правды: используется и для проверки прав,
// и отдаётся на фронт для страницы «Доступы» (галочки при настройке роли).

export interface PermissionItem {
  key: string;
  label: string;
}
export interface PermissionGroup {
  group: string;
  items: PermissionItem[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  { group: 'Дашборд', items: [{ key: 'dashboard.view', label: 'Просмотр дашборда' }] },
  {
    group: 'Заказы',
    items: [
      { key: 'orders.view', label: 'Просмотр' },
      { key: 'orders.create', label: 'Создание' },
      { key: 'orders.edit', label: 'Редактирование' },
      { key: 'orders.delete', label: 'Удаление' },
    ],
  },
  {
    group: 'Товары',
    items: [
      { key: 'products.view', label: 'Просмотр' },
      { key: 'products.create', label: 'Создание' },
      { key: 'products.edit', label: 'Редактирование' },
      { key: 'products.delete', label: 'Архивирование' },
    ],
  },
  {
    group: 'Наборы',
    items: [
      { key: 'sets.view', label: 'Просмотр' },
      { key: 'sets.create', label: 'Создание' },
      { key: 'sets.edit', label: 'Редактирование' },
      { key: 'sets.delete', label: 'Архивирование' },
    ],
  },
  {
    group: 'Склад (движения)',
    items: [
      { key: 'stock.view', label: 'Просмотр' },
      { key: 'stock.create', label: 'Создание движений' },
      { key: 'stock.edit', label: 'Редактирование' },
      { key: 'stock.delete', label: 'Удаление' },
      { key: 'stock.corrections', label: 'Корректировки склада' },
    ],
  },
  {
    group: 'Клиенты',
    items: [
      { key: 'clients.view', label: 'Просмотр' },
      { key: 'clients.create', label: 'Создание' },
      { key: 'clients.edit', label: 'Редактирование' },
      { key: 'clients.delete', label: 'Архивирование' },
    ],
  },
  {
    group: 'Финансы',
    items: [
      { key: 'finance.view', label: 'Просмотр' },
      { key: 'finance.create', label: 'Создание операций' },
      { key: 'finance.delete', label: 'Удаление операций' },
    ],
  },
  { group: 'Печать штрих-кодов', items: [{ key: 'barcodes.print', label: 'Печать этикеток' }] },
  { group: 'История', items: [{ key: 'audit.view', label: 'Просмотр истории' }] },
];

// Плоский список всех ключей — для валидации и роли супер-админа.
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key));
