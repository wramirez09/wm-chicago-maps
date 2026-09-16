/**
 * Google Business Profile OAuth — Edge Function scaffold.
 *
 * OAuth 2.0:  https://developers.google.com/identity/protocols/oauth2/web-server
 * GBP API:    https://developers.google.com/my-business/reference/rest
 * Account Mgmt: https://developers.google.com/my-business/reference/accountmanagement/rest
 *
 * ⚠️ SCAFFOLD ONLY — deliberately not wired into the app UI, per the brief.
 *
 * This is owner-consented sync: a business owner authorises the app to read
 * *their* listing. It is not a way to read arbitrary businesses, and the API
 * requires Google to approve the project before it returns anything beyond the
 * authenticated user's own locations.
 *
 * Secrets this function needs:
 *     supabase secrets set GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... GBP_REDIRECT_URI=...
 *
 * Flow:
 *   1. App opens `?action=authUrl` in a browser, user consents.
 *   2. Google redirects to GBP_REDIRECT_URI with `?code=`.
 *   3. That redirect handler calls this function with `action=exchange`.
 *   4. Refresh token is stored server-side, never returned to the device.
 */
// @ts-nocheck — Deno runtime, not part of the RN bundle.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** Read-only access to the owner's own listings. */
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

Deno.serve(async (request: Request) => {
  const clientId = Deno.env.get('GBP_CLIENT_ID');
  const clientSecret = Deno.env.get('GBP_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GBP_REDIRECT_URI');

  if (!clientId || !clientSecret || !redirectUri) {
    return json({error: 'GBP_CLIENT_ID / GBP_CLIENT_SECRET / GBP_REDIRECT_URI are not set'}, 500);
  }

  const body = request.method === 'POST' ? await safeJson(request) : {};
  const action = body.action ?? new URL(request.url).searchParams.get('action');

  if (action === 'authUrl') {
    const url = new URL(AUTH_ENDPOINT);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    // Required to get a refresh token at all; Google only issues one on the
    // first consent unless `prompt=consent` forces it again.
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    if (body.state) {
      url.searchParams.set('state', String(body.state));
    }
    return json({authUrl: url.toString()}, 200);
  }

  if (action === 'exchange') {
    if (!body.code) {
      return json({error: 'code is required'}, 400);
    }

    const upstream = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code: String(body.code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await upstream.json();

    if (!upstream.ok) {
      return json({error: 'Token exchange failed', detail: tokens}, upstream.status);
    }

    // TODO: persist tokens.refresh_token against the signed-in user, then sync
    // their locations. Deliberately left unimplemented — storing a refresh
    // token is a security decision that needs the accounts schema settled
    // first, and returning it to the device would defeat the point of this
    // function existing.
    return json(
      {
        connected: true,
        scope: tokens.scope,
        expiresIn: tokens.expires_in,
        note: 'Refresh token received server-side; persistence not implemented yet.',
      },
      200,
    );
  }

  return json({error: `Unsupported action: ${action ?? '(none)'}`}, 400);
});

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}
