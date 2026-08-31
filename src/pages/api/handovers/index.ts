import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { handoverForms, handoverApprovals, users } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseBody, handoverCreateSchema } from '../../../lib/schemas';
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
        id: handoverForms.id,
        item_name: handoverForms.itemName,
        handover_date: handoverForms.handoverDate,
        recipient_name: users.displayName,
        recipient_email: users.email,
        recipient_department: users.department,
        quantity: handoverForms.quantity,
        serial_number: handoverForms.serialNumber,
        specification: handoverForms.specification,
        loan_period: handoverForms.loanPeriod,
        item_condition: handoverForms.itemCondition,
        notes: handoverForms.notes,
        status: handoverForms.status,
        current_approval_step: handoverForms.currentApprovalStep,
        created_at: handoverForms.createdAt,
      })
      .from(handoverForms)
      .innerJoin(users, eq(handoverForms.recipientId, users.id));

    // Regular staff can ONLY see handovers where they are the recipient
    if (user.role === 'staff' && user.id !== null) {
      query = query.where(eq(handoverForms.recipientId, user.id)) as any;
    }

    const handovers = await query.orderBy(desc(handoverForms.id));

    const allApprovals = await db.select().from(handoverApprovals);
    const nameMap = await approverNameMap(db);

    const formattedHandovers = handovers.map((ho) => ({
      id: ho.id,
      item_name: ho.item_name,
      handover_date: ho.handover_date,
      recipient_name: ho.recipient_name,
      recipient_email: ho.recipient_email,
      recipient_department: ho.recipient_department,
      quantity: ho.quantity,
      serial_number: ho.serial_number,
      specification: ho.specification,
      loan_period: ho.loan_period,
      item_condition: ho.item_condition,
      notes: ho.notes,
      status: ho.status,
      current_approval_step: ho.current_approval_step,
      created_at: ho.created_at,
      approvals: allApprovals
        .filter((app) => app.handoverId === ho.id)
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

    return json({ success: true, data: formattedHandovers });
  } catch {
    return errorResponse(500, 'Failed to load handover forms.');
  }
};

/**
 * Resolve the recipient from the email typed into the form.
 *
 * The client used to send no recipient at all, so every form was silently
 * attributed to user 1. When the address matches a known account we link to it;
 * otherwise the submitting user is recorded as the recipient.
 */
async function resolveRecipient(db: any, email: string | null | undefined, fallbackId: number | null) {
  if (email) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (rows[0]?.id) return rows[0].id;
  }
  return fallbackId;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');
  if (user.id === null) return errorResponse(403, 'Your account is not registered in the system.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, handoverCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;
    const recipientId = await resolveRecipient(db, body.recipient_email, user.id);
    if (recipientId === null) {
      return errorResponse(400, 'Recipient could not be resolved.');
    }

    const newHandover = await db
      .insert(handoverForms)
      .values({
        itemName: body.item_name,
        handoverDate: body.handover_date,
        recipientId,
        quantity: body.quantity,
        serialNumber: body.serial_number ?? null,
        specification: body.specification ?? null,
        loanPeriod: body.loan_period ?? null,
        itemCondition: body.item_condition ?? null,
        notes: body.notes ?? null,
        status: 'Pending',
        currentApprovalStep: 1,
      })
      .returning({ id: handoverForms.id });

    const handoverId = newHandover[0].id;

    await db
      .insert(handoverApprovals)
      .values(buildApprovalChain().map((step) => ({ ...step, handoverId })));

    await recordAudit(db, {
      entityType: 'handover',
      entityId: handoverId,
      action: 'created',
      toStatus: 'Pending',
      notes: body.item_name,
      actor: user,
    });

    // Step 1: Send notification email to coordinator / ICT
    notifyNewDocument(env, db, {
      type: 'Serah Terima Aset',
      docNumber: `BAST-${handoverId}`,
      title: `${body.quantity}x ${body.item_name} (${body.specification || 'Peminjaman / Penyerahan'})`,
      requesterName: user.displayName,
      requesterEmail: user.email,
      department: user.department || 'ICT',
    }).catch((err) => console.error('Error sending handover creation notification:', err));

    return json({ success: true, handoverId }, 201);
  } catch {
    return errorResponse(500, 'Failed to create handover form.');
  }
};
