import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';
import { json, errorResponse } from '../../../../../lib/validation';
import { recordAudit } from '../../../../../lib/audit';

export const POST: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const targetUser = existing[0];
    if (!targetUser) return errorResponse(404, 'User not found.');

    const newVersion = (targetUser.sessionVersion ?? 0) + 1;
    await db
      .update(users)
      .set({ sessionVersion: newVersion })
      .where(eq(users.id, userId));

    await recordAudit(db, {
      entityType: 'user',
      entityId: userId,
      action: 'updated',
      notes: `Sesi di-reset (sessionVersion: ${targetUser.sessionVersion ?? 0} -> ${newVersion})`,
      actor: locals.user,
    });

    return json({
      success: true,
      session_version: newVersion,
      message: 'Sesi akun berhasil di-reset. Akun akan diminta login ulang pada request berikutnya.',
    });
  } catch {
    return errorResponse(500, 'Gagal me-reset sesi user.');
  }
};
