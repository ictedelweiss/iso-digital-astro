/**
 * Server-side approval engine (H-01 fix).
 *
 * Previously the browser POSTed the whole `approvals` array — including
 * `status`, `date` and `signature` — and the server stored it verbatim. Anyone
 * could approve their own purchase requisition by editing the request body.
 *
 * Now the client can only say "approve" or "reject". The server decides:
 *   - who the actor is (from the signed session, never from the body)
 *   - whether their role entitles them to the current step
 *   - which signature is attached (the one registered in the database)
 *   - what the resulting document status is
 */
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import type { Role, SessionUser } from './session';
import { recordAudit, nowStamp, type AuditEntity } from './audit';
import { notifyApprovalStepUpdate } from './notifications';

export const APPROVAL_STEPS = [
  { step: 1, role: 'koordinator', roleTitle: 'Koordinator Unit' },
  { step: 2, role: 'accounting', roleTitle: 'Accounting' },
  { step: 3, role: 'ketua_yayasan', roleTitle: 'Ketua Yayasan' },
] as const;

/** Minimum role required to clear each approval step. */
const STEP_ROLE_REQUIREMENT: Record<string, Role> = {
  koordinator: 'coordinator',
  accounting: 'approver',
  finance: 'approver',
  ketua_yayasan: 'admin',
  ict: 'coordinator',
};

export function requiredRoleFor(stepRole: string): Role {
  return STEP_ROLE_REQUIREMENT[String(stepRole).toLowerCase()] ?? 'approver';
}

/**
 * Resolve the display names of everyone who has signed a document.
 *
 * The client used to invent this from a hardcoded local list, which meant the
 * signature block could name someone who never actually approved. The name now
 * always comes from the `approverId` the server recorded at decision time.
 */
export async function approverNameMap(db: any): Promise<Map<number, string>> {
  try {
    const rows = await db.select({ id: users.id, displayName: users.displayName }).from(users);
    return new Map(rows.map((row: { id: number; displayName: string }) => [row.id, row.displayName]));
  } catch {
    return new Map();
  }
}

export type Decision = 'approved' | 'rejected';

export interface ApprovalTargetConfig {
  entityType: AuditEntity;
  /** Table holding `id`, `status`, `currentApprovalStep`. */
  parentTable: any;
  /** Table holding `step`, `role`, `roleTitle`, `approverId`, `status`, ... */
  approvalsTable: any;
  /** FK column on `approvalsTable` pointing at the parent. */
  parentIdColumn: any;
  /** Owner of the document, used to block self-approval. Optional. */
  requesterId?: number | null;
}

type Result =
  | { ok: true; status: string; currentStep: number }
  | { ok: false; statusCode: number; error: string };

/**
 * Apply an approval decision to a document.
 *
 * Returns a discriminated result so handlers can map it straight to a response
 * without leaking internal error strings.
 */
export async function decideApproval(
  db: any,
  user: SessionUser,
  config: ApprovalTargetConfig,
  parentId: number,
  decision: Decision,
  notes?: string,
  env?: any
): Promise<Result> {
  const { parentTable, approvalsTable, parentIdColumn, entityType } = config;

  const parents = await db
    .select()
    .from(parentTable)
    .where(eq(parentTable.id, parentId))
    .limit(1);
  const parent = parents[0];
  if (!parent) return { ok: false, statusCode: 404, error: 'Document not found.' };

  if (parent.status === 'Approved' || parent.status === 'Rejected') {
    return { ok: false, statusCode: 409, error: 'Document is already finalised.' };
  }

  if (user.id === null) {
    return { ok: false, statusCode: 403, error: 'Your account is not registered in the system.' };
  }

  const rows = await db.select().from(approvalsTable).where(eq(parentIdColumn, parentId));
  if (rows.length === 0) {
    return { ok: false, statusCode: 409, error: 'No approval chain is configured for this document.' };
  }

  const ordered = [...rows].sort((a: any, b: any) => a.step - b.step);
  const target = ordered.find((row: any) => row.step === parent.currentApprovalStep);
  if (!target) {
    return { ok: false, statusCode: 409, error: 'Current approval step could not be resolved.' };
  }

  // 1. Role check — the step defines the required authority, not the client.
  //
  //    This is an EXACT match, not a privilege hierarchy: an approver must not
  //    be able to clear the koordinator step, and an admin must not skip the
  //    chain. Each step is signed by the specific role assigned to it, which is
  //    what makes the audit trail legally meaningful (H-01 / ISO 21001).
  const required = requiredRoleFor(target.role);
  if (user.role !== required) {
    return {
      ok: false,
      statusCode: 403,
      error: `Your role (${user.role}) is not authorised for step ${target.step} (${target.roleTitle}). Only a '${required}' may approve this step.`,
    };
  }

  // 2. Segregation of duties — nobody clears their own request.
  if (config.requesterId != null && config.requesterId === user.id) {
    return {
      ok: false,
      statusCode: 403,
      error: 'You cannot approve a document you requested yourself.',
    };
  }

  // 3. Approvals must carry the signature registered for the account; the
  //    client never supplies it, so a forged image cannot be attached.
  let signature: string | null = null;
  if (decision === 'approved') {
    const rowsUser = await db
      .select({ signatureData: users.signatureData })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    signature = rowsUser[0]?.signatureData ?? null;
    if (!signature) {
      return {
        ok: false,
        statusCode: 400,
        error: 'You have no registered signature yet. Please add one before approving.',
      };
    }
  }

  const timestamp = nowStamp();
  const cleanNotes = typeof notes === 'string' ? notes.slice(0, 1000) : null;

  await db
    .update(approvalsTable)
    .set({
      status: decision,
      approverId: user.id,
      date: timestamp,
      signature,
      notes: cleanNotes,
    })
    .where(eq(approvalsTable.id, target.id));

  // 4. Advance or finalise the document.
  const maxStep = ordered[ordered.length - 1].step;
  const nextRow = ordered.find((row: any) => row.step > target.step);
  let nextStatus: string;
  let nextCurrentStep = parent.currentApprovalStep;

  if (decision === 'rejected') {
    nextStatus = 'Rejected';
  } else if (nextRow && nextRow.step <= maxStep) {
    nextCurrentStep = nextRow.step;
    nextStatus = 'Pending';
    await db
      .update(approvalsTable)
      .set({ status: 'current' })
      .where(eq(approvalsTable.id, nextRow.id));
  } else {
    nextStatus = 'Approved';
  }

  await db
    .update(parentTable)
    .set({ status: nextStatus, currentApprovalStep: nextCurrentStep })
    .where(eq(parentTable.id, parentId));

  await recordAudit(db, {
    entityType,
    entityId: parentId,
    action: decision === 'approved' ? 'approved' : 'rejected',
    step: target.step,
    fromStatus: parent.status,
    toStatus: nextStatus,
    notes: cleanNotes,
    actor: user,
  });

  // Query requester details for email notification
  try {
    const ownerId = parent.requesterId ?? parent.recipientId;
    let requesterName = 'Pemohon';
    let requesterEmail = '';
    if (ownerId) {
      const ownerRows = await db
        .select({ displayName: users.displayName, email: users.email })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);
      if (ownerRows[0]) {
        requesterName = ownerRows[0].displayName;
        requesterEmail = ownerRows[0].email;
      }
    }

    const docType =
      entityType === 'pr'
        ? 'Purchase Requisition'
        : entityType === 'leave'
        ? 'Permohonan Cuti'
        : 'Serah Terima Aset';

    const docNumber =
      parent.prNumber || (entityType === 'leave' ? `CUTI-${parentId}` : `BAST-${parentId}`);

    const title =
      parent.title ||
      parent.purpose ||
      parent.itemName ||
      `Dokumen ${docType}`;

    notifyApprovalStepUpdate(env, db, {
      docType,
      docNumber,
      title,
      department: parent.department || '',
      requesterName,
      requesterEmail,
      actorName: user.displayName,
      decision,
      nextStep: nextRow?.step,
      nextRole: nextRow?.role,
      nextRoleTitle: nextRow?.roleTitle,
      notes: cleanNotes,
    }).catch((err) => console.error('Error sending step notification email:', err));
  } catch (notifErr) {
    console.error('Error preparing notification data:', notifErr);
  }

  return { ok: true, status: nextStatus, currentStep: nextCurrentStep };
}

/**
 * Build the standard three-step chain for a new document.
 *
 * Client-supplied approval arrays are ignored entirely: the workflow is defined
 * here so it cannot be shortened or skipped from the browser.
 */
export function buildApprovalChain(department?: string) {
  return APPROVAL_STEPS.map((entry) => ({
    step: entry.step,
    role: entry.role,
    roleTitle:
      entry.step === 1 && department ? `Koordinator ${department}` : entry.roleTitle,
    status: entry.step === 1 ? 'current' : 'pending',
  }));
}
