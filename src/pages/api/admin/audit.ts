import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { auditLog } from '../../../db/schema';
import { requirePermission } from '../../../lib/permissions';
import { json, errorResponse } from '../../../lib/validation';

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const url = new URL(request.url);
  const entity = url.searchParams.get('entity'); // 'permission', 'user', or all
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const offset = (page - 1) * limit;

  try {
    const db = drizzle(env.DB);

    let whereClause;
    if (entity) {
      whereClause = eq(auditLog.entityType, entity);
    } else {
      whereClause = inArray(auditLog.entityType, ['permission', 'user']);
    }

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(whereClause);

    const total = Number(countRes[0]?.count || 0);

    const logs = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.id))
      .limit(limit)
      .offset(offset);

    return json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        entity_type: l.entityType,
        entity_id: l.entityId,
        action: l.action,
        actor_id: l.actorId,
        actor_name: l.actorName,
        actor_email: l.actorEmail,
        actor_role: l.actorRole,
        notes: l.notes,
        created_at: l.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch {
    return errorResponse(500, 'Failed to load audit logs.');
  }
};
