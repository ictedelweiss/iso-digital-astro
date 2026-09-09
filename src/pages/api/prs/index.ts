import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { purchaseRequisitions, prItems, prApprovals, users } from '../../../db/schema';
import { eq, desc, or } from 'drizzle-orm';
import { parseBody, prCreateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { buildApprovalChain, approverNameMap } from '../../../lib/approvals';
import { recordAudit } from '../../../lib/audit';
import { notifyNewDocument } from '../../../lib/notifications';
import { requirePermission } from '../../../lib/permissions';

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requirePermission(locals, 'purchase-requisition', 'view');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    let query = db
      .select({
        id: purchaseRequisitions.id,
        pr_number: purchaseRequisitions.prNumber,
        title: purchaseRequisitions.title,
        requester_id: purchaseRequisitions.requesterId,
        department: purchaseRequisitions.department,
        needed_date: purchaseRequisitions.neededDate,
        budget_status: purchaseRequisitions.budgetStatus,
        notes: purchaseRequisitions.notes,
        attachment_name: purchaseRequisitions.attachmentName,
        attachment_data: purchaseRequisitions.attachmentData,
        status: purchaseRequisitions.status,
        current_approval_step: purchaseRequisitions.currentApprovalStep,
        requester_signature: purchaseRequisitions.requesterSignature,
        created_at: purchaseRequisitions.createdAt,
        requesterName: users.displayName,
        requesterEmail: users.email,
      })
      .from(purchaseRequisitions)
      .innerJoin(users, eq(purchaseRequisitions.requesterId, users.id));

    // Regular staff can ONLY see documents created by themselves
    if (user.role === 'staff' && user.id !== null) {
      query = query.where(eq(purchaseRequisitions.requesterId, user.id)) as any;
    } else if (user.role === 'coordinator' && user.id !== null && user.department) {
      // Coordinator sees documents from their unit + their own
      query = query.where(
        or(
          eq(purchaseRequisitions.requesterId, user.id),
          eq(purchaseRequisitions.department, user.department)
        )
      ) as any;
    }

    const prs = await query.orderBy(desc(purchaseRequisitions.id));

    const allItems = await db.select().from(prItems);
    const allApprovals = await db.select().from(prApprovals);
    const nameMap = await approverNameMap(db);

    const formattedPrs = prs.map((pr) => ({
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      requester: pr.requesterName,
      requester_id: pr.requester_id,
      requester_email: pr.requesterEmail,
      department: pr.department,
      needed_date: pr.needed_date,
      budget_status: pr.budget_status,
      notes: pr.notes,
      attachment_name: pr.attachment_name,
      attachment_data: pr.attachment_data,
      status: pr.status,
      current_approval_step: pr.current_approval_step,
      requester_signature: pr.requester_signature,
      created_at: pr.created_at,
      items: allItems
        .filter((item) => item.prId === pr.id)
        .map((item) => ({
          id: item.id,
          item_name: item.itemName,
          qty: item.qty,
          unit: item.unit,
          price: item.price,
        })),
      approvals: allApprovals
        .filter((app) => app.prId === pr.id)
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

    return json({ success: true, data: formattedPrs });
  } catch {
    return errorResponse(500, 'Failed to load purchase requisitions.');
  }
};

/**
 * Generate the next PR number server-side.
 *
 * The client used to derive it from `prs.length + 1`, which collides as soon as
 * two people submit at the same time and lets anyone pick their own number.
 */
async function generatePrNumber(db: any, department: string): Promise<string> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dept = (department || 'UMUM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'UMUM';
  const prefix = `PR/${dept}/${year}/${month}/`;

  const existing = await db
    .select({ prNumber: purchaseRequisitions.prNumber })
    .from(purchaseRequisitions);

  let highest = 0;
  for (const row of existing) {
    if (!row.prNumber?.startsWith(prefix)) continue;
    const parsed = Number.parseInt(row.prNumber.slice(prefix.length), 10);
    if (!Number.isNaN(parsed) && parsed > highest) highest = parsed;
  }
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

import { isDraftPrNumber } from '../../../lib/prNumber';

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'purchase-requisition', 'create');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');
  // The requester is the authenticated account — never a client-supplied id.
  if (user.id === null) return errorResponse(403, 'Your account is not registered in the system.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, prCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;
    // Provisional draft number until Accounting assigns the official PR number at Step 2
    const prNumber = `DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newPr = await db
      .insert(purchaseRequisitions)
      .values({
        prNumber,
        title: body.title,
        requesterId: user.id,
        department: body.department,
        neededDate: body.needed_date,
        // Rule 1: Form creator does not set budget status; Accounting fills it
        budgetStatus: 'Tidak Memilih',
        notes: body.notes ?? null,
        attachmentName: body.attachment_name ?? null,
        attachmentData: body.attachment_data ?? null,
        requesterSignature: body.requester_signature ?? null,
        status: 'Pending',
        currentApprovalStep: 1,
      })
      .returning({ id: purchaseRequisitions.id });

    const prId = newPr[0].id;

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

    // The workflow is defined here, not in the request body.
    await db
      .insert(prApprovals)
      .values(buildApprovalChain(body.department).map((step) => ({ ...step, prId })));

    await recordAudit(db, {
      entityType: 'pr',
      entityId: prId,
      action: 'created',
      toStatus: 'Pending',
      notes: prNumber,
      actor: user,
    });

    // Step 1: Send notification email to coordinator (must await in Cloudflare Pages)
    try {
      await notifyNewDocument(env, db, {
        type: 'Purchase Requisition',
        docNumber: prNumber,
        title: body.title,
        requesterName: user.displayName,
        requesterEmail: user.email,
        department: body.department,
      });
    } catch (err) {
      console.error('Error sending PR creation notification:', err);
    }

    return json({ success: true, prId, pr_number: prNumber }, 201);
  } catch {
    return errorResponse(500, 'Failed to create purchase requisition.');
  }
};
