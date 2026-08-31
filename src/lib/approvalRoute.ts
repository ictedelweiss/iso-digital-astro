/**
 * Shared handler for the `POST /api/<resource>/[id]/approve` endpoints (H-01).
 *
 * All three document types share the same approval semantics, so the route
 * logic lives here and each endpoint only supplies its own tables.
 */
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { parseBody, approvalDecisionSchema } from './schemas';
import { decideApproval } from './approvals';
import { json, errorResponse } from './validation';
import type { AuditEntity } from './audit';

export interface ApprovalRouteConfig {
  entityType: AuditEntity;
  /** Table with `id`, `status`, `currentApprovalStep` and the owner column. */
  parentTable: any;
  approvalsTable: any;
  parentIdColumn: any;
  /** Column holding the document owner, for the self-approval check. */
  requesterColumn?: any;
}

export function createApprovalRoute(config: ApprovalRouteConfig): APIRoute {
  return async ({ request, params, locals }) => {
    const user = locals.user;
    if (!user) return errorResponse(401, 'Unauthorized.');

    const env = locals.runtime?.env;
    if (!env?.DB) return errorResponse(500, 'Database is not available.');

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return errorResponse(400, 'Invalid document ID.');

    const parsed = await parseBody(request, approvalDecisionSchema);
    if (!parsed.ok) return parsed.response;

    try {
      const db = drizzle(env.DB);

      let requesterId: number | null = null;
      if (config.requesterColumn) {
        const rows = await db
          .select({ requesterId: config.requesterColumn })
          .from(config.parentTable)
          .where(eq(config.parentTable.id, id))
          .limit(1);
        requesterId = rows[0]?.requesterId ?? null;
      }

      const result = await decideApproval(
        db,
        user,
        {
          entityType: config.entityType,
          parentTable: config.parentTable,
          approvalsTable: config.approvalsTable,
          parentIdColumn: config.parentIdColumn,
          requesterId,
        },
        id,
        parsed.data.decision,
        parsed.data.notes ?? undefined,
        env
      );

      if (!result.ok) return errorResponse(result.statusCode, result.error);

      return json({
        success: true,
        status: result.status,
        current_approval_step: result.currentStep,
      });
    } catch {
      return errorResponse(500, 'Failed to record the approval decision.');
    }
  };
}
