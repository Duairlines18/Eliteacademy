import {loadAccountAssignment,accountHistory,accountSchedule,accountFeedbackContext} from './account-assignment.ts';
import {
  evaluateParentEntitlement,
  shapeParentBootstrap,
  shapeParentProfile,
  validateParentOnboarding,
} from './parent-core.ts';
import { saveFeedback } from './feedback-service.ts';

export class ParentServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ParentServiceError';
    this.code = code;
  }
}

async function athleteFor(user: any, repository: any) {
  return await repository.findParentAthlete(user.id)
    || await repository.ensureParentAthlete(user);
}

export async function ensureParentProfile({ user, repository }: any) {
  return shapeParentProfile(await repository.ensureParentAthlete(user));
}

export async function saveParentOnboarding({ user, input, repository }: any) {
  await athleteFor(user, repository);
  const safeFields = validateParentOnboarding(input);
  return shapeParentProfile(await repository.updateParentOnboarding(user.id, safeFields));
}

export async function bootstrapParentAthlete({ user, repository }: any) {
  const athlete = await athleteFor(user, repository);
  const entitlement = evaluateParentEntitlement(athlete);
  const messages: Record<string, string> = {
    PENDING_ACTIVATION: 'Your payment or parent access is still being confirmed.',
    ACCESS_PAUSED: 'This private athlete access is paused. Please contact Coach Du.',
    NO_ASSIGNMENT: 'Your athlete programme assignment is being prepared.',
  };
  if (entitlement !== 'ACTIVE') throw new ParentServiceError(entitlement, messages[entitlement]);

  let bundle = await loadAccountAssignment(athlete, repository);
  if (!bundle) {
    throw new ParentServiceError('PROGRAMME_PENDING', 'Your athlete programme week is being prepared.');
  }
  const historyWeeks = await accountHistory(athlete, repository);
  const programmeSchedule = await accountSchedule(athlete, repository);
  return { ...shapeParentBootstrap(athlete, bundle), historyWeeks, programmeSchedule };
}
export async function saveParentFeedback({user,input,repository}:any){
  const athlete=await athleteFor(user,repository);
  const entitlement=evaluateParentEntitlement(athlete);
  if(entitlement!=='ACTIVE')throw new ParentServiceError(entitlement,'Your parent access is not active.');
  const {cohortId,weekNumber}=await accountFeedbackContext(athlete,repository);
  return saveFeedback({repository,feedbackType:'parent_weekly',input,athleteId:athlete.id,cohortId,weekNumber,replaceExisting:true});
}
export async function loadParentHistory({user,weekNumber,repository}:any){
  const athlete=await athleteFor(user,repository);
  const entitlement=evaluateParentEntitlement(athlete);
  if(entitlement!=='ACTIVE')throw new ParentServiceError(entitlement,'Your parent access is not active.');
  const allowed=await accountHistory(athlete,repository);
  if(!Number.isInteger(weekNumber)||!allowed.some((w:any)=>w.week_number===weekNumber))throw new ParentServiceError('HISTORY_NOT_FOUND','That previous week is not available.');
  const bundle=await loadAccountAssignment(athlete,repository,weekNumber);
  if(!bundle?.week)throw new ParentServiceError('HISTORY_NOT_FOUND','That previous week is not available.');
  return shapeParentBootstrap(athlete,bundle);
}
