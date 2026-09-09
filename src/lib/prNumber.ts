import { purchaseRequisitions } from '../db/schema';

/**
 * Check whether a PR number is still a provisional/draft tracking ID.
 */
export function isDraftPrNumber(prNumber: string | null | undefined): boolean {
  if (!prNumber) return true;
  return prNumber.startsWith('DRAFT-') || prNumber.startsWith('PR-TEMP-') || prNumber.startsWith('PR-DRAFT-');
}

/**
 * Format a display-friendly label for PR number in UI/tables.
 */
export function formatDisplayPrNumber(prNumber: string | null | undefined): string {
  if (isDraftPrNumber(prNumber)) {
    return '⏳ Menunggu No. PR (Accounting)';
  }
  return prNumber || '—';
}

/**
 * Generate the official PR number server-side.
 * Format: PR/{dept}/{year}/{month}/{counter}
 */
export async function generatePrNumber(db: any, department: string): Promise<string> {
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
