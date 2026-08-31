import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { errorResponse, json } from '../../../lib/validation';

/**
 * Returns the signed-in user's own signature image.
 *
 * Signature images are kept out of the session cookie (they are too large for
 * the 4 KB cookie limit), so pages that need one fetch it from here.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return errorResponse(401, 'Unauthorized');
  }

  const d1 = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env?.DB;
  if (!d1 || user.id === null) {
    return json({ ok: true, signatureData: null });
  }

  try {
    const db = drizzle(d1);
    const rows = await db
      .select({ signatureData: users.signatureData, hasSignature: users.hasSignature })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const record = rows[0];
    return json({
      ok: true,
      signatureData: record?.hasSignature ? (record.signatureData ?? null) : null,
    });
  } catch {
    console.error('Failed to load signature for user id', user.id);
    return errorResponse(500, 'Could not load the signature.');
  }
};
