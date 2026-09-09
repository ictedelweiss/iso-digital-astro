import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { purchaseRequisitions, prItems } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { parseBody, prUpdateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';
import { requirePermission } from '../../../lib/permissions';

const EDITABLE_STATUSES = new Set(['Pending', 'Draft']);

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const denied = await requirePermission(locals, 'purchase-requisition', 'edit');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const prId = Number(params.id);
  if (!Number.isInteger(prId) || prId <= 0) return errorResponse(400, 'Invalid PR ID.');

  const parsed = await parseBody(request, prUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db
      .select()
      .from(purchaseRequisitions)
      .where(eq(purchaseRequisitions.id, prId))
      .limit(1);
    const pr = existing[0];
    if (!pr) return errorResponse(404, 'Purchase requisition not found.');

    if (!EDITABLE_STATUSES.has(pr.status)) {
      return errorResponse(409, 'This document is locked because it has been finalised.');
    }

    const isOwner = pr.requesterId === user.id;
    const isAccounting = user.department === 'Finance & Accounting' || user.department === 'Accounting' || user.role === 'approver';
    const isAdmin = hasRole(user, 'admin');

    if (!isOwner && !isAccounting && !isAdmin) {
      return errorResponse(403, 'You can only edit your own purchase requisitions.');
    }

    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.needed_date !== undefined) updateData.neededDate = body.needed_date;
    // Rule 1: Only accounting or admin can update budget status
    if (body.budget_status !== undefined) {
      if (isAccounting || isAdmin) {
        updateData.budgetStatus = body.budget_status;
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;
    if (body.attachment_name !== undefined) updateData.attachmentName = body.attachment_name ?? null;
    if (body.attachment_data !== undefined) updateData.attachmentData = body.attachment_data ?? null;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(purchaseRequisitions)
        .set(updateData)
        .where(eq(purchaseRequisitions.id, prId));
    }

    // Line items are not part of the approval record, so replacing them is
    // acceptable — the change itself is still written to the audit trail.
    if (body.items) {
      await db.delete(prItems).where(eq(prItems.prId, prId));
      if (body.items.length > 0) {
        await db.insert(prItems).values(
          body.items.map((item) => ({
            prId,
            itemName: item.item_name,
            qty: item.qty,
            unit: item.unit,
            price: item.price,
          }))
        );
      }
    }

    await recordAudit(db, {
      entityType: 'pr',
      entityId: prId,
      action: 'updated',
      notes: body.title,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update purchase requisition.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const denied = await requirePermission(locals, 'purchase-requisition', 'delete');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const prId = Number(params.id);
  if (!Number.isInteger(prId) || prId <= 0) return errorResponse(400, 'Invalid PR ID.');

  try {
    const db = drizzle(env.DB);
    const existing = await db
      .select()
      .from(purchaseRequisitions)
      .where(eq(purchaseRequisitions.id, prId))
      .limit(1);
    const pr = existing[0];
    if (!pr) return errorResponse(404, 'Purchase requisition not found.');

    if (pr.requesterId !== user.id && !hasRole(user, 'admin')) {
      return errorResponse(403, 'You can only delete your own purchase requisitions.');
    }

    await db.delete(prItems).where(eq(prItems.prId, prId));
    // Approval rows are kept: deleting a document must not erase the evidence
    // of who had already signed it.
    await db.delete(purchaseRequisitions).where(eq(purchaseRequisitions.id, prId));

    await recordAudit(db, {
      entityType: 'pr',
      entityId: prId,
      action: 'deleted',
      fromStatus: pr.status,
      notes: pr.prNumber,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete purchase requisition.');
  }
};
