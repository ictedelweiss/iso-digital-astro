import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { users, leaveAllocations, leaveRequests } from '../../../../db/schema';
import { json, errorResponse } from '../../../../lib/validation';
import { leaveAllocationSchema, leaveAllocationBatchSchema } from '../../../../lib/schemas';
import { recordAudit } from '../../../../lib/audit';

// Helper to check if current user is HRD or Admin
function isHRorAdmin(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const dept = (user.department || '').toLowerCase();
  return dept.includes('hr') || dept.includes('human resource') || dept.includes('sdm');
}

/**
 * Ensures the leave_allocations table exists in SQLite/D1.
 */
async function ensureTable(db: any) {
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS leave_allocations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer NOT NULL,
        year integer NOT NULL,
        hak_prev integer DEFAULT 0 NOT NULL,
        hak_curr integer DEFAULT 12 NOT NULL,
        notes text,
        updated_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
      );
    `);
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS user_year_allocation_unique ON leave_allocations (user_id, year);
    `);
  } catch (e) {
    // Ignore if table/index already exists
  }
}

/**
 * GET /api/leaves/allocations
 * - If HRD/Admin: returns allocations for all active employees for the requested year (default: current year).
 * - If regular employee: returns their own allocation for the year (to auto-fill leave form).
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const url = new URL(request.url);
  const currentYear = new Date().getFullYear();
  const year = Number(url.searchParams.get('year')) || currentYear;
  const hrAdmin = isHRorAdmin(user);

  try {
    const db = drizzle(env.DB);
    await ensureTable(db);

    if (!hrAdmin) {
      // Non-HR/Admin: only fetch own allocation
      if (!user.id) {
        return json({
          success: true,
          data: {
            year,
            hak_prev: 0,
            hak_curr: 12,
            total_hak: 12,
            taken_days: 0,
            sisa_curr: 12,
          },
        });
      }

      const ownAlloc = await db
        .select()
        .from(leaveAllocations)
        .where(and(eq(leaveAllocations.userId, user.id), eq(leaveAllocations.year, year)))
        .limit(1);

      // Also compute approved taken leaves in this year
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const takenLeaves = await db
        .select({
          workDays: leaveRequests.workDays,
        })
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.requesterId, user.id),
            eq(leaveRequests.status, 'Approved'),
            sql`${leaveRequests.startDate} >= ${yearStart} AND ${leaveRequests.startDate} <= ${yearEnd}`
          )
        );

      const takenDays = takenLeaves.reduce((acc, l) => acc + (l.workDays || 0), 0);
      const hakPrev = ownAlloc[0]?.hakPrev ?? 0;
      const hakCurr = ownAlloc[0]?.hakCurr ?? 12;
      const totalHak = hakPrev + hakCurr;

      return json({
        success: true,
        data: {
          year,
          hak_prev: hakPrev,
          hak_curr: hakCurr,
          total_hak: totalHak,
          taken_days: takenDays,
          sisa_curr: Math.max(0, totalHak - takenDays),
        },
      });
    }

    // HRD or Admin: fetch list of employees with their allocations
    const allUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
        department: users.department,
        jobTitle: users.jobTitle,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.department, users.displayName);

    const existingAllocations = await db
      .select()
      .from(leaveAllocations)
      .where(eq(leaveAllocations.year, year));

    const allocMap = new Map<number, typeof existingAllocations[0]>();
    for (const alloc of existingAllocations) {
      allocMap.set(alloc.userId, alloc);
    }

    // Compute approved taken days per employee in this year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const approvedLeaves = await db
      .select({
        requesterId: leaveRequests.requesterId,
        workDays: leaveRequests.workDays,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.status, 'Approved'),
          sql`${leaveRequests.startDate} >= ${yearStart} AND ${leaveRequests.startDate} <= ${yearEnd}`
        )
      );

    const takenMap = new Map<number, number>();
    for (const l of approvedLeaves) {
      takenMap.set(l.requesterId, (takenMap.get(l.requesterId) || 0) + (l.workDays || 0));
    }

    const result = allUsers.map((u) => {
      const alloc = allocMap.get(u.id);
      const hakPrev = alloc?.hakPrev ?? 0;
      const hakCurr = alloc?.hakCurr ?? 12;
      const totalHak = hakPrev + hakCurr;
      const takenDays = takenMap.get(u.id) || 0;
      const sisa = Math.max(0, totalHak - takenDays);

      return {
        userId: u.id,
        displayName: u.displayName,
        username: u.username,
        email: u.email,
        department: u.department,
        jobTitle: u.jobTitle,
        role: u.role,
        year,
        hakPrev,
        hakCurr,
        totalHak,
        takenDays,
        sisa,
        notes: alloc?.notes || '',
        updatedAt: alloc?.updatedAt || null,
        isCustomized: !!alloc,
      };
    });

    return json({
      success: true,
      data: {
        year,
        currentUserIsHRAdmin: true,
        allocations: result,
      },
    });
  } catch (err: any) {
    return errorResponse(500, `Gagal memuat alokasi cuti: ${err?.message || err}`);
  }
};

/**
 * POST /api/leaves/allocations
 * Upsert allocation for single user or batch (HRD & Admin only).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  if (!isHRorAdmin(user)) {
    return errorResponse(403, 'Akses ditolak. Modul alokasi cuti tahunan hanya dapat dikelola oleh HRD dan Admin.');
  }

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const rawBody = await request.clone().json().catch(() => ({}));
    const db = drizzle(env.DB);
    await ensureTable(db);

    // Support single allocation or batch allocations
    if (Array.isArray(rawBody.allocations)) {
      const parsedBatch = leaveAllocationBatchSchema.safeParse(rawBody);
      if (!parsedBatch.success) {
        return errorResponse(400, 'Format data batch alokasi cuti tidak valid.');
      }

      const { year, allocations } = parsedBatch.data;
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      for (const item of allocations) {
        await env.DB.prepare(`
          INSERT INTO leave_allocations (user_id, year, hak_prev, hak_curr, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, year) DO UPDATE SET
            hak_prev = excluded.hak_prev,
            hak_curr = excluded.hak_curr,
            notes = excluded.notes,
            updated_at = excluded.updated_at;
        `).bind(item.user_id, year, item.hak_prev, item.hak_curr, item.notes || null, now).run();
      }

      await recordAudit(db, {
        entityType: 'leave_allocation',
        entityId: year,
        action: 'updated',
        actor: user,
      });

      return json({
        success: true,
        message: `Berhasil memperbarui alokasi cuti untuk ${allocations.length} pegawai tahun ${year}.`,
      });
    } else {
      const parsed = leaveAllocationSchema.safeParse(rawBody);
      if (!parsed.success) {
        return errorResponse(400, 'Format data alokasi cuti tidak valid.');
      }

      const { user_id, year, hak_prev, hak_curr, notes } = parsed.data;
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      await env.DB.prepare(`
        INSERT INTO leave_allocations (user_id, year, hak_prev, hak_curr, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, year) DO UPDATE SET
          hak_prev = excluded.hak_prev,
          hak_curr = excluded.hak_curr,
          notes = excluded.notes,
          updated_at = excluded.updated_at;
      `).bind(user_id, year, hak_prev, hak_curr, notes || null, now).run();

      await recordAudit(db, {
        entityType: 'leave_allocation',
        entityId: user_id,
        action: 'updated',
        actor: user,
      });

      return json({
        success: true,
        message: 'Alokasi cuti tahunan berhasil diperbarui.',
      });
    }
  } catch (err: any) {
    return errorResponse(500, `Gagal menyimpan alokasi cuti: ${err?.message || err}`);
  }
};
