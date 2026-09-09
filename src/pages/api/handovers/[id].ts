import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { handoverForms } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { parseBody, handoverUpdateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';
import { requirePermission } from '../../../lib/permissions';

const EDITABLE_STATUSES = new Set(['Pending', 'Draft']);

/**
 * Update a handover form.
 *
 * `status`, `current_approval_step` and `approvals` are intentionally absent
 * from the schema: advancing the workflow is only possible through
 * `POST /api/handovers/[id]/approve`.
 */
export const PUT: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'handover-form', 'edit');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const handoverId = Number(params.id);
  if (!Number.isInteger(handoverId) || handoverId <= 0) {
    return errorResponse(400, 'Invalid handover ID.');
  }

  const parsed = await parseBody(request, handoverUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db
      .select()
      .from(handoverForms)
      .where(eq(handoverForms.id, handoverId))
      .limit(1);
    const handover = existing[0];
    if (!handover) return errorResponse(404, 'Handover form not found.');

    if (!EDITABLE_STATUSES.has(handover.status)) {
      return errorResponse(409, 'This document is locked because it has been finalised.');
    }
    if (handover.recipientId !== user.id && !hasRole(user, 'admin')) {
      return errorResponse(403, 'You can only edit your own handover forms.');
    }

    await db
      .update(handoverForms)
      .set({
        itemName: body.item_name ?? handover.itemName,
        handoverDate: body.handover_date ?? handover.handoverDate,
        quantity: body.quantity ?? handover.quantity,
        serialNumber: body.serial_number ?? handover.serialNumber,
        specification: body.specification ?? handover.specification,
        loanPeriod: body.loan_period ?? handover.loanPeriod,
        itemCondition: body.item_condition ?? handover.itemCondition,
        notes: body.notes ?? handover.notes,
      })
      .where(eq(handoverForms.id, handoverId));

    await recordAudit(db, {
      entityType: 'handover',
      entityId: handoverId,
      action: 'updated',
      fromStatus: handover.status,
      toStatus: handover.status,
      notes: body.item_name,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update handover form.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'handover-form', 'delete');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const handoverId = Number(params.id);
  if (!Number.isInteger(handoverId) || handoverId <= 0) {
    return errorResponse(400, 'Invalid handover ID.');
  }

  try {
    const db = drizzle(env.DB);
    const existing = await db
      .select()
      .from(handoverForms)
      .where(eq(handoverForms.id, handoverId))
      .limit(1);
    const handover = existing[0];
    if (!handover) return errorResponse(404, 'Handover form not found.');

    if (handover.recipientId !== user.id && !hasRole(user, 'admin')) {
      return errorResponse(403, 'You can only delete your own handover forms.');
    }

    // Approval rows are retained as the record of who had already signed.
    await db.delete(handoverForms).where(eq(handoverForms.id, handoverId));

    await recordAudit(db, {
      entityType: 'handover',
      entityId: handoverId,
      action: 'deleted',
      fromStatus: handover.status,
      notes: handover.itemName,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete handover form.');
  }
};
