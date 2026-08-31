import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { leaveRequests, leaveApprovals, users } from '../../../db/schema';
import { eq, desc, or } from 'drizzle-orm';
import { parseBody, leaveCreateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { buildApprovalChain, approverNameMap } from '../../../lib/approvals';
import { recordAudit } from '../../../lib/audit';
import { notifyNewDocument } from '../../../lib/notifications';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    let query = db
      .select({
        id: leaveRequests.id,
        requesterName: users.displayName,
        requesterPosition: users.jobTitle,
        department: leaveRequests.department,
        work_days: leaveRequests.workDays,
        start_date: leaveRequests.startDate,
        end_date: leaveRequests.endDate,
        purpose: leaveRequests.purpose,
        status: leaveRequests.status,
        current_approval_step: leaveRequests.currentApprovalStep,
        hak_prev: leaveRequests.hakPrev,
        hak_curr: leaveRequests.hakCurr,
        total_hak: leaveRequests.totalHak,
        taken_until: leaveRequests.takenUntil,
        sisa_curr: leaveRequests.sisaCurr,
        request_days: leaveRequests.requestDays,
        sisa_after: leaveRequests.sisaAfter,
        signature_pemohon: leaveRequests.requesterSignature,
        created_at: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.requesterId, users.id));

    // Regular staff can ONLY see documents created by themselves
    if (user.role === 'staff' && user.id !== null) {
      query = query.where(eq(leaveRequests.requesterId, user.id)) as any;
    } else if (user.role === 'coordinator' && user.id !== null && user.department) {
      // Coordinator sees documents from their unit + their own
      query = query.where(
        or(
          eq(leaveRequests.requesterId, user.id),
          eq(leaveRequests.department, user.department)
        )
      ) as any;
    }

    const leaves = await query.orderBy(desc(leaveRequests.id));

    const allApprovals = await db.select().from(leaveApprovals);
    const nameMap = await approverNameMap(db);

    const formattedLeaves = leaves.map((leave) => ({
      id: leave.id,
      name: leave.requesterName,
      position: leave.requesterPosition,
      department: leave.department,
      work_days: leave.work_days,
      start_date: leave.start_date,
      end_date: leave.end_date,
      purpose: leave.purpose,
      status: leave.status,
      current_approval_step: leave.current_approval_step,
      hak_prev: leave.hak_prev,
      hak_curr: leave.hak_curr,
      total_hak: leave.total_hak,
      taken_until: leave.taken_until,
      sisa_curr: leave.sisa_curr,
      request_days: leave.request_days,
      sisa_after: leave.sisa_after,
      signature_pemohon: leave.signature_pemohon,
      created_at: leave.created_at,
      approvals: allApprovals
        .filter((app) => app.leaveId === leave.id)
        .sort((a, b) => a.step - b.step)
        .map((app) => ({
          step: app.step,
          role: app.role,
          roleTitle: app.roleTitle,
          approverId: app.approverId,
          approverName: nameMap.get(app.approverId) ?? null,
          status: app.status,
          date: app.date,
          signature: app.signature,
          notes: app.notes,
        })),
    }));

    return json({ success: true, data: formattedLeaves });
  } catch {
    return errorResponse(500, 'Failed to load leave requests.');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');
  if (user.id === null) return errorResponse(403, 'Your account is not registered in the system.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, leaveCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const newLeave = await db
      .insert(leaveRequests)
      .values({
        requesterId: user.id,
        department: body.department,
        workDays: body.work_days,
        startDate: body.start_date,
        endDate: body.end_date,
        purpose: body.purpose,
        hakPrev: body.hak_prev,
        hakCurr: body.hak_curr,
        totalHak: body.total_hak,
        takenUntil: body.taken_until,
        sisaCurr: body.sisa_curr,
        requestDays: body.request_days,
        sisaAfter: body.sisa_after,
        requesterSignature: body.signature_pemohon ?? null,
        status: 'Pending',
        currentApprovalStep: 1,
      })
      .returning({ id: leaveRequests.id });

    const leaveId = newLeave[0].id;

    await db
      .insert(leaveApprovals)
      .values(buildApprovalChain(body.department).map((step) => ({ ...step, leaveId })));

    await recordAudit(db, {
      entityType: 'leave',
      entityId: leaveId,
      action: 'created',
      toStatus: 'Pending',
      actor: user,
    });

    // Step 1: Send notification email to coordinator
    notifyNewDocument(env, db, {
      type: 'Permohonan Cuti',
      docNumber: `CUTI-${leaveId}`,
      title: `${body.work_days} hari cuti (${body.start_date} s/d ${body.end_date}): ${body.purpose}`,
      requesterName: user.displayName,
      requesterEmail: user.email,
      department: body.department,
    }).catch((err) => console.error('Error sending leave creation notification:', err));

    return json({ success: true, leaveId }, 201);
  } catch {
    return errorResponse(500, 'Failed to create leave request.');
  }
};
