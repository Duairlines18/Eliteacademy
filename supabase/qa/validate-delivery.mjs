// Pure preflight: mirrors the Hub's cohort -> published week -> days -> blocks -> exercises path.
// Does not authenticate users or write data. Call from a protected administrator-only server action.
export function validateDelivery({athlete,cohort,week,days=[],blocks=[],exercises=[],requireVideos=false}) {
  const errors=[],warnings=[];
  if(!athlete||!cohort)return {ok:false,errors:['MISSING_ASSIGNMENT'],warnings};
  if(athlete.cohort_id!==cohort.id)errors.push('COHORT_MISMATCH');
  if(athlete.programme_id!==cohort.programme_id||athlete.current_week!==cohort.current_week)errors.push('ASSIGNMENT_MISMATCH');
  if(athlete.access_status!=='active')errors.push('ACCOUNT_NOT_ACTIVE');
  if(cohort.status!=='live')errors.push('COHORT_NOT_LIVE');
  if(!week||week.programme_id!==cohort.programme_id||week.week_number!==cohort.current_week||
    !['live','completed'].includes(week.status)||week.verification_status!=='verified'||!week.published_at)
    errors.push('WEEK_NOT_PUBLISHED');
  if(!days.length||days.length>7)errors.push('INVALID_DAY_COUNT');
  const exerciseByCode=new Map(exercises.map(e=>[e.code,e]));
  const dayIds=new Set(days.map(d=>d.id)),blockDays=new Set();
  for(const b of blocks) {
    if(!dayIds.has(b.training_day_id)){errors.push('ORPHAN_BLOCK');continue;}
    blockDays.add(b.training_day_id);
    const c=b.content||{};
    const prescriptions=Array.isArray(c.prescriptions)?c.prescriptions:[];
    const codes=[...(Array.isArray(c.exerciseCodes)?c.exerciseCodes:[]),
      ...prescriptions.flatMap(p=>[p.exerciseCode,p.alternativeExerciseCode].filter(Boolean))];
    for(const code of codes) {
      if(typeof code!=='string'||!code.trim()){errors.push('INVALID_EXERCISE_CODE');continue;}
      const e=exerciseByCode.get(code.trim());
      if(!e||e.active!==true)errors.push('MISSING_EXERCISE:'+code);
      else if(!e.video_id&&!e.video_url)(requireVideos?errors:warnings).push('NO_DEMO_VIDEO:'+code);
    }
    for(const p of prescriptions)
      if(!p||typeof p.exerciseCode!=='string'||!p.exerciseCode.trim()||
        typeof p.dosage!=='string'||!p.dosage.trim())errors.push('INCOMPLETE_PRESCRIPTION');
    // The Hub also supports text-only session instructions. They can render, but do not
    // automatically resolve to an exercise-library video.
    if(Array.isArray(c.items)&&c.items.length&&!codes.length)
      warnings.push('TEXT_ONLY_NO_AUTOMATIC_VIDEO_LOOKUP');
  }
  for(const d of days)if(!blockDays.has(d.id))errors.push('DAY_WITHOUT_BLOCKS:'+d.id);
  return {ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
