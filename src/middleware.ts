/**
 * Global request middleware.
 *
 * Responsibilities, in order:
 *   1. Resolve and verify the signed session (C-03 API authentication).
 *   2. Rate limit every request (M-06).
 *   3. Reject cross-origin state-changing requests (M-06 CSRF).
 *   4. Enforce authentication on non-public API routes.
 *   5. Attach security headers, including a nonce-based CSP (M-03).
 */
import type { MiddlewareHandler } from 'astro';
import { SESSION_COOKIE, getRuntimeEnv, openSession, hasRole } from './lib/session';
import type { SessionUser } from './lib/session';
import { rateLimit, clientKey, LIMITS } from './lib/rateLimit';

/** Auth endpoints must stay anonymous — they are how you obtain a session. */
const PUBLIC_API_PREFIXES = ['/api/auth/'];

/**
 * External guests scan a QR code and sign the attendance sheet without an
 * account, so this route has to stay open. It is unauthenticated by design;
 * input validation lives in the handler.
 */
const PUBLIC_API_PATTERNS = [/^\/api\/meetings\/[^/]+\/attend$/];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Content-Security-Policy (M-03).
 *
 * Astro 4 has no built-in CSP support, so the nonce is generated here and
 * injected into every <script> and <style> tag while the response is streamed
 * back. `strict-dynamic` lets the island loader pull in its module graph, and
 * `'self'` remains as a fallback for browsers without strict-dynamic support.
 *
 * `style-src` intentionally allows 'unsafe-inline': the PDF document preview
 * renders server-generated templates inside a sandboxed iframe that inherits
 * this policy, and those templates rely on inline CSS. Script execution — the
 * part that actually matters for XSS — stays locked to the nonce.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Attach the nonce to every opening <script> and <style> tag. */
function addNonceToTags(html: string, nonce: string): string {
  // `</script>` and `</style>` do not contain the `<script` / `<style`
  // substrings, so closing tags are never touched.
  return html
    .replaceAll('<script', `<script nonce="${nonce}"`)
    .replaceAll('<style', `<style nonce="${nonce}"`);
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request } = context;
  const { pathname } = new URL(request.url);
  const isApi = pathname.startsWith('/api/');
  const method = request.method.toUpperCase();

  // 1. Resolve and verify the session for every request (API and pages).
  const env = getRuntimeEnv(context.locals);
  context.locals.env = env;
  context.locals.cspNonce = crypto.randomUUID().replace(/-/g, '');

  try {
    context.locals.user = await openSession(context.cookies.get(SESSION_COOKIE)?.value, env);
  } catch {
    // A missing or misconfigured SESSION_SECRET must not take the whole site
    // down; treat everyone as anonymous so the login error is reported clearly.
    console.error('SESSION_SECRET is missing or invalid.');
    context.locals.user = null;
  }

  const user = context.locals.user;
  const key = clientKey(request, user?.id ?? null);

  // 2. Rate limiting (M-06).
  let bucket = LIMITS.read;
  if (pathname.startsWith('/api/auth/')) bucket = LIMITS.auth;
  else if (PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) bucket = LIMITS.attend;
  else if (MUTATING_METHODS.has(method)) bucket = LIMITS.mutation;

  const limitResult = rateLimit(`${bucket.limit}:${key}`, bucket.limit, bucket.windowMs);
  if (!limitResult.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limitResult.retryAfter),
      },
    });
  }

  // 3. CSRF / cross-origin protection (M-06).
  //
  // SameSite=Lax already blocks cookie-bearing cross-site POSTs, but this adds
  // an explicit origin check so a forged request is rejected even if the cookie
  // policy is ever relaxed. Every in-app fetch is same-origin, so legitimate
  // calls always carry a matching Origin.
  if (MUTATING_METHODS.has(method)) {
    const origin = request.headers.get('origin');
    const expected = new URL(request.url).origin;
    if (origin && origin !== expected) {
      return new Response(JSON.stringify({ error: 'Cross-origin request rejected.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 4. Enforce authentication on non-public API routes.
  if (isApi && !isPublicApi(pathname) && !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await next();

  // 5. Security headers.
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('text/html')) {
    const nonce = context.locals.cspNonce;
    const html = await response.text();
    const headers = new Headers(response.headers);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      if (!headers.has(header)) headers.set(header, value);
    }
    headers.set('Content-Security-Policy', buildCsp(nonce));
    // The body length changes once nonces are injected.
    headers.delete('Content-Length');
    return new Response(addNonceToTags(html, nonce), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(header)) response.headers.set(header, value);
  }
  if (isApi) response.headers.set('Cache-Control', 'no-store');
  return response;
};

// Re-exported so API handlers can use `locals.user` with correct typing.
export { hasRole };
export type { SessionUser };
