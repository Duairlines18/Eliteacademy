import { corsHeaders } from './hub-core.ts';
import { ensureParentProfile, saveParentOnboarding, bootstrapParentAthlete, saveParentFeedback, loadParentHistory } from './parent-service.ts';

const defaultServices = { ensureParentProfile, saveParentOnboarding, bootstrapParentAthlete, saveParentFeedback, loadParentHistory };

function json(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleParentRequest(request: Request, ports: any) {
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: cors['Access-Control-Allow-Origin'] ? 200 : 403, headers: cors });
  }
  if (request.method !== 'POST' || !cors['Access-Control-Allow-Origin']) {
    return json(origin, 403, { code: 'REQUEST_DENIED', error: 'Request not allowed.' });
  }

  const user = await ports.verifyUser(request);
  if (!user) return json(origin, 401, { code: 'SESSION_EXPIRED', error: 'Your session has expired. Please sign in again.' });

  let body: any;
  try { body = await request.json(); }
  catch { return json(origin, 400, { code: 'INVALID_REQUEST', error: 'Invalid request.' }); }

  const services = ports.services || defaultServices;
  try {
    let result;
    switch (body?.action) {
      case 'profile':
        result = await services.ensureParentProfile({ user, repository: ports.repository });
        break;
      case 'save-onboarding-draft':
        result = await services.saveParentOnboarding({ user, input: body.profile, repository: ports.repository, draft: true });
        break;
      case 'save-onboarding':
        result = await services.saveParentOnboarding({ user, input: body.profile, repository: ports.repository });
        break;
      case 'bootstrap':
        result = await services.bootstrapParentAthlete({ user, repository: ports.repository });
        break;
      case 'save-feedback':
        result = await services.saveParentFeedback({ user, input: body.feedback, repository: ports.repository });
        break;
      case 'history':
        result = await services.loadParentHistory({ user, weekNumber: Number(body.weekNumber), repository: ports.repository });
        break;
      default:
        return json(origin, 400, { code: 'UNSUPPORTED_ACTION', error: 'Unsupported request.' });
    }
    return json(origin, 200, result);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (error instanceof Error && (error.message === 'Invalid parent onboarding information.' || error.message === 'Invalid feedback information.')) {
      return json(origin, 400, { code: 'INVALID_PROFILE', error: error.message });
    }
    if (code === 'PENDING_ACTIVATION' || code === 'ACCESS_PAUSED') return json(origin, 403, { code, error: error.message });
    if (code === 'NO_ASSIGNMENT' || code === 'PROGRAMME_PENDING' || code === 'HISTORY_NOT_FOUND') return json(origin, 409, { code, error: error.message });
    return json(origin, 500, { code: 'SERVER_ERROR', error: 'The Parent Performance Hub is temporarily unavailable.' });
  }
}


