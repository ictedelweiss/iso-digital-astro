/**
 * Signed session management (C-02 fix).
 *
 * The previous implementation stored a plain, unsigned JSON blob in a
 * non-HttpOnly cookie, which meant any client could forge `role: "admin"`.
 * Sessions are now signed with HS256 using a server-side secret, so the
 * payload cannot be tampered with and the cookie is not readable by JS.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'iso_user_session';

/** Session lifetime: 8 hours (was 7 days, non-revocable). */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  /** Internal DB user id, when the account exists in the `users` table. */
  id: number | null;
  /** Microsoft Entra object id. */
  msId: string;
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  /** Authoritative role, resolved from the database — never from the client. */
  role: 'admin' | 'coordinator' | 'approver' | 'staff';
}

export type Role = SessionUser['role'];

/** Roles ranked from most to least privileged, for `hasRole` comparisons. */
const ROLE_RANK: Record<Role, number> = {
  admin: 3,
  approver: 2,
  coordinator: 1,
  staff: 0,
};

export function hasRole(user: SessionUser | null, minimum: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/**
 * Resolve the signing secret.
 *
 * IMPORTANT: this must never read `import.meta.env`. Vite statically inlines
 * `import.meta.env.*` at build time, which bakes the literal value into the
 * deployable bundle (see C-01). Only runtime bindings are read here.
 */
function getSecret(env?: Record<string, unknown> | null): Uint8Array {
  const raw =
    (env && (env.SESSION_SECRET as string | undefined)) ||
    (typeof process !== 'undefined' ? process.env.SESSION_SECRET : undefined);

  if (!raw) {
    throw new Error('SESSION_SECRET is not configured.');
  }
  if (raw.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }
  return new TextEncoder().encode(raw);
}

/** Read Cloudflare / process env from an Astro context or middleware locals. */
export function getRuntimeEnv(locals?: unknown): Record<string, unknown> | null {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } } | undefined)
    ?.runtime?.env;
  if (env) return env;
  return typeof process !== 'undefined' ? (process.env as Record<string, unknown>) : null;
}

/** Sign a session payload into a compact JWS. */
export async function sealSession(
  user: SessionUser,
  env?: Record<string, unknown> | null
): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret(env));
}

/** Verify a session token. Returns null when absent, expired, or tampered with. */
export async function openSession(
  token: string | undefined | null,
  env?: Record<string, unknown> | null
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    if (!payload || typeof payload.msId !== 'string') return null;
    return payload as unknown as SessionUser;
  } catch {
    // Invalid signature, expired, or malformed — treat as unauthenticated.
    return null;
  }
}

/** Cookie options shared by login, refresh, and logout. */
export function sessionCookieOptions(requestUrl: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  const isHttps = requestUrl.startsWith('https:');
  return {
    path: '/' as const,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    maxAge,
  };
}
