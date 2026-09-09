import type { APIRoute } from 'astro';

// Microsoft 365 Entra ID identifiers for Edelweiss School.
// These are public identifiers, not secrets. The client secret is never
// referenced here and must only ever come from runtime bindings.
const MS_CLIENT_ID = '4c3b8737-18da-4627-a039-71580f6aace6';
const MS_TENANT_ID = '6d9ec31b-9635-42f8-a9cc-081a25c4efb5';

export const GET: APIRoute = async ({ request, redirect, cookies }) => {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  // Cryptographically strong state, persisted in an HttpOnly cookie so the
  // callback can verify it. Previously the state was generated with
  // Math.random() and never checked (login CSRF).
  const state = crypto.randomUUID();

  cookies.set('iso_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  // Preserve return_to URL (e.g. deep link to PR approval)
  const returnTo = url.searchParams.get('return_to');
  if (returnTo && returnTo.startsWith('/')) {
    cookies.set('iso_oauth_return_to', returnTo, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });
  }

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state: state,
    prompt: 'select_account',
  });

  const authUrl = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
  return redirect(authUrl, 302);
};
