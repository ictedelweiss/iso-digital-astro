import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, like, asc } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { json, errorResponse } from '../../../lib/validation';

/**
 * GET /api/users
 *
 * Returns active users for selection in forms (e.g. Handover recipient, Asset assignee, etc.).
 * Requires an authenticated user session.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return errorResponse(401, 'Unauthorized.');
  }

  const env = locals.runtime?.env;
  if (!env?.DB) {
    return errorResponse(500, 'Database is not available.');
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  try {
    const db = drizzle(env.DB);

    if (q) {
      const pattern = `%${q}%`;
      const rows = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          username: users.username,
          department: users.department,
          jobTitle: users.jobTitle,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            or(
              like(users.displayName, pattern),
              like(users.department, pattern),
              like(users.jobTitle, pattern),
              like(users.email, pattern),
              like(users.username, pattern)
            )
          )
        )
        .orderBy(asc(users.displayName));

      return json({ success: true, data: rows });
    }

    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        username: users.username,
        department: users.department,
        jobTitle: users.jobTitle,
        role: users.role,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.displayName));

    return json({ success: true, data: rows });
  } catch (error) {
    return errorResponse(500, 'Failed to fetch users list.');
  }
};
