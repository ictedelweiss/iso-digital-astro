import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { modules } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';
import { json, errorResponse } from '../../../../lib/validation';
import { parseBody, moduleUpdateSchema } from '../../../../lib/schemas';
import { recordAudit } from '../../../../lib/audit';

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const moduleKey = params.key;
  if (!moduleKey) return errorResponse(400, 'Invalid module key.');

  const parsed = await parseBody(request, moduleUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(modules).where(eq(modules.key, moduleKey)).limit(1);
    const mod = existing[0];
    if (!mod) return errorResponse(404, 'Module not found.');

    const body = parsed.data;

    await db
      .update(modules)
      .set({
        label: body.label ?? mod.label,
        description: body.description !== undefined ? body.description : mod.description,
        icon: body.icon !== undefined ? body.icon : mod.icon,
        sortOrder: body.sort_order ?? mod.sortOrder,
        isActive: body.is_active !== undefined ? body.is_active : mod.isActive,
      })
      .where(eq(modules.key, moduleKey));

    await recordAudit(db, {
      entityType: 'permission',
      entityId: moduleKey,
      action: 'updated',
      notes: `Modul diperbarui: ${moduleKey}`,
      actor: locals.user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update module.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'delete');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const moduleKey = params.key;
  if (!moduleKey) return errorResponse(400, 'Invalid module key.');

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(modules).where(eq(modules.key, moduleKey)).limit(1);
    const mod = existing[0];
    if (!mod) return errorResponse(404, 'Module not found.');

    if (mod.isSystem) {
      return errorResponse(403, 'Modul sistem bawaan tidak boleh dihapus.');
    }

    await db.delete(modules).where(eq(modules.key, moduleKey));

    await recordAudit(db, {
      entityType: 'permission',
      entityId: moduleKey,
      action: 'deleted',
      notes: `Modul kustom dihapus: ${moduleKey}`,
      actor: locals.user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete module.');
  }
};
