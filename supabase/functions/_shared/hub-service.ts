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
  const cohort = await repository.findCohort(record.cohort_id);
  if (!cohort || cohort.status !== 'live') throw new Error(ACCESS_DENIED_MESSAGE);

  const rawToken = cryptoPort.randomToken();
  const tokenHash = await cryptoPort.sha256(rawToken);
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await repository.createSession({
    token_hash: tokenHash,
    role: input.view,
    cohort_id: record.cohort_id,
    access_code_id: record.id,
    expires_at: expiresAt,
  });
  await repository.touchCode(record.id, now.toISOString());
  return { token: rawToken, role: input.view, expiresAt };
}

export async function bootstrapHub({ token, now = new Date(), repository, cryptoPort }: any) {
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

  const bundle = prepareBundleForDelivery(await repository.loadCurrentProgramme(session.cohort_id));
  if (!bundle) {
    throw new Error(PROGRAMME_PENDING_MESSAGE);
  }
  await repository.touchSession(session.id, now.toISOString());
  return shapeBootstrap({ role: session.role, ...bundle });
}

export async function saveSharedHubFeedback({token,feedbackType,input,now=new Date(),repository,cryptoPort}:any){if(typeof token!=='string'||token.length<16||token.length>256)throw new Error(SESSION_EXPIRED_MESSAGE);const tokenHash=await cryptoPort.sha256(token);const session=await repository.findSession(tokenHash);if(!isSessionUsable(session,now))throw new Error(SESSION_EXPIRED_MESSAGE);const accessCode=await repository.findAccessCodeById(session.access_code_id);if(!isCodeUsable(accessCode,session.role,now)||accessCode.cohort_id!==session.cohort_id)throw new Error(SESSION_EXPIRED_MESSAGE);const cohort=await repository.findCohortContext(session.cohort_id);if(!cohort||cohort.status!=='live')throw new Error(SESSION_EXPIRED_MESSAGE);const expectedType=session.role==='staff'?'coach_weekly':(feedbackType==='athlete_issue'?'athlete_issue':'athlete_biweekly');const result=await saveFeedback({repository,feedbackType:expectedType,input,cohortId:session.cohort_id,weekNumber:cohort.current_week,replaceExisting:session.role==='staff'});await repository.touchSession(session.id,now.toISOString());return result;}

