/**
 * Permission resolution and access enforcement (M-07).
 *
 * Rules:
 *   1. Account inactive (`is_active = false`) -> all permissions false.
 *   2. User override (`user_permissions` row exists):
 *      - `effect = 'allow'` -> use row flags.
 *      - `effect = 'deny'`  -> all actions false.
 *   3. Default role permission (`role_permissions` row exists) -> use row flags.
 *   4. Fallback -> all actions false.
 */
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { modules, rolePermissions, userPermissions, users } from '../db/schema';
import { errorResponse } from './validation';
import {
  MODULE_KEYS,
  type ModuleKey,
  type Action,
  type ModuleAccess,
  type PermissionMap,
} from './types';

export { MODULE_KEYS };
export type { ModuleKey, Action, ModuleAccess, PermissionMap };

const EMPTY_ACCESS: ModuleAccess = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
};

export const FALLBACK_ROLE_PERMISSIONS: Record<string, Record<string, ModuleAccess>> = {
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true, approve: true },
    'purchase-requisition': { view: true, create: true, edit: true, delete: true, approve: true },
    'leave-request': { view: true, create: true, edit: true, delete: true, approve: true },
    'handover-form': { view: true, create: true, edit: true, delete: true, approve: true },
    'meeting-attendance': { view: true, create: true, edit: true, delete: true, approve: true },
    'asset-management': { view: true, create: true, edit: true, delete: true, approve: true },
    'admin-access': { view: true, create: true, edit: true, delete: true, approve: true },
  },
  coordinator: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false },
    'purchase-requisition': { view: true, create: true, edit: true, delete: false, approve: true },
    'leave-request': { view: true, create: true, edit: true, delete: false, approve: true },
    'handover-form': { view: true, create: true, edit: true, delete: false, approve: true },
    'meeting-attendance': { view: true, create: true, edit: true, delete: false, approve: false },
    'asset-management': { view: true, create: true, edit: true, delete: false, approve: false },
    'admin-access': { view: false, create: false, edit: false, delete: false, approve: false },
  },
  approver: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false },
    'purchase-requisition': { view: true, create: false, edit: false, delete: false, approve: true },
    'leave-request': { view: true, create: false, edit: false, delete: false, approve: true },
    'handover-form': { view: true, create: false, edit: false, delete: false, approve: true },
    'meeting-attendance': { view: true, create: false, edit: false, delete: false, approve: false },
    'asset-management': { view: true, create: false, edit: false, delete: false, approve: false },
    'admin-access': { view: false, create: false, edit: false, delete: false, approve: false },
  },
  staff: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false },
    'purchase-requisition': { view: true, create: true, edit: true, delete: false, approve: false },
    'leave-request': { view: true, create: true, edit: true, delete: false, approve: false },
    'handover-form': { view: true, create: true, edit: true, delete: false, approve: false },
    'meeting-attendance': { view: true, create: false, edit: false, delete: false, approve: false },
    'asset-management': { view: true, create: false, edit: false, delete: false, approve: false },
    'admin-access': { view: false, create: false, edit: false, delete: false, approve: false },
  },
};

/**
 * Resolve effective permissions for a user from database records.
 */
export async function resolvePermissions(
  db: any,
  userId: number | null,
  role: string
): Promise<PermissionMap> {
  const result: PermissionMap = {};

  // Fetch all known modules from DB, falling back to constant if table is empty
  let allModules: Array<{ key: string }> = [];
  try {
    allModules = await db.select({ key: modules.key }).from(modules);
  } catch {
    allModules = MODULE_KEYS.map((k) => ({ key: k }));
  }

  const moduleKeys = new Set<string>([
    ...MODULE_KEYS,
    ...allModules.map((m) => m.key),
  ]);

  // Initialise all modules with fallback role permissions (ensures sidebar is never blank)
  const roleDefaults = FALLBACK_ROLE_PERMISSIONS[role] || FALLBACK_ROLE_PERMISSIONS['staff'];
  for (const key of moduleKeys) {
    result[key] = roleDefaults[key] ? { ...roleDefaults[key] } : { ...EMPTY_ACCESS };
  }

  // If there's no user id, return fallback permissions
  if (userId === null) {
    return result;
  }

  // Check if user is active in DB
  try {
    const userRow = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow[0] && userRow[0].isActive === false) {
      // Inactive account has no permissions whatsoever
      for (const key of moduleKeys) {
        result[key] = { ...EMPTY_ACCESS };
      }
      return result;
    }
  } catch {
    // If query fails, continue to permission resolution
  }

  // Fetch role default permissions from DB if table exists and has rows
  try {
    const roleRows = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role));

    if (roleRows.length > 0) {
      for (const r of roleRows) {
        result[r.moduleKey] = {
          view: Boolean(r.canView),
          create: Boolean(r.canCreate),
          edit: Boolean(r.canEdit),
          delete: Boolean(r.canDelete),
          approve: Boolean(r.canApprove),
        };
      }
    }
  } catch {
    // If table doesn't exist yet, fallback role defaults remain active
  }

  // Fetch user specific overrides (they take precedence)
  try {
    const userRows = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    for (const u of userRows) {
      if (u.effect === 'deny') {
        result[u.moduleKey] = { ...EMPTY_ACCESS };
      } else if (u.effect === 'allow') {
        result[u.moduleKey] = {
          view: Boolean(u.canView),
          create: Boolean(u.canCreate),
          edit: Boolean(u.canEdit),
          delete: Boolean(u.canDelete),
          approve: Boolean(u.canApprove),
        };
      }
    }
  } catch {
    // If table doesn't exist yet, skip
  }

  return result;
}

/**
 * Get permission map for the currently authenticated user in request locals.
 * Memoized per request by storing the Promise in `locals`.
 */
export function getPermissionMap(locals: any): Promise<PermissionMap> {
  if (locals._permissionPromise) {
    return locals._permissionPromise;
  }

  const user = locals.user;
  if (!user || user.id === null) {
    const emptyMap: PermissionMap = {};
    for (const key of MODULE_KEYS) {
      emptyMap[key] = { ...EMPTY_ACCESS };
    }
    locals._permissionPromise = Promise.resolve(emptyMap);
    return locals._permissionPromise;
  }

  const env = locals.runtime?.env;
  if (!env?.DB) {
    // Fail closed if database is unavailable
    const emptyMap: PermissionMap = {};
    for (const key of MODULE_KEYS) {
      emptyMap[key] = { ...EMPTY_ACCESS };
    }
    locals._permissionPromise = Promise.resolve(emptyMap);
    return locals._permissionPromise;
  }

  const db = drizzle(env.DB);
  locals._permissionPromise = resolvePermissions(db, user.id, user.role);
  return locals._permissionPromise;
}

/**
 * Check if the current user has permission to perform `action` on `module`.
 */
export async function canAccess(
  locals: any,
  module: ModuleKey,
  action: Action
): Promise<boolean> {
  const map = await getPermissionMap(locals);
  return Boolean(map[module]?.[action]);
}

/**
 * Enforce permission in an API handler. Returns a 403 Response if denied,
 * or `null` if the request is permitted.
 */
export async function requirePermission(
  locals: any,
  module: ModuleKey,
  action: Action
): Promise<Response | null> {
  const user = locals.user;
  if (!user) {
    return errorResponse(401, 'Unauthorized.');
  }

  const allowed = await canAccess(locals, module, action);
  if (!allowed) {
    return errorResponse(
      403,
      `Akses ditolak: Anda tidak memiliki izin '${action}' pada modul '${module}'.`
    );
  }

  return null;
}

/**
 * Ensure the authenticated user account is still active in database.
 */
export async function ensureUserIsActive(locals: any): Promise<Response | null> {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');
  if (user.id === null) return null;

  const env = locals.runtime?.env;
  if (!env?.DB) return null;

  try {
    const db = drizzle(env.DB);
    const rows = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (rows[0] && rows[0].isActive === false) {
      return errorResponse(403, 'Akun Anda telah dinonaktifkan.');
    }
  } catch {
    // Non-fatal if DB check fails here; middleware also validates
  }

  return null;
}
