// Staff access is verified using the existing school-code session.
// This helper is for a service-role Edge Function only, never browser code.
export async function authorizeSchoolCoach(db: any, token: string, athleteId?: string) {
  if (!token || token.length < 16 || token.length > 256) throw Error('Session expired');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  const { data: session } = await db.from('hub_sessions').select('id,role,cohort_id,access_code_id,expires_at,revoked_at').eq('token_hash', hash).maybeSingle();
  if (!session || session.role !== 'staff' || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) throw Error('Session expired');
  const { data: code } = await db.from('access_codes').select('status,code_type,cohort_id,staff_id,expires_at').eq('id', session.access_code_id).maybeSingle();
  if (!code || code.status !== 'active' || code.code_type !== 'staff' || code.cohort_id !== session.cohort_id || (code.expires_at && Date.parse(code.expires_at) <= Date.now())) throw Error('Access revoked');
  const { data: cohort } = await db.from('cohorts').select('id,programme_id,status').eq('id', session.cohort_id).maybeSingle();
  if (!cohort || cohort.status !== 'live' || !cohort.programme_id) throw Error('Cohort unavailable');
  // Existing school staff codes are cohort-scoped and may intentionally be shared.
  // If a code identifies an individual staff member, enforce their assignment too.
  if (code.staff_id) {
    const { data: assignment } = await db.from('staff_cohorts').select('staff_id').eq('staff_id', code.staff_id).eq('cohort_id', cohort.id).maybeSingle();
    if (!assignment) throw Error('Coach not assigned');
  }
  let athlete = null;
  if (athleteId) {
    const { data } = await db.from('athletes').select('id,cohort_id,access_status').eq('id', athleteId).eq('cohort_id', cohort.id).eq('access_status', 'active').maybeSingle();
    if (!data) throw Error('Athlete not in assigned cohort');
    athlete = data;
  }
  return { session, cohort, athlete };
}
