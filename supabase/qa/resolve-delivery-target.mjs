// Read-only decision function. Exact IDs are mandatory; names are display-only.
// Mirrors the live private-athlete-hub-data direct programme route.
export function resolveDeliveryTarget({athlete,cohort=null,programme,week,accountType}) {
 const errors=[];
 if(!athlete?.id)errors.push('ATHLETE_ID_REQUIRED');
 if(!programme?.id||!week?.id)errors.push('PROGRAMME_WEEK_REQUIRED');
 if(!Number.isInteger(week?.week_number)||week.week_number<1)errors.push('INVALID_WEEK');
 if(programme?.id!==week?.programme_id)errors.push('WEEK_PROGRAMME_MISMATCH');
 if(!['live','completed'].includes(week?.status)||week?.verification_status!=='verified'||!week?.published_at)
   errors.push('WEEK_NOT_PUBLISHED');
 if(programme?.status!=='live')errors.push('PROGRAMME_NOT_LIVE');
 let route=null;
 if(accountType==='private-athlete'&&athlete?.programme_id){
   route='direct-private';
   if(athlete.programme_id!==programme?.id||athlete.current_week!==week?.week_number)
     errors.push('DIRECT_ASSIGNMENT_MISMATCH');
 } else {
   route='cohort';
   if(!cohort?.id||athlete?.cohort_id!==cohort?.id)errors.push('COHORT_MISMATCH');
   if(cohort?.programme_id!==programme?.id||cohort?.current_week!==week?.week_number)
     errors.push('COHORT_ASSIGNMENT_MISMATCH');
   if(cohort?.status!=='live')errors.push('COHORT_NOT_LIVE');
 }
 return {ok:errors.length===0,route,athleteId:athlete?.id||null,
   programmeId:programme?.id||null,weekId:week?.id||null,errors};
}
