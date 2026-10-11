import { createClient } from 'npm:@supabase/supabase-js@2';

// Protected server-side admin operation. No browser keys beyond normal user JWT.
// Deploy only after the matching migration and the authenticated QA suite pass.
const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const adminIds = new Set((Deno.env.get('DU_ADMIN_USER_IDS') || '').split(',').map(x=>x.trim()).filter(Boolean));
const db = createClient(url, serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
const json = (status:number,data:unknown)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
Deno.serve(async req=>{
  if(req.method!=='POST')return json(405,{code:'METHOD_NOT_ALLOWED'});
  if(!url||!serviceKey||!adminIds.size)return json(503,{code:'ADMIN_NOT_CONFIGURED'});
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return json(401,{code:'LOGIN_REQUIRED'});
  const {data:{user},error:authError}=await db.auth.getUser(bearer.slice(7));
  if(authError||!user)return json(401,{code:'INVALID_SESSION'});
  if(!adminIds.has(user.id))return json(403,{code:'ADMIN_REQUIRED'});
  let body:any;
  try {body=await req.json();}catch{return json(400,{code:'INVALID_JSON'});}
  const {action,athleteId,programmeId,weekNumber,blockId}=body||{};
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(![athleteId,programmeId,blockId].every(x=>typeof x==='string'&&uuid.test(x))
    ||!Number.isInteger(weekNumber)||weekNumber<1)
    return json(400,{code:'EXACT_IDS_REQUIRED'});
  if(action!=='preview'&&action!=='update-block')return json(400,{code:'UNSUPPORTED_ACTION'});
  // Verify target and preview using the same IDs the write will require.
  const {data:athlete,error:ae}=await db.from('athletes')
    .select('id,full_name,athlete_type,programme_id,cohort_id,current_week,access_status')
    .eq('id',athleteId).maybeSingle();
  if(ae)return json(500,{code:'ATHLETE_LOOKUP_FAILED'});
  if(!athlete)return json(404,{code:'ATHLETE_NOT_FOUND'});
  const {data:cohort}=athlete.cohort_id
    ? await db.from('cohorts').select('id,programme_id,current_week,status').eq('id',athlete.cohort_id).maybeSingle()
    : {data:null};
  if(athlete.access_status!=='active')return json(409,{code:'ATHLETE_NOT_ACTIVE'});
  if((athlete.athlete_type==='private'&&athlete.programme_id)
    ? athlete.programme_id!==programmeId
    : cohort?.programme_id!==programmeId||cohort?.status!=='live')
    return json(409,{code:'TARGET_PROGRAMME_MISMATCH'});
  const {data:programme,error:pe}=await db.from('programmes').select('id,status').eq('id',programmeId).maybeSingle();
  if(pe||programme?.status!=='live')return json(409,{code:'PROGRAMME_NOT_LIVE'});
  const currentWeek=(athlete.athlete_type==='private'&&athlete.programme_id)?athlete.current_week:cohort?.current_week;
  if(currentWeek!==weekNumber)return json(409,{code:'NOT_CURRENT_WEEK'});
  const {data:week,error:we}=await db.from('programme_weeks')
    .select('id,programme_id,week_number,status,verification_status,published_at')
    .eq('programme_id',programmeId).eq('week_number',weekNumber).is('tier_id',null)
    .in('status',['live','completed']).eq('verification_status','verified')
    .not('published_at','is',null).maybeSingle();
  if(we||!week)return json(409,{code:'WEEK_NOT_PUBLISHED'});
  const {data:days}=await db.from('training_days').select('id').eq('programme_week_id',week.id);
  const dayIds=(days||[]).map(d=>d.id);
  if(!dayIds.length)return json(409,{code:'NO_TRAINING_DAYS'});
  const {data:block,error:be}=await db.from('session_blocks')
    .select('id,training_day_id,title,content').eq('id',blockId).in('training_day_id',dayIds).maybeSingle();
  if(be||!block)return json(404,{code:'BLOCK_NOT_IN_TARGET_WEEK'});
  const {data:direct}=await db.from('athletes').select('id').eq('programme_id',programmeId).neq('id',athleteId);
  const {data:cohorts}=await db.from('cohorts').select('id').eq('programme_id',programmeId);
  const {data:viaCohort}=cohorts?.length
    ? await db.from('athletes').select('id').in('cohort_id',cohorts.map(c=>c.id)).neq('id',athleteId)
    : {data:[]};
  const otherRecipients=new Set([...(direct||[]),...(viaCohort||[])].map(x=>x.id)).size;
  if(action==='preview')return json(200,{
    status:'PREVIEW_ONLY',athleteId,athleteName:athlete.full_name,
    programmeId,weekNumber,blockId,blockTitle:block.title,
    currentContent:block.content,otherRecipients,
    warning:otherRecipients?'This programme is shared; changes affect other recipients.':null
  });
  if(!body.confirmTarget||body.confirmTarget!==athleteId)
    return json(409,{code:'TARGET_CONFIRMATION_REQUIRED'});
  if(otherRecipients&&!body.confirmShared)return json(409,{code:'SHARED_PROGRAMME_CONFIRMATION_REQUIRED'});
  if(!Object.hasOwn(body,'expectedContent'))return json(409,{code:'PREVIEW_REQUIRED'});
  if(!body.content||typeof body.content!=='object'||Array.isArray(body.content))
    return json(400,{code:'CONTENT_OBJECT_REQUIRED'});
  const {data:result,error:writeError}=await db.rpc('admin_update_workout_block',{
    p_athlete_id:athleteId,p_programme_id:programmeId,p_week_number:weekNumber,
    p_block_id:blockId,p_content:body.content,p_expected_content:body.expectedContent,p_allow_shared:body.confirmShared===true
  });
  if(writeError)return json(409,{code:'WRITE_REJECTED',message:writeError.message});
  return json(200,result);
});
