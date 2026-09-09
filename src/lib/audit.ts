/**
 * Append-only audit trail (M-01).
 *
 * Every state change on a business record is written to `audit_log` and never
 * updated or deleted. This is what makes the approval chain traceable for an
 * ISO 21001:2018 audit: you can reconstruct who approved what, in which order,
 * and under which role — even if the user is later renamed or removed.
 */
import { auditLog } from '../db/schema';
import type { SessionUser } from './session';

export type AuditEntity =
  | 'pr'
  | 'leave'
  | 'handover'
  | 'meeting'
  | 'asset'
  | 'user'
  | 'permission';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'deleted';

export interface AuditEntry {
  entityType: AuditEntity;
  entityId: string | number;
  action: AuditAction;
  step?: number | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  actor?: SessionUser | null;
}

/** SQLite `datetime('now')` compatible timestamp, always UTC. */
export function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Write one audit row.
 *
 * Deliberately fire-and-forget friendly: a failure to write history must never
 * roll back the business operation, but it is logged loudly so it gets noticed.
 */
export async function recordAudit(db: any, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      entityType: entry.entityType,
      entityId: String(entry.entityId),
      step: entry.step ?? null,
      action: entry.action,
      fromStatus: entry.fromStatus ?? null,
      toStatus: entry.toStatus ?? null,
      actorId: entry.actor?.id ?? null,
      actorName: entry.actor?.displayName ?? null,
      actorEmail: entry.actor?.email ?? null,
      actorRole: entry.actor?.role ?? null,
      notes: entry.notes ?? null,
      createdAt: nowStamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log entry.');
  }
}
