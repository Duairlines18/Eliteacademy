import {normalizeCheckin,checkinSafety} from './weekly-checkins.ts';
export function blockedCheckin(state:any):string {
  if (!state || typeof state.enabled !== 'boolean') throw new Error('Check-in verification is unavailable.');
  if (!state.enabled) return '';
  if (!Array.isArray(state.due) || typeof state.held !== 'boolean') throw new Error('Check-in verification is unavailable.');
  // Resolve any outstanding form first; safety access remains held after it saves.
  if (state.due.length) return 'CHECKIN_REQUIRED';
  return state.held ? 'SAFETY_REVIEW_REQUIRED' : '';
}
export const checkinActions = new Set(['checkin-state','save-checkin','open-end-checkin','report-checkin-issue']);
export async function handleCheckinAction({user,audience,body,repository}:any) {
  const state=await repository.weeklyCheckinState(user.id,audience);
  if (body.action==='checkin-state') return {checkins:state};
  if (body.action==='open-end-checkin') return {checkins:await repository.openWeeklyEndCheckin(user.id,audience)};
  const submission=body.submissionId;
  if (typeof submission!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(submission)) throw new Error('Invalid check-in information.');
  if (body.action==='report-checkin-issue') {
    const input=body.input;
    if (!input||!['pain','illness','schedule','other'].includes(input.reason)||typeof input.note!=='string'||!input.note.trim()||input.note.length>1000) throw new Error('Invalid check-in information.');
    const payload={formVersion:'2.0',reason:input.reason,note:input.note.trim()};
    const result=await repository.reportWeeklyCheckinIssue(user.id,audience,submission,payload,['pain','illness'].includes(payload.reason));
    return {...result,checkins:await repository.weeklyCheckinState(user.id,audience)};
  }
  const requirement=state.requirements?.find((r:any)=>r.id===body.requirementId);
  if (!state.enabled||!requirement||body.kind!==requirement.kind||!Number.isInteger(body.expectedRevision)||body.expectedRevision<0) throw new Error('Invalid check-in information.');
  const payload=normalizeCheckin(requirement.kind,body.input,audience);
  const result=await repository.saveWeeklyCheckin(user.id,audience,requirement.id,submission,payload,body.expectedRevision,checkinSafety(payload));
  return {...result,checkins:await repository.weeklyCheckinState(user.id,audience)};
}
