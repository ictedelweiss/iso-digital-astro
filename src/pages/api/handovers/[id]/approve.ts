import type { APIRoute } from 'astro';
import { handoverForms, handoverApprovals } from '../../../../db/schema';
import { createApprovalRoute } from '../../../../lib/approvalRoute';

/**
 * Approve or reject one step of a handover form.
 *
 * No self-approval column is supplied here: the recipient is not one of the
 * approvers, so segregation of duties is handled by the role check alone.
 */
export const POST: APIRoute = createApprovalRoute({
  entityType: 'handover',
  parentTable: handoverForms,
  approvalsTable: handoverApprovals,
  parentIdColumn: handoverApprovals.handoverId,
});
