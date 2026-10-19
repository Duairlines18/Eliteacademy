export type AccountEntitlementState = 'PENDING_ACTIVATION' | 'ACCESS_PAUSED' | 'NO_ASSIGNMENT' | 'ACTIVE';

const APPROVED_COMBINATIONS: Record<string, string> = {
  stripe: 'paid',
  manual_payment: 'manually_confirmed',
  complimentary: 'not_required',
};

export function evaluateAccountEntitlement(profile: any): AccountEntitlementState {
  if (profile?.access_status === 'paused' || profile?.access_status === 'archived') return 'ACCESS_PAUSED';
  if (profile?.access_status !== 'active') return 'PENDING_ACTIVATION';
  if (!Object.hasOwn(APPROVED_COMBINATIONS, profile?.access_reason)
    || APPROVED_COMBINATIONS[profile.access_reason] !== profile?.payment_status) return 'PENDING_ACTIVATION';
  if (!profile?.cohort_id) return 'NO_ASSIGNMENT';
  return 'ACTIVE';
}

