import {loadAccountAssignment,accountHistory,accountSchedule,accountFeedbackContext} from './account-assignment.ts';
import {
  evaluatePrivateAthleteEntitlement,
  shapePrivateAthleteBootstrap,
  shapePrivateAthleteProfile,
  validatePrivateAthleteOnboarding,
} from './private-athlete-core.ts';
import { prepareBundleForDelivery } from './hub-core.ts';
import { prepareAccountAdjustments } from './account-adjustments.ts';
import { saveFeedback } from './feedback-service.ts';

export class PrivateAthleteServiceError extends Error {
  code: string;
  constructor(code: string,message: string){super(message);this.name='PrivateAthleteServiceError';this.code=code;}
}

async function athleteFor(user:any,repository:any){
  return await repository.findPrivateAthlete(user.id)||await repository.ensurePrivateAthlete(user);
}

export async function ensurePrivateAthleteProfile({user,repository}:any){
  return shapePrivateAthleteProfile(await repository.ensurePrivateAthlete(user));
}

export async function savePrivateAthleteOnboarding({user,input,repository}:any){
  await athleteFor(user,repository);
  const safeFields=validatePrivateAthleteOnboarding(input);
  return shapePrivateAthleteProfile(await repository.updatePrivateAthleteOnboarding(user.id,safeFields));
}

export async function bootstrapPrivateAthlete({user,repository}:any){
  const athlete=await athleteFor(user,repository);
  const entitlement=evaluatePrivateAthleteEntitlement(athlete);
  const messages:Record<string,string>={
    PENDING_ACTIVATION:'Your payment or private athlete access is still being confirmed.',
    ACCESS_PAUSED:'Your private athlete access is paused. Please contact Coach Du.',
    NO_ASSIGNMENT:'Your programme pathway is being assigned.',
  };
  if(entitlement!=='ACTIVE')throw new PrivateAthleteServiceError(entitlement,messages[entitlement]);
  let bundle=await loadAccountAssignment(athlete,repository);
  if(!bundle){
    throw new PrivateAthleteServiceError('PROGRAMME_PENDING','Your private athlete programme week is being prepared.');
  }
  const historyWeeks=await accountHistory(athlete,repository);
  const programmeSchedule=await accountSchedule(athlete,repository);
  const upcomingWeeks=programmeSchedule.filter((w:any)=>w.week_number>athlete.current_week);
  return {...shapePrivateAthleteBootstrap(athlete,bundle),historyWeeks,upcomingWeeks,programmeSchedule};
}
export async function savePrivateAthleteFeedback({user,input,feedbackType='athlete_weekly',repository}:any){const athlete=await athleteFor(user,repository);const entitlement=evaluatePrivateAthleteEntitlement(athlete);if(entitlement!=='ACTIVE')throw new PrivateAthleteServiceError(entitlement,'Your private athlete access is not active.');const {cohortId,weekNumber}=await accountFeedbackContext(athlete,repository);const allowedType=feedbackType==='athlete_issue'?'athlete_issue':'athlete_weekly';return saveFeedback({repository,feedbackType:allowedType,input,athleteId:athlete.id,cohortId,weekNumber,replaceExisting:allowedType!=='athlete_issue'});}
export async function loadPrivateAthleteHistory({user,weekNumber,repository}:any){const athlete=await athleteFor(user,repository);const entitlement=evaluatePrivateAthleteEntitlement(athlete);if(entitlement!=='ACTIVE')throw new PrivateAthleteServiceError(entitlement,'Your private athlete access is not active.');const directAssignment=Boolean(athlete.programme_id);const allowed=directAssignment?await repository.listAssignedPublishedWeeks(athlete):await repository.listPublishedWeeks(athlete.cohort_id);if(!Number.isInteger(weekNumber)||!allowed.some((item:any)=>item.week_number===weekNumber))throw new PrivateAthleteServiceError('HISTORY_NOT_FOUND','That previous week is not available.');const bundle=await loadAccountAssignment(athlete,repository,weekNumber);if(!bundle?.week)throw new PrivateAthleteServiceError('HISTORY_NOT_FOUND','That previous week is not available.');return shapePrivateAthleteBootstrap(athlete,bundle);}

export async function loadPrivateAthleteProgrammeWeek({user,weekNumber,repository}:any){
  const athlete=await athleteFor(user,repository);
  const entitlement=evaluatePrivateAthleteEntitlement(athlete);
  if(entitlement!=='ACTIVE')throw new PrivateAthleteServiceError(entitlement,'Your private athlete access is not active.');
  if(!athlete.programme_id)throw new PrivateAthleteServiceError('WEEK_NOT_AVAILABLE','That programme week is not available.');
  const bundle=prepareBundleForDelivery(await repository.loadAssignedVisibleWeek(athlete,weekNumber));
  if(!bundle?.week)throw new PrivateAthleteServiceError('WEEK_NOT_AVAILABLE','That programme week is not available yet.');
  return shapePrivateAthleteBootstrap(athlete,await prepareAccountAdjustments(bundle,athlete,repository));
}

