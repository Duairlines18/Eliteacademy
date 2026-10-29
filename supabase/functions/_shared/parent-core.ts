import { shapeBootstrap } from './hub-core.ts';
import { evaluateAccountEntitlement } from './account-entitlement.ts';

export type ParentEntitlementState = 'PENDING_ACTIVATION' | 'ACCESS_PAUSED' | 'NO_ASSIGNMENT' | 'ACTIVE';

const SAFE_FIELDS = new Set([
  'parent_first_name', 'parent_last_name', 'athlete_first_name', 'athlete_last_name',
  'age_band', 'sport_pathway', 'training_environment', 'equipment',
  'weekly_availability', 'considerations',
]);

function text(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') throw new Error('Invalid parent onboarding information.');
  return value.trim().slice(0, maxLength);
}

function requiredText(value: unknown, maxLength = 200): string {
  const result = text(value, maxLength);
  if (!result) throw new Error('Invalid parent onboarding information.');
  return result;
}

function textArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some(item => typeof item !== 'string')) {
    throw new Error('Invalid parent onboarding information.');
  }
  return value.map(item => item.trim()).filter(Boolean);
}

const COMPACT_FIELDS = new Set(['form_version','development_priorities','hub_frequency','training_locations','equipment','safety_status','safety_details']);
const PRIORITIES = ['Speed','Jumping / Explosiveness','Movement / Coordination','Strength','Mobility / Resilience'];
function invalid(): never { throw new Error('Invalid parent onboarding information.'); }
function compactOnboarding(fields: Record<string, unknown>, draft: boolean) {
  if (Object.keys(fields).some(key => !COMPACT_FIELDS.has(key))) invalid();
  const data: Record<string, unknown> = {formVersion: 2};
  const list = (key: string, target: string, options: string[], max: number) => {
    if (draft && fields[key] === undefined) return;
    const value = fields[key];
    if (!Array.isArray(value) || value.length > max || (!draft && !value.length)
      || value.some(item => typeof item !== 'string' || !options.includes(item)) || new Set(value).size !== value.length) invalid();
    data[target] = value;
  };
  list('development_priorities','developmentPriorities',PRIORITIES,2);
  list('training_locations','trainingLocations',['Home','Gym','Field / Court'],3);
  list('equipment','equipment',['Bodyweight only','Resistance bands','Weights','Other'],4);
  if (Array.isArray(data.equipment) && data.equipment.includes('Bodyweight only') && data.equipment.length > 1) invalid();
  for (const [key,target,options] of [
    ['hub_frequency','hubFrequency',['1 day','2 days','3 days','4+ days']],
    ['safety_status','safetyStatus',['no','yes','already_discussed']],
  ] as const) {
    if (draft && fields[key] === undefined) continue;
    if (!(options as readonly unknown[]).includes(fields[key])) invalid();
    data[target] = fields[key];
  }
  if (fields.safety_status === 'yes') {
    if (typeof fields.safety_details !== 'string' || fields.safety_details.length > 1000) {
      if (!draft || fields.safety_details !== undefined) invalid();
    } else {
      const details = fields.safety_details.trim();
      if (!draft && !details) invalid();
      // Empty drafts must never erase a previously recorded concern.
      if (details) data.safetyDetails = details;
    }
  } else if (fields.safety_details !== undefined) invalid();
  return {onboarding_complete: !draft, onboarding_data: data};
}

export function validateParentOnboarding(input: unknown, draft = false): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid parent onboarding information.');
  }
  const fields = input as Record<string, unknown>;
  if (fields.form_version === 2) return compactOnboarding(fields, draft);
  if (draft) invalid();
  if (Object.keys(fields).some(key => !SAFE_FIELDS.has(key))) {
    throw new Error('Invalid parent onboarding information.');
  }
  const parentFirstName = requiredText(fields.parent_first_name, 100);
  const parentLastName = requiredText(fields.parent_last_name, 100);
  const athleteFirstName = requiredText(fields.athlete_first_name, 100);
  const athleteLastName = requiredText(fields.athlete_last_name, 100);
  return {
    full_name: `${athleteFirstName} ${athleteLastName}`,
    display_name: athleteFirstName,
    parent_first_name: parentFirstName,
    parent_last_name: parentLastName,
    onboarding_complete: true,
    onboarding_data: {
      ageBand: requiredText(fields.age_band, 50),
      sportPathway: requiredText(fields.sport_pathway, 120),
      trainingEnvironment: requiredText(fields.training_environment, 120),
      equipment: textArray(fields.equipment),
      weeklyAvailability: requiredText(fields.weekly_availability, 100),
      considerations: text(fields.considerations ?? '', 1000),
    },
  };
}

export function evaluateParentEntitlement(athlete: any): ParentEntitlementState {
  const state = evaluateAccountEntitlement(athlete);
  return state === 'NO_ASSIGNMENT' && athlete?.programme_id ? 'ACTIVE' : state;
}

export function shapeParentProfile(athlete: any) {
  return {
    parent: {
      firstName: athlete?.parent_first_name || '',
      lastName: athlete?.parent_last_name || '',
      email: athlete?.parent_email || '',
    },
    athlete: {
      displayName: athlete?.display_name || '',
      fullName: athlete?.full_name || '',
    },
    onboardingComplete: athlete?.onboarding_complete === true,
    onboarding: athlete?.onboarding_data || {},
    accessState: evaluateParentEntitlement(athlete),
  };
}

export function shapeParentBootstrap(athlete: any, bundle: any): Record<string, unknown> {
  const { role: _role, ...programmePayload } = shapeBootstrap({ role: 'athlete', ...bundle });
  return {
    accessMode: 'account',
    audience: 'parent',
    delivery: {model:'parent-managed',copyWorkout:false},
    viewer: {
      firstName: athlete?.parent_first_name || '',
      lastName: athlete?.parent_last_name || '',
      email: athlete?.parent_email || '',
    },
    athlete: {
      displayName: athlete?.display_name || '',
      fullName: athlete?.full_name || '',
    },
    pathway: { id: bundle.programme.id, name: bundle.programme.name },
    ...programmePayload,
    programme: { ...(programmePayload as any).programme, personalNote: bundle.personalNote || '' },
  };
}

