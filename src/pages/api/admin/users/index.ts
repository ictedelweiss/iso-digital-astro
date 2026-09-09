import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, like, or, sql } from 'drizzle-orm';
import { users } from '../../../../db/schema';
import { requirePermission, resolvePermissions } from '../../../../lib/permissions';
import { json, errorResponse } from '../../../../lib/validation';
import { parseBody, adminUserCreateSchema } from '../../../../lib/schemas';
import { recordAudit } from '../../../../lib/audit';

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;

  try {
    const db = drizzle(env.DB);

    // Build conditions
    const conditions: any[] = [];

    if (q) {
      const searchPattern = `%${q}%`;
      conditions.push(
        or(
          like(users.displayName, searchPattern),
          like(users.email, searchPattern),
          like(users.username, searchPattern),
          like(users.department, searchPattern)
        )
      );
    }

    if (role && ['admin', 'coordinator', 'approver', 'staff'].includes(role)) {
      conditions.push(eq(users.role, role));
    }

    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }

    const whereClause = conditions.length > 0
      ? sql.join(conditions, sql` AND `)
      : undefined;

    // Total count query
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const totalRes = whereClause
      ? await countQuery.where(whereClause)
      : await countQuery;
    const total = Number(totalRes[0]?.count || 0);

    // Data query
    const selectQuery = db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        username: users.username,
        department: users.department,
        jobTitle: users.jobTitle,
        role: users.role,
        isActive: users.isActive,
        sessionVersion: users.sessionVersion,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users);

    const rows = whereClause
      ? await selectQuery.where(whereClause).orderBy(desc(users.id)).limit(limit).offset(offset)
      : await selectQuery.orderBy(desc(users.id)).limit(limit).offset(offset);

    // Compute accessible_modules_count for each user
    const usersWithCounts = await Promise.all(
      rows.map(async (u) => {
        let count = 0;
        if (u.isActive) {
          const permMap = await resolvePermissions(db, u.id, u.role);
          count = Object.values(permMap).filter((p) => p.view).length;
        }
        return {
          id: u.id,
          display_name: u.displayName,
          email: u.email,
          username: u.username,
          department: u.department,
          job_title: u.jobTitle,
          role: u.role,
          is_active: Boolean(u.isActive),
          session_version: u.sessionVersion ?? 0,
          last_login_at: u.lastLoginAt,
          created_at: u.createdAt,
          accessible_modules_count: count,
        };
      })
    );

    return json({
      success: true,
      data: usersWithCounts,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch {
    return errorResponse(500, 'Failed to fetch users list.');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'admin-access', 'create');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, adminUserCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    // Check unique constraints for email and username
    const existing = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, body.email), eq(users.username, body.username)))
      .limit(1);

    if (existing.length > 0) {
      const match = existing[0];
      if (match.email.toLowerCase() === body.email) {
        return errorResponse(409, `Email '${body.email}' sudah terdaftar.`);
      }
      return errorResponse(409, `Username '${body.username}' sudah terdaftar.`);
    }

    const inserted = await db
      .insert(users)
      .values({
        displayName: body.display_name,
        email: body.email,
        username: body.username,
        department: body.department,
        jobTitle: body.job_title,
        role: body.role,
        isActive: body.is_active,
        sessionVersion: 0,
        hasSignature: false,
      })
      .returning({ id: users.id });

    const newUserId = inserted[0].id;

    await recordAudit(db, {
      entityType: 'user',
      entityId: newUserId,
      action: 'created',
      notes: `Akun dibuat: ${body.display_name} (${body.email}) role=${body.role}`,
      actor: locals.user,
    });

    return json(
      {
        success: true,
        id: newUserId,
        message: 'Akun berhasil dibuat.',
      },
      201
    );
  } catch {
    return errorResponse(500, 'Gagal membuat akun user.');
  }
};
