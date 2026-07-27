import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

// Дефолтные доступы роли «Менеджер»: просмотр всего + работа с заказами/товарами/складом/
// клиентами/финансами (без удалений, корректировок склада и истории).
const MANAGER_PERMS = [
  'dashboard.view',
  'orders.view',
  'orders.create',
  'orders.edit',
  'products.view',
  'products.create',
  'products.edit',
  'sets.view',
  'stock.view',
  'stock.create',
  'stock.edit',
  'clients.view',
  'clients.create',
  'clients.edit',
  'finance.view',
  'finance.create',
  'barcodes.print',
];

async function main() {
  // 1. Дефолтная роль «Менеджер» (идемпотентно).
  const manager = await prisma.appRole.upsert({
    where: { name: 'Менеджер' },
    update: {},
    create: { name: 'Менеджер', permissions: MANAGER_PERMS },
  });
  console.log(`Роль "Менеджер" готова (id=${manager.id}).`);

  // 2. Привязываем обычных пользователей без роли к «Менеджеру» (чтобы не остались без доступа).
  const assigned = await prisma.user.updateMany({
    where: { role: 'user', role_id: null },
    data: { role_id: manager.id },
  });
  if (assigned.count) console.log(`Привязано пользователей к "Менеджеру": ${assigned.count}`);

  // 3. Супер-админ (если ещё нет).
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`Пользователь "${login}" уже существует — пропускаем.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin';
  const name = process.env.SEED_ADMIN_NAME ?? 'Администратор';
  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { full_name: name, login, password_hash, role: 'super_admin' },
  });
  console.log(`Создан супер-админ: ${login}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
