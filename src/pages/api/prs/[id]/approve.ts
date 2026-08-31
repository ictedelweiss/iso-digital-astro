import type { APIRoute } from 'astro';
import { purchaseRequisitions, prApprovals } from '../../../../db/schema';
import { createApprovalRoute } from '../../../../lib/approvalRoute';

/**
 * Record an approval or rejection for one step of a purchase requisition.
 *
 * The body only carries `decision` and an optional `notes`. Identity, role
 * check, signature and resulting status are all resolved server-side.
 */
export const POST: APIRoute = createApprovalRoute({
  entityType: 'pr',
  parentTable: purchaseRequisitions,
  approvalsTable: prApprovals,
  parentIdColumn: prApprovals.prId,
  requesterColumn: purchaseRequisitions.requesterId,
});
