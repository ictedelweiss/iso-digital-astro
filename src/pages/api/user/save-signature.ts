import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { parseBody, saveSignatureSchema } from '../../../lib/schemas';
import { errorResponse, json } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';

export const POST: APIRoute = async ({ request, locals }) => {
  // The session is verified by middleware; `locals.user` cannot be forged.
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');
  if (user.id === null) {
    return errorResponse(409, 'User account is not provisioned yet. Please sign in again.');
  }

  const parsed = await parseBody(request, saveSignatureSchema);
  if (!parsed.ok) return parsed.response;

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(503, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    await db
      .update(users)
      .set({ signatureData: parsed.data.signatureData, hasSignature: true })
      .where(eq(users.id, user.id));

    await recordAudit(db, {
      entityType: 'user',
      entityId: user.id,
      action: 'updated',
      notes: 'Signature registered',
      actor: user,
    });
  } catch {
    console.error('Failed to persist signature for user.');
    return errorResponse(500, 'Could not save the signature. Please try again.');
  }

  // Echoing the image back is unnecessary and inflates the response.
  return json({ ok: true, message: 'Tanda tangan digital berhasil disimpan.' });
};
