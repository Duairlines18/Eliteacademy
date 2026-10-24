import {allowHubLogin} from '../_shared/login-limits.ts';
import { ACCESS_DENIED_MESSAGE, corsHeaders } from '../_shared/hub-core.ts';
import { exchangeAccessCode } from '../_shared/hub-service.ts';
import { SupabaseHubRepository } from '../_shared/supabase-repository.ts';
import { adminClient, cryptoPort } from '../_shared/runtime.ts';

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response('ok', { status: cors['Access-Control-Allow-Origin'] ? 200 : 403, headers: cors });
  if (request.method !== 'POST' || !cors['Access-Control-Allow-Origin']) return json(origin, 403, { error: ACCESS_DENIED_MESSAGE });

  try {
    const repository = new SupabaseHubRepository(adminClient());
    const clientKey=request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
    if(!await allowHubLogin({clientKey,repository,cryptoPort}))return json(origin,429,{error:'Too many sign-in attempts. Please wait 10 minutes and try again.'});
    const body = await request.json();
    const result = await exchangeAccessCode({
      code: body?.code,
      view: body?.view,
      repository,
      cryptoPort,
    });
    return json(origin, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === ACCESS_DENIED_MESSAGE) return json(origin, 401, { error: ACCESS_DENIED_MESSAGE });
    console.error('verify-hub-access failed', error);
    return json(origin, 500, { error: 'The Performance Hub is temporarily unavailable.' });
  }
});

