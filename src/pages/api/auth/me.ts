import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';

/**
 * Returns the current session.
 *
 * The user object comes from `locals.user`, which middleware populated by
 * verifying the signed cookie. Nothing here trusts client-supplied JSON.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    return new Response(JSON.stringify({ authenticated: false, user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Signature images are large; they are not stored in the cookie. Report
  // availability here and let /api/user/signature serve the image itself.
  let hasSignature = false;
  const d1 = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env?.DB;
  if (d1 && user.id !== null) {
    try {
      const db = drizzle(d1);
      const rows = await db
        .select({ hasSignature: users.hasSignature })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      hasSignature = Boolean(rows[0]?.hasSignature);
    } catch {
      // Non-fatal: the client will simply treat the user as unsigned.
    }
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: {
        id: user.id,
        msId: user.msId,
        displayName: user.displayName,
        email: user.email,
        jobTitle: user.jobTitle,
        department: user.department,
        role: user.role,
        has_signature: hasSignature,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
