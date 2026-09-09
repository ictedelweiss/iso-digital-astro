import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import {
  SESSION_COOKIE,
  getRuntimeEnv,
  sealSession,
  sessionCookieOptions,
  type Role,
  type SessionUser,
} from '../../../lib/session';

const MS_CLIENT_ID = '4c3b8737-18da-4627-a039-71580f6aace6';
const MS_TENANT_ID = '6d9ec31b-9635-42f8-a9cc-081a25c4efb5';

/** Comma-separated list of permitted email domains. Override via env if needed. */
const DEFAULT_ALLOWED_DOMAINS = 'edelweiss.sch.id';

function allowedDomains(env: Record<string, unknown> | null): string[] {
  const configured = (env as { ALLOWED_EMAIL_DOMAINS?: string } | null)?.ALLOWED_EMAIL_DOMAINS;
  return (configured || DEFAULT_ALLOWED_DOMAINS)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email: string, env: Record<string, unknown> | null): boolean {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  return allowedDomains(env).includes(email.slice(at + 1).toLowerCase());
}

interface ResolvedUser {
  id: number | null;
  role: Role;
  jobTitle: string;
  department: string;
  sessionVersion: number;
  isActive: boolean;
  /**
   * false when no matching account exists in our directory. L-03 requires that
   * only accounts present in the `users` table may sign in, so the caller must
   * reject the session when this is false.
   */
  registered: boolean;
}

/**
 * Resolve the account in our own database so that `role` is authoritative.
 * Entra ID proves *identity*; the database decides *authorisation*.
 */
async function resolveUser(
  db: ReturnType<typeof drizzle> | null,
  profile: { msId: string; email: string; displayName: string; jobTitle: string; department: string }
): Promise<ResolvedUser> {
  // No DB binding: we cannot enforce membership, so fail open to least
  // privilege rather than locking everyone out of the app entirely.
  if (!db) {
    return {
      id: null,
      role: 'staff',
      jobTitle: profile.jobTitle,
      department: profile.department,
      sessionVersion: 0,
      isActive: true,
      registered: true,
    };
  }

  // 1. Existing account matched on Entra object id.
  const byMsId = await db
    .select()
    .from(users)
    .where(eq(users.msId, profile.msId))
    .limit(1);

  // 2. Otherwise match on email (covers pre-seeded staff whose msId is a placeholder).
  let record = byMsId[0];
  if (!record && profile.email) {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);
    record = byEmail[0];
  }

  if (record) {
    // Keep the Entra object id in sync, so later logins match directly.
    if (!record.msId || record.msId !== profile.msId) {
      await db.update(users).set({ msId: profile.msId }).where(eq(users.id, record.id));
    }
    return {
      id: record.id,
      role: (record.role as Role) ?? 'staff',
      jobTitle: record.jobTitle || profile.jobTitle,
      department: record.department || profile.department,
      sessionVersion: record.sessionVersion ?? 0,
      isActive: record.isActive !== false,
      registered: true,
    };
  }

  // 3. New account from allowed domain -> auto-provision into directory as staff
  const username = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || `user_${Date.now()}`;
  try {
    const inserted = await db
      .insert(users)
      .values({
        displayName: profile.displayName,
        email: profile.email.toLowerCase(),
        username,
        department: profile.department || 'Umum',
        jobTitle: profile.jobTitle || 'Staff',
        role: 'staff',
        msId: profile.msId,
        hasSignature: false,
        isActive: true,
        sessionVersion: 0,
      })
      .returning({
        id: users.id,
        role: users.role,
        jobTitle: users.jobTitle,
        department: users.department,
        sessionVersion: users.sessionVersion,
        isActive: users.isActive,
      });

    const newUser = inserted[0];
    return {
      id: newUser.id,
      role: (newUser.role as Role) ?? 'staff',
      jobTitle: newUser.jobTitle,
      department: newUser.department,
      sessionVersion: newUser.sessionVersion ?? 0,
      isActive: newUser.isActive !== false,
      registered: true,
    };
  } catch (insertErr) {
    // If username/email unique conflict raced, try finding it again
    const fallback = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email.toLowerCase()))
      .limit(1);

    if (fallback[0]) {
      return {
        id: fallback[0].id,
        role: (fallback[0].role as Role) ?? 'staff',
        jobTitle: fallback[0].jobTitle || profile.jobTitle,
        department: fallback[0].department || profile.department,
        sessionVersion: fallback[0].sessionVersion ?? 0,
        isActive: fallback[0].isActive !== false,
        registered: true,
      };
    }

    console.error('Failed to auto-provision user:', insertErr);
    return {
      id: null,
      role: 'staff',
      jobTitle: profile.jobTitle,
      department: profile.department,
      sessionVersion: 0,
      isActive: false,
      registered: false,
    };
  }
}

export const GET: APIRoute = async ({ request, redirect, cookies, locals }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');
  const env = getRuntimeEnv(locals);

  if (error || !code) {
    // Only the provider-supplied error code is surfaced; never token material.
    return redirect('/?auth_error=' + encodeURIComponent(error || 'no_code'), 302);
  }

  // --- Login CSRF protection: verify the state we issued earlier. -----------
  const expectedState = cookies.get('iso_oauth_state')?.value;
  cookies.delete('iso_oauth_state', { path: '/' });
  if (!expectedState || !state || expectedState !== state) {
    return redirect('/?auth_error=invalid_state', 302);
  }

  const redirectUri = `${url.origin}/api/auth/callback`;

  // The client secret is read ONLY from runtime bindings. Reading it from
  // import.meta.env would inline the literal into the built bundle, exposing
  // it inside the deployed worker (C-01).
  const msSecret = (env as { MS_CLIENT_SECRET?: string } | null)?.MS_CLIENT_SECRET;

  if (!msSecret) {
    return redirect('/?auth_error=missing_ms_secret', 302);
  }

  try {
    // 1. Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: msSecret,
      scope: 'openid profile email User.Read',
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      }
    );

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      // Log the status only — the response body may contain token material.
      console.error('Microsoft token exchange failed with status', tokenRes.status);
      return redirect('/?auth_error=token_failed', 302);
    }

    // 2. Fetch user profile from Microsoft Graph API
    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!graphRes.ok) {
      console.error('Microsoft Graph profile fetch failed with status', graphRes.status);
      return redirect('/?auth_error=profile_failed', 302);
    }

    const graphUser = (await graphRes.json()) as Record<string, string>;
    const msEmail = (graphUser.mail || graphUser.userPrincipalName || '').toLowerCase();
    const msId = graphUser.id;

    if (!msId || !msEmail) {
      return redirect('/?auth_error=incomplete_profile', 302);
    }

    // 3. Only accept accounts belonging to the organisation.
    if (!isAllowedEmail(msEmail, env)) {
      return redirect('/?auth_error=domain_not_allowed', 302);
    }

    const profile = {
      msId,
      email: msEmail,
      displayName: graphUser.displayName || 'Staf Edelweiss',
      jobTitle: graphUser.jobTitle || 'Staff',
      department: graphUser.department || 'ICT',
    };

    // 4. Resolve role from our database — never from the client.
    let db: ReturnType<typeof drizzle> | null = null;
    const d1 = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env?.DB;
    if (d1) db = drizzle(d1);

    let resolved;
    try {
      resolved = await resolveUser(db, profile);
    } catch (dbErr) {
      // Fail closed on a resolution error rather than granting access.
      console.error('User resolution failed; denying sign-in.');
      return redirect('/?auth_error=server_error', 302);
    }

    // 5. Only active accounts present in our directory may proceed (L-03).
    if (!resolved.registered) {
      return redirect('/?auth_error=user_not_registered', 302);
    }
    if (!resolved.isActive) {
      return redirect('/?auth_error=account_disabled', 302);
    }

    // Update lastLoginAt in database
    if (db && resolved.id) {
      try {
        const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.update(users).set({ lastLoginAt: nowStamp }).where(eq(users.id, resolved.id));
      } catch {
        // Non-fatal if timestamp update fails
      }
    }

    // 6. Issue a signed, HttpOnly session cookie.
    const sessionUser: SessionUser = {
      id: resolved.id,
      msId: profile.msId,
      displayName: profile.displayName,
      email: profile.email,
      jobTitle: resolved.jobTitle,
      department: resolved.department,
      role: resolved.role,
      sessionVersion: resolved.sessionVersion,
    };

    const token = await sealSession(sessionUser, env);
    cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.url));

    const returnTo = cookies.get('iso_oauth_return_to')?.value;
    cookies.delete('iso_oauth_return_to', { path: '/' });

    const target = returnTo && returnTo.startsWith('/') ? returnTo : '/';
    const separator = target.includes('?') ? '&' : '?';
    return redirect(`${target}${separator}login_success=1`, 302);
  } catch (err) {
    // Generic message outward; details stay server-side.
    console.error('Error during Microsoft callback exchange.');
    return redirect('/?auth_error=server_error', 302);
  }
};
