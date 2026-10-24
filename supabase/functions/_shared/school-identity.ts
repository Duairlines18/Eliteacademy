// Only server-owned code/session records may select a school identity.
export async function authorizeSchoolIdentity(repository: any, code: any, cohort: any, role: string, session?: any) {
  const deny = () => { throw new Error('School identity unavailable'); };
  if (!code || !cohort || !['athlete', 'staff'].includes(role)) deny();
  if (session && ((session.athlete_id || null) !== (code.athlete_id || null)
    || (session.staff_id || null) !== (code.staff_id || null))) deny();
  if (role === 'athlete') {
    if (code.staff_id) deny();
    if (!code.athlete_id) return { athlete: null, staff: null };
    const athlete = await repository.findSchoolAthlete(code.athlete_id);
    if (!athlete || athlete.id !== code.athlete_id || athlete.athlete_type !== 'school'
      || athlete.access_status !== 'active' || athlete.cohort_id !== cohort.id
      || !cohort.organization_id || athlete.organization_id !== cohort.organization_id
      || (athlete.programme_id && athlete.programme_id !== cohort.programme_id)) deny();
    return { athlete, staff: null };
  }
  if (code.athlete_id) deny();
  if (!code.staff_id) return { athlete: null, staff: null };
  const staff = await repository.findSchoolStaff(code.staff_id);
  if (!staff || staff.id !== code.staff_id || staff.access_status !== 'active'
    || !await repository.isStaffAssigned(staff.id, cohort.id)) deny();
  return { athlete: null, staff };
}
