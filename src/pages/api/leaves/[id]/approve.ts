import type { APIRoute } from 'astro';
import { leaveRequests, leaveApprovals } from '../../../../db/schema';
import { createApprovalRoute } from '../../../../lib/approvalRoute';

/** Approve or reject one step of a leave request. See `lib/approvals.ts`. */
export const POST: APIRoute = createApprovalRoute({
  entityType: 'leave',
  parentTable: leaveRequests,
  approvalsTable: leaveApprovals,
  parentIdColumn: leaveApprovals.leaveId,
  requesterColumn: leaveRequests.requesterId,
});
