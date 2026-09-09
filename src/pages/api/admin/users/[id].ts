import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, not, or, sql } from 'drizzle-orm';
import { users, userPermissions } from '../../../../db/schema';
import { requirePermission, resolvePermissions } from '../../../../lib/permissions';
import { json, errorResponse } from '../../../../lib/validation';
import { parseBody, adminUserUpdateSchema } from '../../../../lib/schemas';
import { recordAudit } from '../../../../lib/audit';

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = existing[0];
    if (!user) return errorResponse(404, 'User not found.');

    const permissions = await resolvePermissions(db, user.id, user.role);

    return json({
      success: true,
      data: {
        id: user.id,
        display_name: user.displayName,
        email: user.email,
        username: user.username,
        department: user.department,
        job_title: user.jobTitle,
        role: user.role,
        is_active: Boolean(user.isActive),
        session_version: user.sessionVersion ?? 0,
        last_login_at: user.lastLoginAt,
        created_at: user.createdAt,
        permissions,
      },
    });
  } catch {
    return errorResponse(500, 'Failed to load user detail.');
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  const parsed = await parseBody(request, adminUserUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const targetUser = existing[0];
    if (!targetUser) return errorResponse(404, 'User not found.');

    const currentActor = locals.user;
    const body = parsed.data;

    // Security Rule 3: Digital suicide prevention
    if (currentActor?.id === userId) {
      if (body.role !== undefined && body.role !== 'admin') {
        return errorResponse(400, 'Dilarang menurunkan role akun Anda sendiri.');
      }
      if (body.is_active === false) {
        return errorResponse(400, 'Dilarang menonaktifkan akun Anda sendiri.');
      }
    }

    // Security Rule 2: Minimum one active super-admin
    const isTargetActiveAdmin = targetUser.role === 'admin' && targetUser.isActive;
    const willDemoteOrDeactivate =
      (body.role !== undefined && body.role !== 'admin') || body.is_active === false;

    if (isTargetActiveAdmin && willDemoteOrDeactivate) {
      const adminCountRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      const activeAdmins = Number(adminCountRes[0]?.count || 0);
      if (activeAdmins <= 1) {
        return errorResponse(
          409,
          'Operasi ditolak: Sistem harus memiliki minimal satu akun super-admin yang aktif.'
        );
      }
    }

    // Check email/username duplicates if changed
    if (body.email && body.email !== targetUser.email.toLowerCase()) {
      const emailConflict = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, body.email), not(eq(users.id, userId))))
        .limit(1);
      if (emailConflict.length > 0) {
        return errorResponse(409, `Email '${body.email}' sudah digunakan oleh akun lain.`);
      }
    }

    if (body.username && body.username !== targetUser.username.toLowerCase()) {
      const usernameConflict = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, body.username), not(eq(users.id, userId))))
        .limit(1);
      if (usernameConflict.length > 0) {
        return errorResponse(409, `Username '${body.username}' sudah digunakan oleh akun lain.`);
      }
    }

    // If account is being deactivated, bump sessionVersion to force immediate logout
    const newSessionVersion =
      body.is_active === false
        ? (targetUser.sessionVersion ?? 0) + 1
        : targetUser.sessionVersion ?? 0;

    await db
      .update(users)
      .set({
        displayName: body.display_name ?? targetUser.displayName,
        email: body.email ?? targetUser.email,
        username: body.username ?? targetUser.username,
        department: body.department ?? targetUser.department,
        jobTitle: body.job_title ?? targetUser.jobTitle,
        role: body.role ?? targetUser.role,
        isActive: body.is_active !== undefined ? body.is_active : targetUser.isActive,
        sessionVersion: newSessionVersion,
      })
      .where(eq(users.id, userId));

    // Audit summary of changes
    const changes: string[] = [];
    if (body.display_name && body.display_name !== targetUser.displayName) changes.push(`nama: ${targetUser.displayName} -> ${body.display_name}`);
    if (body.role && body.role !== targetUser.role) changes.push(`role: ${targetUser.role} -> ${body.role}`);
    if (body.is_active !== undefined && body.is_active !== Boolean(targetUser.isActive)) {
      changes.push(`status: ${targetUser.isActive ? 'aktif' : 'nonaktif'} -> ${body.is_active ? 'aktif' : 'nonaktif'}`);
    }

    await recordAudit(db, {
      entityType: 'user',
      entityId: userId,
      action: 'updated',
      notes: changes.length > 0 ? changes.join(', ') : 'User data updated',
      actor: locals.user,
    });

    return json({ success: true, message: 'Data user berhasil diperbarui.' });
  } catch {
    return errorResponse(500, 'Gagal memperbarui data user.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'delete');
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

    // Security Rule 3: Digital suicide prevention
    if (locals.user?.id === userId) {
      return errorResponse(400, 'Dilarang menghapus akun Anda sendiri.');
    }

    // Security Rule 2: Minimum one active super-admin
    if (targetUser.role === 'admin' && targetUser.isActive) {
      const adminCountRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      const activeAdmins = Number(adminCountRes[0]?.count || 0);
      if (activeAdmins <= 1) {
        return errorResponse(
          409,
          'Operasi ditolak: Sistem harus memiliki minimal satu akun super-admin yang aktif.'
        );
      }
    }

    // Soft delete (§3.3): isActive = false + bump sessionVersion + delete userPermissions overrides
    await db
      .update(users)
      .set({
        isActive: false,
        sessionVersion: (targetUser.sessionVersion ?? 0) + 1,
      })
      .where(eq(users.id, userId));

    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));

    await recordAudit(db, {
      entityType: 'user',
      entityId: userId,
      action: 'deleted',
      notes: `Soft delete akun: ${targetUser.displayName} (${targetUser.email})`,
      actor: locals.user,
    });

    return json({ success: true, message: 'Akun berhasil dinonaktifkan/dihapus.' });
  } catch {
    return errorResponse(500, 'Gagal menghapus akun user.');
  }
};
