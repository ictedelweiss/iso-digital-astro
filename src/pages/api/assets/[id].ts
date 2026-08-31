import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { assets } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { parseBody, assetUpdateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const assetId = Number(params.id);
  if (!Number.isInteger(assetId) || assetId <= 0) return errorResponse(400, 'Invalid asset ID.');

  if (!hasRole(user, 'coordinator')) {
    return errorResponse(403, 'Only coordinators and above can update assets.');
  }

  const parsed = await parseBody(request, assetUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    const asset = existing[0];
    if (!asset) return errorResponse(404, 'Asset not found.');

    await db
      .update(assets)
      .set({
        assetCode: body.asset_code ?? asset.assetCode,
        name: body.name ?? asset.name,
        category: body.category ?? asset.category,
        location: body.location ?? asset.location,
        condition: body.condition ?? asset.condition,
        status: body.status ?? asset.status,
        serialNumber: body.serial_number ?? asset.serialNumber,
        purchaseDate: body.purchase_date ?? asset.purchaseDate,
        value: body.value ?? asset.value,
        assignedTo: body.assigned_to ?? asset.assignedTo,
      })
      .where(eq(assets.id, assetId));

    await recordAudit(db, {
      entityType: 'asset',
      entityId: assetId,
      action: 'updated',
      notes: body.asset_code ?? asset.assetCode,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update asset.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const assetId = Number(params.id);
  if (!Number.isInteger(assetId) || assetId <= 0) return errorResponse(400, 'Invalid asset ID.');

  if (!hasRole(user, 'admin')) {
    return errorResponse(403, 'Only administrators can delete assets.');
  }

  try {
    const db = drizzle(env.DB);
    const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    const asset = existing[0];
    if (!asset) return errorResponse(404, 'Asset not found.');

    await db.delete(assets).where(eq(assets.id, assetId));

    await recordAudit(db, {
      entityType: 'asset',
      entityId: assetId,
      action: 'deleted',
      notes: asset.assetCode,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete asset.');
  }
};
