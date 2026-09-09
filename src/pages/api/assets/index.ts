import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { assets } from '../../../db/schema';
import { desc } from 'drizzle-orm';
import { parseBody, assetCreateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';
import { requirePermission } from '../../../lib/permissions';

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requirePermission(locals, 'asset-management', 'view');
  if (denied) return denied;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    const result = await db.select().from(assets).orderBy(desc(assets.id));

    return json({
      success: true,
      data: result.map((a) => ({
        id: a.id,
        asset_code: a.assetCode,
        name: a.name,
        category: a.category,
        location: a.location,
        condition: a.condition,
        status: a.status,
        serial_number: a.serialNumber,
        purchase_date: a.purchaseDate,
        value: a.value,
        assigned_to: a.assignedTo,
      })),
    });
  } catch {
    return errorResponse(500, 'Failed to load assets.');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requirePermission(locals, 'asset-management', 'create');
  if (denied) return denied;

  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, assetCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const newAsset = await db
      .insert(assets)
      .values({
        assetCode: body.asset_code,
        name: body.name,
        category: body.category,
        location: body.location,
        condition: body.condition,
        status: body.status,
        serialNumber: body.serial_number ?? null,
        purchaseDate: body.purchase_date ?? null,
        value: body.value ?? null,
        assignedTo: body.assigned_to ?? null,
      })
      .returning({ id: assets.id });

    await recordAudit(db, {
      entityType: 'asset',
      entityId: newAsset[0].id,
      action: 'created',
      notes: body.asset_code,
      actor: user,
    });

    return json({ success: true, id: newAsset[0].id }, 201);
  } catch {
    return errorResponse(500, 'Failed to create asset. The asset code may already exist.');
  }
};
