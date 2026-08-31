import type { APIRoute } from 'astro';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../lib/session';

/**
 * Clears the session cookie.
 *
 * Deletion must repeat the same attributes used when the cookie was set,
 * otherwise the browser may keep the original value.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const { maxAge, ...attributes } = sessionCookieOptions(request.url);
  cookies.set(SESSION_COOKIE, '', { ...attributes, maxAge: 0 });

  return new Response(JSON.stringify({ ok: true, message: 'Logged out' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
