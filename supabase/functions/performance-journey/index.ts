import {authorizeSchoolSession} from '../_shared/hub-service.ts';
import {SupabaseHubRepository} from '../_shared/supabase-repository.ts';
import {cryptoPort} from '../_shared/runtime.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {resolveAccountSubject,resolveSharedSubject,activeAthlete} from './authorization.mjs';
const origins=new Set(['https://duairlineseliteacademy.com','https://www.duairlineseliteacademy.com','https://hiktwkdfvlujszczthdu.supabase.co']);
const fields='id,display_name,full_name,athlete_user_id,parent_user_id,programme_id,cohort_id,current_week,access_status,access_reason,payment_status';
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const read=async(q:any)=>{const {data,error}=await q;if(error)throw error;return data;};
async function hash(token:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async request=>{
 const origin=request.headers.get('origin')||'';
 const allowed=origins.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 const headers={'Access-Control-Allow-Origin':allowed?origin:'null','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-du-session','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed)return reply(403,{error:'Request not allowed.'});
 if(request.method==='OPTIONS')return reply(200,{});
 if(request.method!=='POST')return reply(405,{error:'Method not allowed.'});
 let body:any;try{body=await request.json();}catch{return reply(400,{error:'Invalid request.'});}
 if(body.action!=='read'||(body.athleteId&&!uuid(body.athleteId)))return reply(400,{error:'Invalid request.'});
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let subject:any,roster:any[]=[],linked:any[]=[],staff=false;
  if(request.headers.has('x-du-session')){
   const token=request.headers.get('x-du-session')||'';if(token.length<16||token.length>256)return reply(401,{error:'Your Hub session has expired.'});
   const identity=await authorizeSchoolSession({token,repository:new SupabaseHubRepository(db),cryptoPort});
   const {session:s,accessCode:code,cohort}=identity;
   if(identity.staff?.access_profile==='sports_director')return reply(403,{error:'Use your School Overview for recorded activity.'});
   staff=s.role==='staff';
   if(identity.athlete){
    if(body.athleteId && body.athleteId!==identity.athlete.id)return reply(403,{error:'That athlete is not available for your access.'});
    const own=await read(db.from('athletes').select(fields).eq('id',identity.athlete.id).maybeSingle());
    if(!own)return reply(403,{error:'Athlete unavailable.'});
    subject={...own,kind:'athlete',parentMode:false};
   }else{
    if(body.athleteId&&!staff)return reply(403,{error:'Individual journeys require coach access.'});
    const athlete=body.athleteId?await read(db.from('athletes').select(fields).eq('id',body.athleteId).eq('cohort_id',s.cohort_id).eq('access_status','active').maybeSingle()):null;
    if(body.athleteId&&!athlete)return reply(403,{error:'Athlete not in your group.'});
    subject=resolveSharedSubject(s,code,cohort,athlete,true);
   }
   if(staff)roster=await read(db.from('athletes').select('id,display_name,full_name').eq('cohort_id',cohort.id).eq('access_status','active').order('display_name'))||[];
  }else{
   const token=(request.headers.get('authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1];
   if(!token)return reply(401,{error:'Sign in to view your journey.'});
   const {data,error}=await db.auth.getUser(token);if(error||!data?.user)return reply(401,{error:'Your session has expired.'});
   if(!['parent','private-athlete'].includes(body.audience))return reply(403,{error:'Access type unavailable.'});
   const field=body.audience==='parent'?'parent_user_id':'athlete_user_id';
   const athletes=await read(db.from('athletes').select(fields).eq(field,data.user.id))||[];
   subject=resolveAccountSubject(athletes,data.user.id,body.audience,body.athleteId);
   linked=athletes.filter(activeAthlete).map((a:any)=>({id:a.id,name:a.display_name||a.full_name||'Athlete'}));
  }
  const args={p_kind:subject.kind,p_id:subject.id,p_parent:subject.parentMode===true};
  const source=await read(db.rpc('performance_journey_source',args));
  if(!source)return reply(409,{error:'Your programme journey is being prepared.'});
  await read(db.rpc('refresh_performance_journey',args));
  const snapshots=await read(db.from('performance_journey_snapshots').select('id,captured_at,source').eq('subject_kind',subject.kind).eq('subject_id',subject.id).eq('parent_mode',subject.parentMode===true).eq('programme_id',source.programme.id).eq('assignment_key',source.assignment_key).order('captured_at',{ascending:false}).limit(12))||[];
  return reply(200,{source,snapshots,subjectId:subject.id,roster:roster.map(a=>({id:a.id,name:a.display_name||a.full_name||'Athlete'})),linked,group:subject.kind==='cohort',staff,parent:subject.parentMode===true});
 }catch(error){
  if(error instanceof Error&&/Access denied|Session expired|Access revoked|Cohort unavailable|Coach not assigned|Your Hub session has expired/.test(error.message))return reply(403,{error:'This journey is not available for your access.'});
  console.error('performance-journey read failed',error);
  return reply(503,{error:'Your journey is temporarily unavailable. Your training is still available.'});
 }
});
