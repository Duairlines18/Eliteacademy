import { authorizeSchoolSession } from './hub-service.ts';
export class AttendanceError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
async function context(args: any, write = false) {
  const identity = await authorizeSchoolSession(args);
  const { session, staff, cohort } = identity;
  if (session.role !== 'staff' || !staff || (write && staff.access_profile === 'sports_director'))
    throw new AttendanceError('Attendance access is not permitted.', 403);
  const programme = await args.repository.attendanceProgramme(cohort.programme_id);
  const week = Number(args.weekNumber ?? cohort.current_week);
  if (!programme || !Number.isInteger(week) || week < 1 || week > programme.duration_weeks)
    throw new AttendanceError('Choose a valid programme week.');
  const roster = (await args.repository.listSchoolRoster(cohort.id))
    .filter((a: any) => a.cohort_id === cohort.id && a.access_status === 'active')
    .map((a: any) => ({ id: a.id, name: a.display_name }));
  return { cohort, staff, programme, week, roster };
}
function shape(row: any) {
  return { athleteId: row.athlete_id, sessionNumber: row.session_number, sessionDate: row.session_date,
    status: row.status, recordedAt: row.recorded_at };
}
export async function readSchoolAttendance(args: any) {
  const ctx = await context(args);
  const ids = new Set(ctx.roster.map((a: any) => a.id));
  const rows = await args.repository.readSchoolAttendance(ctx.cohort.id, ctx.programme.id, ctx.week);
  return { weekNumber: ctx.week, totalWeeks: ctx.programme.duration_weeks, currentWeek: ctx.cohort.current_week,
    writable: ctx.staff.access_profile !== 'sports_director', roster: ctx.roster,
    entries: rows.filter((r: any) => ids.has(r.athlete_id)).map(shape) };
}
export async function saveSchoolAttendance(args: any) {
  const ctx = await context(args, true), entries = args.entries;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > ctx.roster.length * 2)
    throw new AttendanceError('Choose attendance changes to save.');
  const ids = new Set(ctx.roster.map((a: any) => a.id)), seen = new Set();
  const now = args.now || new Date(), today = now.toISOString().slice(0, 10);
  const rows = entries.map((e: any) => {
    if (!e || Object.keys(e).some(k => !['athleteId','sessionNumber','sessionDate','status'].includes(k))
      || !ids.has(e.athleteId) || ![1,2].includes(e.sessionNumber)
      || !['unrecorded','present','absent','excused'].includes(e.status))
      throw new AttendanceError('Invalid attendance entry.');
    const key = e.athleteId + '|' + e.sessionNumber;
    if (seen.has(key)) throw new AttendanceError('Duplicate attendance entry.');
    seen.add(key);
    const date = e.sessionDate || null;
    if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date > today))
      throw new AttendanceError('Choose a valid session date, not in the future.');
    if (e.status !== 'unrecorded' && !date) throw new AttendanceError('Add the actual session date.');
    return { cohort_id: ctx.cohort.id, programme_id: ctx.programme.id, week_number: ctx.week,
      athlete_id: e.athleteId, session_number: e.sessionNumber, session_date: date, status: e.status,
      recorded_by_staff_id: ctx.staff.id, recorded_at: now.toISOString() };
  });
  // One batch upsert is atomic; unchanged cells are never overwritten.
  await args.repository.saveSchoolAttendance(rows);
  return { saved: rows.length, weekNumber: ctx.week };
}
