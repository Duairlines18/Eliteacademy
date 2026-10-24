export function schoolCompletionContext(identity: any, viewerKey: unknown) {
  if (!identity || identity.session.role !== 'athlete') return {denied:true};
  const {cohort,athlete}=identity;
  if (!cohort.programme_id || !Number.isInteger(cohort.current_week)) return {denied:true,code:'NO_ASSIGNMENT'};
  const base={programmeId:cohort.programme_id,weekNumber:cohort.current_week};
  if (athlete) return {kind:'athlete',userId:null,athleteId:athlete.id,viewerKey:`athlete_${athlete.id}`,...base};
  const key=typeof viewerKey==='string'?viewerKey.trim():'';
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) return {denied:true,code:'VIEWER_KEY_REQUIRED'};
  return {kind:'shared',userId:null,athleteId:null,viewerKey:`shared_${key}`,...base};
}
