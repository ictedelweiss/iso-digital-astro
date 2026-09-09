import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq } from 'drizzle-orm';
import { modules, rolePermissions } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';
import { json, errorResponse } from '../../../../../lib/validation';
import { parseBody, rolePermissionsUpdateSchema } from '../../../../../lib/schemas';
import { recordAudit } from '../../../../../lib/audit';
import type { ModuleAccess } from '../../../../../lib/types';

const VALID_ROLES = ['admin', 'coordinator', 'approver', 'staff'] as const;

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const role = params.role as (typeof VALID_ROLES)[number];
  if (!role || !VALID_ROLES.includes(role)) {
    return errorResponse(400, 'Role tidak valid.');
  }

  try {
    const db = drizzle(env.DB);
    const allModules = await db.select().from(modules).orderBy(asc(modules.sortOrder));
    const roleRows = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role));

    const roleMap = new Map<string, typeof roleRows[0]>();
    for (const r of roleRows) {
      roleMap.set(r.moduleKey, r);
    }

    const data = allModules.map((m) => {
      const row = roleMap.get(m.key);
      return {
        module_key: m.key,
        module_label: m.label,
        module_icon: m.icon,
        is_active: Boolean(m.isActive),
        is_system: Boolean(m.isSystem),
        can_view: Boolean(row?.canView),
        can_create: Boolean(row?.canCreate),
        can_edit: Boolean(row?.canEdit),
        can_delete: Boolean(row?.canDelete),
        can_approve: Boolean(row?.canApprove),
      };
    });

    return json({ success: true, role, matrix: data });
  } catch {
    return errorResponse(500, 'Failed to load role permissions matrix.');
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'edit');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const role = params.role as (typeof VALID_ROLES)[number];
  if (!role || !VALID_ROLES.includes(role)) {
    return errorResponse(400, 'Role tidak valid.');
  }

  const parsed = await parseBody(request, rolePermissionsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    // Security Rule: Admin role must always retain admin-access
    if (role === 'admin') {
      const adminAccessItem = body.permissions.find((p) => p.module_key === 'admin-access');
      if (adminAccessItem && (!adminAccessItem.can_view || !adminAccessItem.can_edit)) {
        return errorResponse(400, 'Role admin wajib memiliki hak akses view dan edit pada modul admin-access.');
      }
    }

    const auditNotes: string[] = [];

    for (const item of body.permissions) {
      const existing = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.role, role),
            eq(rolePermissions.moduleKey, item.module_key)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(rolePermissions)
          .set({
            canView: item.can_view,
            canCreate: item.can_create,
            canEdit: item.can_edit,
            canDelete: item.can_delete,
            canApprove: item.can_approve,
          })
          .where(
            and(
              eq(rolePermissions.role, role),
              eq(rolePermissions.moduleKey, item.module_key)
            )
          );
      } else {
        await db.insert(rolePermissions).values({
          role,
          moduleKey: item.module_key,
          canView: item.can_view,
          canCreate: item.can_create,
          canEdit: item.can_edit,
          canDelete: item.can_delete,
          canApprove: item.can_approve,
        });
      }

      auditNotes.push(
        `${item.module_key}: [${[
          item.can_view && 'view',
          item.can_create && 'create',
          item.can_edit && 'edit',
          item.can_delete && 'delete',
          item.can_approve && 'approve',
        ]
          .filter(Boolean)
          .join('+')}]`
      );
    }

    await recordAudit(db, {
      entityType: 'permission',
      entityId: role,
      action: 'updated',
      notes: `Perubahan default hak akses role '${role}': ${auditNotes.join('; ')}`,
      actor: locals.user,
    });

    return json({
      success: true,
      message: `Default hak akses untuk role '${role}' berhasil disimpan.`,
    });
  } catch {
    return errorResponse(500, 'Gagal memperbarui default hak akses role.');
  }
};
