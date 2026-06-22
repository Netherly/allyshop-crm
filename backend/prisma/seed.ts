import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

// Создаёт первого супер-админа из переменных окружения, если его ещё нет.
async function main() {
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin';
  const name = process.env.SEED_ADMIN_NAME ?? 'Администратор';

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`Пользователь "${login}" уже существует — пропускаем.`);
    return;
  }

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
