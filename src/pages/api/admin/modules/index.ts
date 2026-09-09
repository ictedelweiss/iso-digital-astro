import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { asc, eq } from 'drizzle-orm';
import { modules } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';
import { json, errorResponse } from '../../../../lib/validation';
import { parseBody, moduleCreateSchema } from '../../../../lib/schemas';
import { recordAudit } from '../../../../lib/audit';

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    const list = await db.select().from(modules).orderBy(asc(modules.sortOrder));

    return json({
      success: true,
      data: list.map((m) => ({
        key: m.key,
        label: m.label,
        description: m.description,
        icon: m.icon,
        sort_order: m.sortOrder,
        is_active: Boolean(m.isActive),
        is_system: Boolean(m.isSystem),
      })),
    });
  } catch {
    return errorResponse(500, 'Failed to load modules list.');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, moduleCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db
      .select({ key: modules.key })
      .from(modules)
      .where(eq(modules.key, body.key))
      .limit(1);

    if (existing.length > 0) {
      return errorResponse(409, `Modul dengan key '${body.key}' sudah ada.`);
    }

    await db.insert(modules).values({
      key: body.key,
      label: body.label,
      description: body.description ?? null,
      icon: body.icon ?? null,
      sortOrder: body.sort_order,
      isActive: body.is_active,
      isSystem: false, // Custom module
    });

    await recordAudit(db, {
      entityType: 'permission',
      entityId: body.key,
      action: 'created',
      notes: `Modul kustom dibuat: ${body.label} (${body.key})`,
      actor: locals.user,
    });

    return json({ success: true, key: body.key }, 201);
  } catch {
    return errorResponse(500, 'Failed to create module.');
  }
};
