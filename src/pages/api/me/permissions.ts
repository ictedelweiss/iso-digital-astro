import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { getPermissionMap, resolvePermissions } from '../../../lib/permissions';
import { json, errorResponse } from '../../../lib/validation';

/**
 * Returns current user's effective permissions and account status.
 * Used by frontend to dynamically render navigation items and guard tabs.
 * Does not require admin privileges.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    return json({
      authenticated: false,
      role: null,
      is_active: false,
      modules: {},
    });
  }

  const env = locals.runtime?.env;
  let isActive = true;

  if (env?.DB && user.id !== null) {
    try {
      const db = drizzle(env.DB);
      const rows = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (rows[0] && rows[0].isActive === false) {
        isActive = false;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  const permissions = await getPermissionMap(locals);

  return json({
    authenticated: true,
    role: user.role,
    is_active: isActive,
    modules: permissions,
  });
};
