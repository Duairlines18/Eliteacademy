import {readSchoolAttendance,saveSchoolAttendance} from '../functions/_shared/school-attendance.ts';
// Local rendered-UI integration fixture. Uses real school auth service code with
// synthetic in-memory records. This is NOT production-equivalent Supabase QA.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {exchangeAccessCode,bootstrapHub,authorizeSchoolSession,logoutSchoolSession} from '../functions/_shared/hub-service.ts';
import {schoolCompletionContext} from '../functions/_shared/school-completion.ts';
const root=process.cwd(),sessions=new Map(),completions=new Map(),codes=new Map(),attendance=new Map();
const cryptoPort={sha256:async value=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex'),randomToken:()=>Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('hex')};
const cohort={id:'fixture-school',name:'St. George’s — LOCAL TEST FIXTURE',organization_id:'fixture-org',programme_id:'fixture-programme',status:'live',current_week:1};
const athletes=Array.from({length:6},(_,i)=>({id:'fixture-athlete-'+(i+1),display_name:'St. George’s Athlete 0'+(i+1),athlete_type:'school',organization_id:'fixture-org',cohort_id:cohort.id,access_status:'active',form_tier:null,onboarding_data:{testing_placeholder:true}}));
const director={id:'fixture-director',display_name:'Mr Chivandire',access_status:'active',access_profile:'sports_director'};
const staff={id:'fixture-coach',display_name:'Coach Dube',access_status:'active'};
const exercise={id:'fixture-march',code:'SPR01',name:'A-March',categories:['warm-up','sprint-mechanics'],video_id:'4lQsMyKRRn8',video_url:'https://www.youtube.com/shorts/4lQsMyKRRn8',active:true};
const bundle={cohort,programme:{id:cohort.programme_id,name:'LOCAL TEST — School foundations',duration_weeks:4,sport:'School Performance'},week:{week_number:1,status:'live',verification_status:'verified',published_at:'2026-10-24T00:00:00Z',weekly_objective:'Synthetic browser test only.'},trainingDays:[{id:'fixture-day-1',day_key:'Day 1',title:'Movement foundations',duration:'60 minutes',sort_order:1},{id:'fixture-day-2',day_key:'Day 2',title:'Capacity and control',duration:'60 minutes',sort_order:2},{id:'fixture-day-3',day_key:'Day 3',title:'Optional Recovery',duration:'20 minutes',sort_order:3},{id:'fixture-routine',day_key:'Warm-Up Routine',title:'ASIM Warm-Up',sort_order:2}],blocks:[{training_day_id:'fixture-day-1',title:'Movement',sort_order:1,content:{prescriptions:[{exerciseCode:'SPR01',dosage:'1 × 20 m',rest:'Walk-back recovery',cues:'Stay tall; controlled rhythm.'}]}},{training_day_id:'fixture-routine',title:'ASIM Warm-Up',sort_order:1,content:{prescriptions:[{exerciseCode:'SPR01',dosage:'1 × 20 m',rest:'Walk-back recovery',cues:'Stay tall; controlled rhythm.'}]}}],exercises:[exercise]};
// Additional synthetic Day 2 coverage for collapsed warm-up print/export.
bundle.blocks.push({training_day_id:'fixture-day-2',title:'Warm-up',sort_order:0,content:{prescriptions:[{exerciseCode:'SPR01',dosage:'2 × 8',rest:'30 seconds',cues:'Move smoothly.'}]}},
 {training_day_id:'fixture-day-2',title:'Plyometric skills',sort_order:1,content:{prescriptions:[{exerciseCode:'SPR01',dosage:'3 × 3',rest:'60 seconds',cues:'Stay balanced.'}]}});
const repo={findAccessCode:async h=>codes.get(h),findAccessCodeById:async id=>[...codes.values()].find(c=>c.id===id),findCohort:async()=>cohort,findSchoolAthlete:async id=>athletes.find(a=>a.id===id),findSchoolStaff:async id=>id===director.id?director:staff,schoolCompletionSummary:async()=>athletes.map(a=>({athleteId:a.id,recordedItems:(completions.get(`athlete_${a.id}`)||new Map()).size})),isStaffAssigned:async()=>true,listSchoolRoster:async()=>athletes,findSession:async h=>sessions.get(h),createSession:async row=>sessions.set(row.token_hash,{...row,id:row.token_hash}),touchSession:async()=>{},touchCode:async()=>{},revokeSession:async(id,at)=>{sessions.get(id).revoked_at=at;},loadCurrentProgramme:async()=>bundle};
repo.attendanceProgramme=async()=>bundle.programme;
repo.readSchoolAttendance=async(c,p,w)=>[...attendance.values()].filter(e=>e.cohort_id===c&&e.programme_id===p&&e.week_number===w);
repo.saveSchoolAttendance=async rows=>{for(const e of rows)attendance.set([e.week_number,e.athlete_id,e.session_number].join('|'),e);};
const logins=new Map();
for(const slot of ['01','02','03','04','05','06','staff','director']){
 const raw='synthetic-browser-fixture-'+slot,role=['staff','director'].includes(slot)?'staff':'athlete';
 codes.set(await cryptoPort.sha256(raw),{id:'fixture-code-'+slot,code_type:role==='staff'?'staff':'cohort',cohort_id:cohort.id,athlete_id:role==='athlete'?athletes[Number(slot)-1].id:null,staff_id:role==='staff'?(slot==='director'?director.id:staff.id):null,status:'active'});
 logins.set(slot,await exchangeAccessCode({code:raw,view:role,repository:repo,cryptoPort}));
}
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/functions/v1/')){
   const body=JSON.parse(await new Promise(resolve=>{let s='';req.on('data',b=>s+=b);req.on('end',()=>resolve(s||'{}'));}));
   const args={token:req.headers['x-du-session'],repository:repo,cryptoPort};
   if(url.pathname.endsWith('/hub-data')&&body.action==='attendance-read')return json(res,200,await readSchoolAttendance({...args,weekNumber:body.weekNumber}));
   if(url.pathname.endsWith('/hub-data')&&body.action==='attendance-save')return json(res,200,await saveSchoolAttendance({...args,weekNumber:body.weekNumber,entries:body.entries}));
   if(url.pathname.endsWith('/hub-data'))return json(res,200,body.action==='logout'?await logoutSchoolSession(args):await bootstrapHub(args));
   const identity=await authorizeSchoolSession(args);
   if(url.pathname.endsWith('/workout-completions')){
    if(body.action==='library')return json(res,200,{exercises:[{...exercise,title:exercise.name,videoId:exercise.video_id,videoUrl:exercise.video_url,category:exercise.categories}]});
    const ctx=schoolCompletionContext(identity,req.headers['x-du-viewer']);if(ctx.denied)return json(res,403,{error:'Not permitted'});
    const rows=completions.get(ctx.viewerKey)||new Map();completions.set(ctx.viewerKey,rows);
    if(body.action==='set'){const row={sessionKey:body.sessionKey,itemKey:body.itemKey,completed:body.completed};rows.set(body.sessionKey+'|'+body.itemKey,row);return json(res,200,{completion:row});}
    return json(res,200,{completions:[...rows.values()]});
   }
   if(url.pathname.endsWith('/school-technique-review'))return json(res,200,{clips:[]});
   return json(res,503,{error:'Not included in local fixture'});
  }
  if(/^\/qa\/(01|02|03|04|05|06|staff|director)$/.test(url.pathname)){
   const slot=url.pathname.split('/').pop(),login=logins.get(slot);
   // Test-only session seed; no production credentials, profiles or programme data.
   const init=`<script>localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify(${JSON.stringify(login)}));const originalFetch=window.fetch;window.fetch=function(input,init){const u=typeof input==='string'?input:input.url;return originalFetch(u.includes('/functions/v1/')?'/functions/v1/'+u.split('/functions/v1/')[1]:input,init);};</script>`;
   const html=await fs.readFile(path.join(root,'index.html'),'utf8');res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html.replace('<head>','<head>'+init));return;
  }
  const name=path.resolve(root,'.'+url.pathname);if(!name.startsWith(root+path.sep))throw Error('not found');
  const data=await fs.readFile(name);res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});res.end(data);
 }catch(error){json(res,error.status||401,{error:error.message||'Fixture unavailable'});}
});
server.listen(Number(process.env.DU_SCHOOL_QA_PORT||4173),'0.0.0.0',()=>console.log('Synthetic school browser fixture listening on port 4173. No production writes.'));
