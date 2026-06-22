import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Db = typeof prisma | Prisma.TransactionClient;

// Превращает значение в чистый JSON (Decimal → строка, Date → ISO) для записи в audit_log.
function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v));
}

interface AuditParams {
  client?: Db;
  userId?: number | null;
  entityType: string; // orders | products | clients | stock | finance
  entityId: number;
  action: string; // created | updated | deleted | status_changed | payment_added | stock_written_off | stock_returned
  oldValue?: unknown;
  newValue?: unknown;
}

// Пишет запись в журнал действий. Внутри транзакции передавайте client: tx.
// Best-effort: сбой логирования не должен ломать основную операцию.
export async function logAudit(p: AuditParams) {
  const db = p.client ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        user_id: p.userId ?? null,
        entity_type: p.entityType,
        entity_id: p.entityId,
        action: p.action,
        old_value: toJson(p.oldValue),
        new_value: toJson(p.newValue),
      },
    });
  } catch (e) {
    console.error('Не удалось записать в audit_log:', e);
  }
}
