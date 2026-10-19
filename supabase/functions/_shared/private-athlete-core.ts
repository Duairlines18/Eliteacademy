import { shapeBootstrap } from './hub-core.ts';
import { evaluateAccountEntitlement } from './account-entitlement.ts';

export type PrivateAthleteEntitlement = 'PENDING_ACTIVATION' | 'ACCESS_PAUSED' | 'NO_ASSIGNMENT' | 'ACTIVE';

const SAFE_FIELDS = new Set([
  'first_name', 'last_name', 'sport_pathway', 'primary_goals',
  'training_environment', 'equipment', 'weekly_availability',
  'training_experience', 'schedule_notes',
]);

function text(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') throw new Error('Invalid private athlete onboarding information.');
  return value.trim().slice(0, maxLength);
}

function requiredText(value: unknown, maxLength = 200): string {
  const result = text(value, maxLength);
  if (!result) throw new Error('Invalid private athlete onboarding information.');
  return result;
}

function textArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some(item => typeof item !== 'string')) {
    throw new Error('Invalid private athlete onboarding information.');
  }
  return value.map(item => item.trim().slice(0, 150)).filter(Boolean);
}

export function validatePrivateAthleteOnboarding(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid private athlete onboarding information.');
  }
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some(key => !SAFE_FIELDS.has(key))) {
    throw new Error('Invalid private athlete onboarding information.');
  }
  const firstName = requiredText(fields.first_name, 100);
  const lastName = requiredText(fields.last_name, 100);
  return {
    full_name: `${firstName} ${lastName}`,
    display_name: firstName,
    onboarding_complete: true,
    onboarding_data: {
      sportPathway: requiredText(fields.sport_pathway, 150),
      primaryGoals: textArray(fields.primary_goals, 20),
      trainingEnvironment: requiredText(fields.training_environment, 150),
      equipment: textArray(fields.equipment, 30),
      weeklyAvailability: requiredText(fields.weekly_availability, 100),
      trainingExperience: text(fields.training_experience ?? '', 500),
      scheduleNotes: text(fields.schedule_notes ?? '', 1000),
    },
  };
}

export function evaluatePrivateAthleteEntitlement(athlete: any): PrivateAthleteEntitlement {
  const state = evaluateAccountEntitlement(athlete);
  if (state === 'NO_ASSIGNMENT' && athlete?.programme_id) return 'ACTIVE';
  return state;
}

export function shapePrivateAthleteProfile(athlete: any) {
  const names = String(athlete?.full_name || '').trim().split(/\s+/);
  return {
    firstName: athlete?.display_name || names[0] || '',
    lastName: names.slice(1).join(' '),
    email: athlete?.athlete_email || '',
    onboardingComplete: athlete?.onboarding_complete === true,
    onboarding: athlete?.onboarding_data || {},
    accessState: evaluatePrivateAthleteEntitlement(athlete),
  };
}

export function shapePrivateAthleteBootstrap(athlete: any, bundle: any): Record<string, unknown> {
  const { role: _role, ...programmePayload } = shapeBootstrap({ role: 'athlete', ...bundle });
  const profile = shapePrivateAthleteProfile(athlete);
  return {
    accessMode: 'account',
    audience: 'private-athlete',
    delivery: {model: athlete?.parent_user_id ? 'review-required' : 'private-athlete', copyWorkout: Boolean(athlete?.athlete_user_id) && !athlete?.parent_user_id},
    athlete: {displayName:athlete?.display_name || '',fullName:athlete?.full_name || ''},
    viewer: { firstName: profile.firstName, lastName: profile.lastName, email: profile.email },
    pathway: { id: bundle.programme.id, name: bundle.programme.name },
    ...programmePayload,
    programme: { ...(programmePayload as any).programme, personalNote: bundle.personalNote || '' },
  };
}

