import {
  ACCESS_DENIED_MESSAGE,
  PROGRAMME_PENDING_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  isCodeUsable,
  isSessionUsable,
  prepareBundleForDelivery,
  shapeBootstrap,
  validateLoginInput,
} from './hub-core.ts';
import { saveFeedback } from './feedback-service.ts';
import { authorizeSchoolIdentity } from './school-identity.ts';

export async function exchangeAccessCode({ code, view, now = new Date(), repository, cryptoPort }: any) {
  let input;
  try {
    input = validateLoginInput({ code, view });
  } catch {
    throw new Error(ACCESS_DENIED_MESSAGE);
  }
  const codeHash = await cryptoPort.sha256(input.code);
  const record = await repository.findAccessCode(codeHash);
  if (!isCodeUsable(record, input.view, now)) throw new Error(ACCESS_DENIED_MESSAGE);
  if(input.code.length===8&&!record.athlete_id&&!record.staff_id)throw new Error(ACCESS_DENIED_MESSAGE);
  const cohort = await repository.findCohort(record.cohort_id);
  if (!cohort || cohort.status !== 'live') throw new Error(ACCESS_DENIED_MESSAGE);
  let identity;
  try { identity = await authorizeSchoolIdentity(repository, record, cohort, input.view); }
  catch { throw new Error(ACCESS_DENIED_MESSAGE); }

  const rawToken = cryptoPort.randomToken();
  const tokenHash = await cryptoPort.sha256(rawToken);
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await repository.createSession({
    token_hash: tokenHash,
    role: input.view,
    cohort_id: record.cohort_id,
    access_code_id: record.id,
    athlete_id: identity.athlete?.id || null,
    staff_id: identity.staff?.id || null,
    expires_at: expiresAt,
  });
  await repository.touchCode(record.id, now.toISOString());
  return { token: rawToken, role: input.view, expiresAt };
}

export async function authorizeSchoolSession({ token, now = new Date(), repository, cryptoPort }: any) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 256) throw new Error(SESSION_EXPIRED_MESSAGE);
  const tokenHash = await cryptoPort.sha256(token);
  const session = await repository.findSession(tokenHash);
  if (!isSessionUsable(session, now)) throw new Error(SESSION_EXPIRED_MESSAGE);
  const accessCode = await repository.findAccessCodeById(session.access_code_id);
  if (!isCodeUsable(accessCode, session.role, now) || accessCode.cohort_id !== session.cohort_id) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  const cohort = await repository.findCohort(session.cohort_id);
  if (!cohort || cohort.status !== 'live') throw new Error(SESSION_EXPIRED_MESSAGE);
  let identity;
  try { identity = await authorizeSchoolIdentity(repository, accessCode, cohort, session.role, session); }
  catch { throw new Error(SESSION_EXPIRED_MESSAGE); }
  return { session, accessCode, cohort, ...identity };
}

export async function logoutSchoolSession(args: any) {
  const { session } = await authorizeSchoolSession(args);
  await args.repository.revokeSession(session.id, (args.now || new Date()).toISOString());
  return { loggedOut: true };
}

export async function bootstrapHub(args: any) {
  const {repository,now=new Date()} = args;
  const {session,athlete,staff} = await authorizeSchoolSession(args);

  const bundle = prepareBundleForDelivery(await repository.loadCurrentProgramme(session.cohort_id));
  if (!bundle) {
    throw new Error(PROGRAMME_PENDING_MESSAGE);
  }
  await repository.touchSession(session.id, now.toISOString());
  const roster = staff && repository.listSchoolRoster
    ? (await repository.listSchoolRoster(session.cohort_id))
      .filter((a: any) => a.cohort_id === session.cohort_id && a.access_status === 'active')
      .map((a: any) => ({id:a.id,display_name:a.display_name,cohort_id:a.cohort_id,access_status:a.access_status})) : null;
  return { ...shapeBootstrap({ role: session.role, ...bundle }),
    roster,
    completionSummary: staff?.access_profile==='sports_director' ? await repository.schoolCompletionSummary(session.cohort_id,bundle.programme.id,bundle.cohort.current_week) : null,
    accessMode: athlete || staff ? 'identified-school' : 'shared-school',
    athlete: athlete ? { id: athlete.id, displayName: athlete.display_name, formTier: athlete.form_tier || null,
      testing: athlete.onboarding_data?.testing_placeholder === true } : null,
    staff: staff ? {id:staff.id,displayName:staff.display_name || staff.full_name,accessProfile:staff.access_profile || 'coach'} : null };
}

export async function saveSharedHubFeedback(args: any) {
  const {repository, feedbackType, input, now=new Date()} = args;
  const {session,athlete,staff} = await authorizeSchoolSession(args);
  if(staff?.access_profile==='sports_director')throw new Error('Sports Director access is read-only.');
  const cohort = await repository.findCohortContext(session.cohort_id);
  if(!cohort || cohort.status !== 'live') throw new Error(SESSION_EXPIRED_MESSAGE);
  const expectedType = session.role === 'staff' ? 'coach_weekly' : (feedbackType === 'athlete_issue' ? 'athlete_issue' : 'athlete_biweekly');
  const result = await saveFeedback({repository, feedbackType:expectedType, input,
    athleteId:athlete?.id || null, staffId:staff?.id || null,
    cohortId:session.cohort_id,weekNumber:cohort.current_week,replaceExisting:session.role === 'staff'});
  await repository.touchSession(session.id,now.toISOString());
  return result;
}
