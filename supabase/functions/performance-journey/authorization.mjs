const payments={complimentary:'not_required',manual_payment:'manually_confirmed',stripe:'paid'};
export const activeAthlete=a=>a?.access_status==='active'&&Object.hasOwn(payments,a?.access_reason)&&payments[a.access_reason]===a.payment_status;
export function resolveAccountSubject(athletes,userId,audience,requestedId){
  if(!['parent','private-athlete'].includes(audience))throw Error('Access denied');
  const field=audience==='parent'?'parent_user_id':'athlete_user_id';
  const matches=(athletes||[]).filter(a=>a[field]===userId&&activeAthlete(a)&&(a.programme_id||a.cohort_id)&&(!requestedId||a.id===requestedId));
  if(!matches.length)throw Error('Access denied');
  return {...matches.sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0],kind:'athlete',parentMode:audience==='parent'};
}
export function resolveSharedSubject(session,code,cohort,athlete=null,staffAssigned=true,now=Date.now()){
  const expires=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)>now;
  if(!session||!['athlete','staff'].includes(session.role)||session.revoked_at||!expires(session.expires_at))throw Error('Session expired');
  if(!code||code.status!=='active'||code.code_type!==(session.role==='staff'?'staff':'cohort')||code.cohort_id!==session.cohort_id||(code.expires_at&&!expires(code.expires_at)))throw Error('Access revoked');
  if(!cohort||cohort.id!==session.cohort_id||cohort.status!=='live'||!cohort.programme_id)throw Error('Cohort unavailable');
  if(session.role==='staff'&&code.staff_id&&!staffAssigned)throw Error('Coach not assigned');
  if(athlete){if(session.role!=='staff'||athlete.cohort_id!==cohort.id||athlete.access_status!=='active')throw Error('Access denied');return {...athlete,kind:'athlete',parentMode:false};}
  return {...cohort,kind:'cohort',parentMode:false};
}
