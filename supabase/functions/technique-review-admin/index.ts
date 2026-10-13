import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGINS=new Set(['https://duairlineseliteacademy.com','https://www.duairlineseliteacademy.com']);
const validId=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const db=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
 const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json','cache-control':'no-store'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 if(Deno.env.get('TECHNIQUE_REVIEW_ENABLED')!=='true')return reply(404,{error:'Feature unavailable'});
 try{
  const jwt=req.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!jwt)return reply(401,{error:'Sign in required'});
  const client=db();
  const {data:{user},error:authError}=await client.auth.getUser(jwt);
  if(authError||!user)return reply(401,{error:'Invalid session'});
  const {data:admin,error:adminError}=await client.from('admin_profiles').select('user_id').eq('user_id',user.id).maybeSingle();
  if(adminError||!admin)return reply(403,{error:'Admin permission required'});
  const body=await req.json();
  if(body.action==='queue'){
   const {data,error}=await client.from('technique_video_submissions').select('id,athlete_id,programme_week_id,exercise_id,review_state,created_at,duration_ms').eq('upload_state','ready').order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   return reply(200,{submissions:data});
  }
  if(body.action==='request'){
   if(!validId(body.athleteId)||!validId(body.weekId)||!validId(body.exerciseId))return reply(400,{error:'Invalid assignment'});
   const {data:athlete}=await client.from('athletes').select('id,programme_id,cohort_id').eq('id',body.athleteId).maybeSingle();
   if(!athlete)return reply(404,{error:'Athlete unavailable'});
   let programmeId=athlete.programme_id;
   if(!programmeId&&athlete.cohort_id){
    const {data:cohort}=await client.from('cohorts').select('programme_id').eq('id',athlete.cohort_id).maybeSingle();
    programmeId=cohort?.programme_id;
   }
   if(!programmeId)return reply(409,{error:'Assign athlete to a programme first'});
   const {data:week}=await client.from('programme_weeks').select('id').eq('id',body.weekId).eq('programme_id',programmeId).eq('status','live').maybeSingle();
   if(!week)return reply(403,{error:'Week unavailable'});
   const {data:exercise}=await client.from('exercises').select('id').eq('id',body.exerciseId).eq('active',true).maybeSingle();
   if(!exercise)return reply(400,{error:'Exercise unavailable'});
   const instruction=typeof body.instructions==='string'?body.instructions.trim().slice(0,500):null;
   const {data,error}=await client.from('technique_video_requests').insert({athlete_id:athlete.id,programme_week_id:week.id,exercise_id:exercise.id,instruction_override:instruction||null,requested_by:'admin:'+user.id}).select('id').single();
   if(error)throw error;
   return reply(200,{requestId:data.id});
  }
  if(body.action==='playback'){
   if(!validId(body.id))return reply(400,{error:'Invalid video'});
   const {data:clip}=await client.from('technique_video_submissions').select('object_key').eq('id',body.id).eq('upload_state','ready').maybeSingle();
   if(!clip?.object_key)return reply(404,{error:'Video unavailable'});
   const {data:signed,error}=await client.storage.from('technique-review').createSignedUrl(clip.object_key,60);
   if(error||!signed)return reply(503,{error:'Playback unavailable'});
   return reply(200,{url:signed.signedUrl,expiresInSeconds:60});
  }
  if(body.action==='review'){
   if(!validId(body.id)||typeof body.correction!=='string'||!body.correction.trim()||body.correction.length>1000)return reply(400,{error:'Invalid feedback'});
   const {data:clip}=await client.from('technique_video_submissions').select('id').eq('id',body.id).eq('upload_state','ready').maybeSingle();
   if(!clip)return reply(404,{error:'Video unavailable'});
   const positive=typeof body.positiveCue==='string'?body.positiveCue.trim().slice(0,500):null;
   const {error:insertError}=await client.from('technique_video_feedback').insert({submission_id:clip.id,reviewer:'admin:'+user.id,correction:body.correction.trim(),positive_cue:positive});
   if(insertError)throw insertError;
   const {error:updateError}=await client.from('technique_video_submissions').update({review_state:'reviewed',reviewed_at:new Date().toISOString()}).eq('id',clip.id);
   if(updateError)throw updateError;
   return reply(200,{ok:true});
  }
  return reply(400,{error:'Unknown action'});
 }catch(e){console.error('Technique review admin error',e);return reply(500,{error:'Video service unavailable'});}
});
