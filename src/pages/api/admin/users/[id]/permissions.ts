import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq } from 'drizzle-orm';
import { modules, rolePermissions, userPermissions, users } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';
import { json, errorResponse } from '../../../../../lib/validation';
import { parseBody, userPermissionsUpdateSchema } from '../../../../../lib/schemas';
import { recordAudit } from '../../../../../lib/audit';
import type { ModuleAccess } from '../../../../../lib/types';

const EMPTY_ACCESS: ModuleAccess = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
};

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  try {
    const db = drizzle(env.DB);
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = existingUser[0];
    if (!user) return errorResponse(404, 'User not found.');

    const allModules = await db.select().from(modules).orderBy(asc(modules.sortOrder));
    const rolePerms = await db.select().from(rolePermissions).where(eq(rolePermissions.role, user.role));
    const userPerms = await db.select().from(userPermissions).where(eq(userPermissions.userId, userId));

    const rolePermMap = new Map<string, ModuleAccess>();
    for (const r of rolePerms) {
      rolePermMap.set(r.moduleKey, {
        view: Boolean(r.canView),
        create: Boolean(r.canCreate),
        edit: Boolean(r.canEdit),
        delete: Boolean(r.canDelete),
        approve: Boolean(r.canApprove),
      });
    }

    const userPermMap = new Map<string, typeof userPerms[0]>();
    for (const u of userPerms) {
      userPermMap.set(u.moduleKey, u);
    }

    const matrix = allModules.map((m) => {
      const defaultRoleAccess = rolePermMap.get(m.key) || { ...EMPTY_ACCESS };
      const override = userPermMap.get(m.key);

      let effectiveAccess: ModuleAccess = { ...defaultRoleAccess };
      let effect: 'allow' | 'deny' | 'inherit' = 'inherit';

      if (override) {
        effect = override.effect as 'allow' | 'deny';
        if (override.effect === 'deny') {
          effectiveAccess = { ...EMPTY_ACCESS };
        } else if (override.effect === 'allow') {
          effectiveAccess = {
            view: Boolean(override.canView),
            create: Boolean(override.canCreate),
            edit: Boolean(override.canEdit),
            delete: Boolean(override.canDelete),
            approve: Boolean(override.canApprove),
          };
        }
      }

      // If inactive, all effective permissions are false
      if (!user.isActive) {
        effectiveAccess = { ...EMPTY_ACCESS };
      }

      return {
        module_key: m.key,
        module_label: m.label,
        module_icon: m.icon,
        is_active: Boolean(m.isActive),
        is_system: Boolean(m.isSystem),
        effect,
        is_overridden: Boolean(override),
        effective: effectiveAccess,
        role_default: defaultRoleAccess,
        override_flags: override
          ? {
              can_view: Boolean(override.canView),
              can_create: Boolean(override.canCreate),
              edit: Boolean(override.canEdit),
              delete: Boolean(override.canDelete),
              approve: Boolean(override.canApprove),
            }
          : null,
      };
    });

    return json({
      success: true,
      user: {
        id: user.id,
        display_name: user.displayName,
        email: user.email,
        role: user.role,
        is_active: Boolean(user.isActive),
      },
      matrix,
    });
  } catch {
    return errorResponse(500, 'Failed to load user permissions matrix.');
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  const parsed = await parseBody(request, userPermissionsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const targetUser = existingUser[0];
    if (!targetUser) return errorResponse(404, 'User not found.');

    const body = parsed.data;

    // Security Rule 3: Suicide check
    if (locals.user?.id === userId) {
      const adminAccessItem = body.permissions.find((p) => p.module_key === 'admin-access');
      if (adminAccessItem) {
        if (adminAccessItem.effect === 'deny') {
          return errorResponse(400, 'Dilarang mencabut akses Admin & Hak Akses dari akun Anda sendiri.');
        }
        if (adminAccessItem.effect === 'allow' && (!adminAccessItem.can_view || !adminAccessItem.can_edit)) {
          return errorResponse(400, 'Dilarang menurunkan izin Admin & Hak Akses pada akun Anda sendiri.');
        }
      }
    }

    const auditNotes: string[] = [];

    for (const item of body.permissions) {
      const existingOverride = await db
        .select()
        .from(userPermissions)
        .where(
          and(
            eq(userPermissions.userId, userId),
            eq(userPermissions.moduleKey, item.module_key)
          )
        )
        .limit(1);

      if (item.effect === 'inherit') {
        if (existingOverride.length > 0) {
          await db
            .delete(userPermissions)
            .where(
              and(
                eq(userPermissions.userId, userId),
                eq(userPermissions.moduleKey, item.module_key)
              )
            );
          auditNotes.push(`${item.module_key}: override dihapus (kembali ke role)`);
        }
      } else {
        const canView = item.effect === 'allow' ? Boolean(item.can_view) : false;
        const canCreate = item.effect === 'allow' ? Boolean(item.can_create) : false;
        const canEdit = item.effect === 'allow' ? Boolean(item.can_edit) : false;
        const canDelete = item.effect === 'allow' ? Boolean(item.can_delete) : false;
        const canApprove = item.effect === 'allow' ? Boolean(item.can_approve) : false;

        if (existingOverride.length > 0) {
          await db
            .update(userPermissions)
            .set({
              effect: item.effect,
              canView,
              canCreate,
              canEdit,
              canDelete,
              canApprove,
            })
            .where(
              and(
                eq(userPermissions.userId, userId),
                eq(userPermissions.moduleKey, item.module_key)
              )
            );
        } else {
          await db.insert(userPermissions).values({
            userId,
            moduleKey: item.module_key,
            effect: item.effect,
            canView,
            canCreate,
            canEdit,
            canDelete,
            canApprove,
          });
        }

        auditNotes.push(
          `${item.module_key}: ${item.effect}${
            item.effect === 'allow'
              ? ` [${[
                  canView && 'view',
                  canCreate && 'create',
                  canEdit && 'edit',
                  canDelete && 'delete',
                  canApprove && 'approve',
                ]
                  .filter(Boolean)
                  .join('+')}]`
              : ''
          }`
        );
      }
    }

    if (auditNotes.length > 0) {
      await recordAudit(db, {
        entityType: 'permission',
        entityId: String(userId),
        action: 'updated',
        notes: `Override hak akses user ${targetUser.displayName}: ${auditNotes.join('; ')}`,
        actor: locals.user,
      });
    }

    return json({
      success: true,
      message: 'Hak akses berhasil diperbarui dan langsung berlaku.',
    });
  } catch {
    return errorResponse(500, 'Gagal memperbarui hak akses user.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) return errorResponse(400, 'Invalid user ID.');

  try {
    const db = drizzle(env.DB);
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const targetUser = existingUser[0];
    if (!targetUser) return errorResponse(404, 'User not found.');

    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));

    await recordAudit(db, {
      entityType: 'permission',
      entityId: String(userId),
      action: 'deleted',
      notes: `Reset semua override hak akses user ${targetUser.displayName} ke default role`,
      actor: locals.user,
    });

    return json({
      success: true,
      message: 'Semua override hak akses berhasil dihapus, hak akses kembali ke default role.',
    });
  } catch {
    return errorResponse(500, 'Gagal me-reset hak akses user.');
  }
};
