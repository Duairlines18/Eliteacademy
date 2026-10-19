import {prepareBundleForDelivery} from './hub-core.ts';
import {prepareAccountAdjustments} from './account-adjustments.ts';

export const publishedWeek = (week: any) => Boolean(week?.published_at)
  && week.verification_status === 'verified' && ['live','completed'].includes(week.status);

// Ownership is established by the role-specific repository lookup before this call.
// A broken direct assignment must never silently fall back to a different cohort.
export async function loadAccountAssignment(athlete: any, repository: any, weekNumber?: number) {
  const direct = Boolean(athlete.programme_id);
  const loaded = weekNumber === undefined
    ? await (direct ? repository.loadAssignedProgramme(athlete) : repository.loadCurrentProgramme(athlete.cohort_id))
    : await (direct ? repository.loadAssignedProgrammeWeek(athlete, weekNumber) : repository.loadProgrammeWeek(athlete.cohort_id, weekNumber));
  const bundle = prepareBundleForDelivery(loaded);
  return bundle ? prepareAccountAdjustments(bundle, athlete, repository) : null;
}

export async function accountHistory(athlete: any, repository: any) {
  return athlete.programme_id ? repository.listAssignedPublishedWeeks(athlete) : repository.listPublishedWeeks(athlete.cohort_id);
}

export async function accountSchedule(athlete: any, repository: any) {
  if (!athlete.programme_id) return [];
  const rows = await repository.listAssignedProgrammeSchedule(athlete);
  return rows.filter(publishedWeek).filter((w: any) => Number(w.week_number) <= Number(athlete.current_week) + 1);
}

export async function accountFeedbackContext(athlete: any, repository: any) {
  if (athlete.programme_id) return {cohortId:null,weekNumber:athlete.current_week};
  const cohort = await repository.findCohortContext(athlete.cohort_id);
  if (!cohort || cohort.status !== 'live') throw new Error('Your programme assignment is being prepared.');
  return {cohortId:athlete.cohort_id,weekNumber:cohort.current_week};
}
