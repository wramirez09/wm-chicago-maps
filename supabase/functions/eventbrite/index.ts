/**
 * Eventbrite Edge Function — keeps the OAuth token off the device.
 *
 * Docs: https://www.eventbrite.com/platform/api
 * Deno Deploy runtime: https://supabase.com/docs/guides/functions
 *
 * Public event search was removed from the Eventbrite API in December 2019, so
 * the only thing reachable is an organisation's own events, which needs a
 * private OAuth token. That token lives here as a function secret:
 *
 *     supabase secrets set EVENTBRITE_TOKEN=...
 *
 * Deploy: supabase functions deploy eventbrite
 */
// @ts-nocheck — this file runs on Deno, not in the React Native bundle. The
// app's tsconfig does not (and should not) know about Deno globals or
// https: imports.

const EVENTBRITE_API = 'https://www.eventbriteapi.com/v3';

type RequestBody = {
  action?: 'listOrganizationEvents';
  organizationId?: string;
  status?: string;
  page?: number;
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, 405);
  }

  const token = Deno.env.get('EVENTBRITE_TOKEN');
  if (!token) {
    return json({error: 'EVENTBRITE_TOKEN is not set on this function'}, 500);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json({error: 'Body must be JSON'}, 400);
  }

  if (body.action !== 'listOrganizationEvents') {
    return json({error: `Unsupported action: ${body.action ?? '(none)'}`}, 400);
  }

  if (!body.organizationId) {
    return json({error: 'organizationId is required'}, 400);
  }

  const url = new URL(
    `${EVENTBRITE_API}/organizations/${body.organizationId}/events/`,
  );
  url.searchParams.set('status', body.status ?? 'live');
  url.searchParams.set('page', String(body.page ?? 1));
  // Without this the venue is an id, and the client would need a second call
  // per event just to place it on the map.
  url.searchParams.set('expand', 'venue,logo');

  const upstream = await fetch(url, {
    headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
  });

  const text = await upstream.text();

  if (!upstream.ok) {
    // The upstream body is passed through for debugging but the token never
    // appears in it.
    return json(
      {error: `Eventbrite responded ${upstream.status}`, detail: text.slice(0, 500)},
      upstream.status,
    );
  }

  return new Response(text, {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}
