import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeSchoolCoach } from './authorize.ts';
import { inspectVideo } from '../technique-review-private/media.ts';
const MAX=25*1024*1024,BUCKET='technique-review';
const allowed=new Set(['https://duairlineseliteacademy.com','https://www.duairlineseliteacademy.com']);
const db=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(!allowed.has(origin))return new Response('Forbidden',{status:403});
 const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,apikey,x-du-session','content-type':'application/json','cache-control':'no-store'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 if(Deno.env.get('TECHNIQUE_REVIEW_ENABLED')!=='true')return reply(404,{error:'Feature disabled'});
 try {
  const client=db(), token=req.headers.get('x-du-session')||'',body=await req.json();
  const scoped=await authorizeSchoolCoach(client,token,['athletes','context'].includes(body.action)?undefined:body.athleteId);
  const {cohort,athlete,session}=scoped;
  if(body.action==='context'){
   const {data:week}=await client.from('programme_weeks').select('id').eq('programme_id',cohort.programme_id).eq('week_number',body.weekNumber).eq('status','live').maybeSingle();
   return reply(200,{weekId:week?.id||null});
  }
  if(body.action==='context'){
   const {data:week,error}=await client.from('programme_weeks').select('id,week_number').eq('programme_id',cohort.programme_id).eq('status','live').order('week_number',{ascending:false}).limit(1).maybeSingle();
   if(error||!week)return reply(409,{error:'No live programme week'});
   return reply(200,{weekId:week.id,weekNumber:week.week_number});
  }
  if(body.action==='athletes'){
   const {data,error}=await client.from('athletes').select('id,display_name,full_name').eq('cohort_id',cohort.id).eq('access_status','active').limit(100);
   if(error)throw error;
   return reply(200,{athletes:data||[]});
  }
  if(!athlete)return reply(403,{error:'Select an assigned athlete'});
  if(body.action==='list'){
   const {data,error}=await client.from('technique_video_requests').select('id,programme_week_id,exercise_id,instruction_override,status').eq('athlete_id',athlete.id).limit(40);
   if(error)throw error;
   return reply(200,{requests:data||[]});
  }
  if(body.action==='reserve'){
   const {data:week}=await client.from('programme_weeks').select('id').eq('id',body.weekId).eq('programme_id',cohort.programme_id).eq('status','live').maybeSingle();
   const {data:exercise}=await client.from('exercises').select('id').eq('id',body.exerciseId).eq('active',true).maybeSingle();
   if(!week||!exercise)return reply(403,{error:'Week or exercise unavailable'});
   if(body.requestId){
    const {data:requested}=await client.from('technique_video_requests').select('id,exercise_id').eq('id',body.requestId).eq('athlete_id',athlete.id).eq('programme_week_id',week.id).eq('status','open').maybeSingle();
    if(!requested||requested.exercise_id!==exercise.id)return reply(403,{error:'Video request mismatch'});
   }
   const {data:id,error:reservationError}=await client.rpc('reserve_technique_video_slot',{p_athlete_id:athlete.id,p_programme_week_id:week.id,p_uploaded_by:'school-coach:'+session.id,p_request_id:body.requestId||null,p_exercise_id:exercise.id});
   if(reservationError||!id)return reply(409,{error:'Weekly clip limit reached or reservation unavailable'});
   const path=athlete.id+'/'+week.id+'/'+id+'.mp4';
   const {data:upload,error:uploadError}=await client.storage.from(BUCKET).createSignedUploadUrl(path);
   if(uploadError||!upload){
    await client.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',id);
    return reply(503,{error:'Video storage unavailable'});
   }
   const {error:markError}=await client.from('technique_video_submissions').update({object_key:path,upload_state:'uploading'}).eq('id',id);
   if(markError)return reply(503,{error:'Upload setup unavailable'});
   return reply(200,{id,path,token:upload.token,maxBytes:MAX,maxSeconds:15});
  }
  if(body.action==='finalize'){
   const {data:clip}=await client.from('technique_video_submissions').select('id,object_key,upload_state,reserved_until').eq('id',body.id).eq('athlete_id',athlete.id).maybeSingle();
   if(!clip||clip.upload_state!=='uploading'||Date.parse(clip.reserved_until)<=Date.now())return reply(409,{error:'Upload expired'});
   const {data:file,error:downloadError}=await client.storage.from(BUCKET).download(clip.object_key);
   if(downloadError||!file)return reply(409,{error:'Upload missing'});
   let durationMs:number;
   try {
    if(file.size<1||file.size>MAX)throw Error('Maximum video size is 25 MB');
    durationMs=inspectVideo(new Uint8Array(await file.arrayBuffer())).durationMs;
   } catch(e){
    await client.storage.from(BUCKET).remove([clip.object_key]);
    await client.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',clip.id);
    return reply(400,{error:e instanceof Error?e.message:'Invalid video'});
   }
   const {error:saveError}=await client.from('technique_video_submissions').update({upload_state:'ready',duration_ms:durationMs,byte_size:file.size}).eq('id',clip.id).eq('upload_state','uploading');
   if(saveError)throw saveError;
   return reply(200,{ok:true,durationMs});
  }
  if(body.action==='playback'){
   const {data:clip}=await client.from('technique_video_submissions').select('object_key').eq('id',body.id).eq('athlete_id',athlete.id).eq('upload_state','ready').maybeSingle();
   if(!clip?.object_key)return reply(404,{error:'Video unavailable'});
   const {data:signed,error}=await client.storage.from(BUCKET).createSignedUrl(clip.object_key,60);
   if(error||!signed)return reply(503,{error:'Playback unavailable'});
   return reply(200,{url:signed.signedUrl,expiresInSeconds:60});
  }
  return reply(400,{error:'Unknown action'});
 }catch(e){
  console.error('Technique staff error',e);
  return reply(403,{error:'School code access or video request unavailable'});
 }
});
