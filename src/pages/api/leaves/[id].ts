import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { leaveRequests } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { parseBody, leaveUpdateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';

const EDITABLE_STATUSES = new Set(['Pending', 'Draft']);

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const leaveId = Number(params.id);
  if (!Number.isInteger(leaveId) || leaveId <= 0) return errorResponse(400, 'Invalid leave ID.');

  const parsed = await parseBody(request, leaveUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, leaveId))
      .limit(1);
    const leave = existing[0];
    if (!leave) return errorResponse(404, 'Leave request not found.');

    if (!EDITABLE_STATUSES.has(leave.status)) {
      return errorResponse(409, 'This document is locked because it has been finalised.');
    }
    if (leave.requesterId !== user.id && !hasRole(user, 'admin')) {
      return errorResponse(403, 'You can only edit your own leave requests.');
    }

    await db
      .update(leaveRequests)
      .set({
        workDays: body.work_days,
        startDate: body.start_date,
        endDate: body.end_date,
        purpose: body.purpose,
        requestDays: body.request_days,
        sisaAfter: body.sisa_after,
      })
      .where(eq(leaveRequests.id, leaveId));

    await recordAudit(db, {
      entityType: 'leave',
      entityId: leaveId,
      action: 'updated',
      fromStatus: leave.status,
      toStatus: leave.status,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update leave request.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const leaveId = Number(params.id);
  if (!Number.isInteger(leaveId) || leaveId <= 0) return errorResponse(400, 'Invalid leave ID.');

  try {
    const db = drizzle(env.DB);
    const existing = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, leaveId))
      .limit(1);
    const leave = existing[0];
    if (!leave) return errorResponse(404, 'Leave request not found.');

    if (leave.requesterId !== user.id && !hasRole(user, 'admin')) {
      return errorResponse(403, 'You can only delete your own leave requests.');
    }

    // Approval rows are retained as the record of who had already signed.
    await db.delete(leaveRequests).where(eq(leaveRequests.id, leaveId));

    await recordAudit(db, {
      entityType: 'leave',
      entityId: leaveId,
      action: 'deleted',
      fromStatus: leave.status,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete leave request.');
  }
};
