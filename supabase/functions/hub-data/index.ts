import { PROGRAMME_PENDING_MESSAGE, SESSION_EXPIRED_MESSAGE, corsHeaders } from '../_shared/hub-core.ts';
import { bootstrapHub, saveSharedHubFeedback, logoutSchoolSession } from '../_shared/hub-service.ts';
import { SupabaseHubRepository } from '../_shared/supabase-repository.ts';
import { adminClient, cryptoPort } from '../_shared/runtime.ts';

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response('ok', { status: cors['Access-Control-Allow-Origin'] ? 200 : 403, headers: cors });
  if (request.method !== 'POST' || !cors['Access-Control-Allow-Origin']) return json(origin, 403, { error: 'Request not allowed.' });

  try {
    const body = await request.json();
    const repository = new SupabaseHubRepository(adminClient());
    let result;
    if (body?.action === 'bootstrap') result = await bootstrapHub({ token: request.headers.get('x-du-session') || '', repository, cryptoPort });
    else if (body?.action === 'logout') result = await logoutSchoolSession({ token: request.headers.get('x-du-session') || '', repository, cryptoPort });
    else if (body?.action === 'save-feedback') result = await saveSharedHubFeedback({ token: request.headers.get('x-du-session') || '', feedbackType: body.feedbackType, input: body.feedback, repository, cryptoPort });
    else return json(origin, 400, { error: 'Unsupported request.' });
    return json(origin, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) return json(origin, 401, { error: SESSION_EXPIRED_MESSAGE });
    if (error instanceof Error && error.message === PROGRAMME_PENDING_MESSAGE) return json(origin, 409, { error: PROGRAMME_PENDING_MESSAGE });
    if (error instanceof Error && error.message === 'Invalid feedback information.') return json(origin, 400, { error: error.message });
    console.error('hub-data failed', error);
    return json(origin, 500, { error: 'The Performance Hub is temporarily unavailable.' });
  }
});

