import { inspectVideo } from '../technique-review-private/media.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const allowed=new Set(['https://duairlineseliteacademy.com','https://www.duairlineseliteacademy.com']);
const db=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(!allowed.has(origin))return new Response('Forbidden',{status:403});
 const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json','cache-control':'no-store','vary':'Origin'};
 if(req.method==='OPTIONS')return new Response('',{headers});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});

 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return reply(401,{error:'Sign in required'});
  const client=db();
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return reply(401,{error:'Invalid session'});
  const body=await req.json();
  if(body.action==='linked'){
   const {data:athletes,error}=await client.from('athletes').select('id,display_name,full_name').eq('parent_user_id',user.id).eq('athlete_type','private').eq('access_status','active').limit(20);
   if(error)throw error;
   return reply(200,{athletes:athletes||[]});
  }
  const athleteId=body.athleteId;
  if(!uuid(athleteId))return reply(400,{error:'Invalid athlete'});
  const {data:linkedAthlete,error:athleteError}=await client.from('athletes').select('id,display_name,full_name').eq('id',athleteId).eq('parent_user_id',user.id).eq('athlete_type','private').eq('access_status','active').maybeSingle();
  if(athleteError||!linkedAthlete)return reply(403,{error:'Parent access not authorized'});
  if(body.action==='context'){
   const {data:week}=await client.from('programme_weeks').select('id,week_number').eq('programme_id',(await client.from('athletes').select('programme_id').eq('id',athleteId).single()).data?.programme_id).eq('status','live').order('week_number',{ascending:false}).limit(1).maybeSingle();
   return reply(200,{weekId:week?.id||null});
  }
  if(body.action==='reserve'){
   if(!uuid(body.weekId))return reply(400,{error:'Invalid week'});
   const {data:record}=await client.from('athletes').select('programme_id').eq('id',athleteId).single();
   const {data:week}=await client.from('programme_weeks').select('id').eq('id',body.weekId).eq('programme_id',record?.programme_id).in('status',['live','completed']).maybeSingle();
   if(!week)return reply(403,{error:'Week unavailable'});
   const requestId=null;
   const {data:id,error:reservationError}=await client.rpc('reserve_technique_video_slot',{p_athlete_id:athleteId,p_programme_week_id:body.weekId,p_uploaded_by:'parent:'+user.id,p_request_id:null,p_exercise_id:null});
   if(reservationError||!id)return reply(409,{error:'Weekly limit reached or reservation failed'});
   const path=athleteId+'/'+body.weekId+'/'+id+'.mp4';
   const {data:upload,error:uploadError}=await client.storage.from('technique-review').createSignedUploadUrl(path);
   if(uploadError||!upload){await client.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',id);return reply(503,{error:'Upload unavailable'});}
   const {error:markError}=await client.from('technique_video_submissions').update({object_key:path,upload_state:'uploading'}).eq('id',id);
   if(markError)return reply(503,{error:'Upload setup failed'});
   return reply(200,{id,path,token:upload.token,maxBytes:25*1024*1024,maxSeconds:15});
  }
  if(body.action==='finalize'){
   if(!uuid(body.id))return reply(400,{error:'Invalid upload'});
   const {data:clip}=await client.from('technique_video_submissions').select('id,object_key,upload_state,reserved_until').eq('id',body.id).eq('athlete_id',athleteId).maybeSingle();
   if(!clip||clip.upload_state!=='uploading'||Date.parse(clip.reserved_until)<Date.now())return reply(409,{error:'Upload expired'});
   const {data:file,error:downloadError}=await client.storage.from('technique-review').download(clip.object_key);
   if(downloadError||!file)return reply(409,{error:'File missing'});
   let meta;
   try{if(file.size<1||file.size>25*1024*1024)throw Error('Video exceeds 25 MB');meta=inspectVideo(new Uint8Array(await file.arrayBuffer()));}
   catch(error){await client.storage.from('technique-review').remove([clip.object_key]);await client.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',clip.id);return reply(400,{error:error instanceof Error?error.message:'Invalid video'});}
   const {error:updateError}=await client.from('technique_video_submissions').update({upload_state:'ready',duration_ms:meta.durationMs,byte_size:file.size}).eq('id',clip.id).eq('upload_state','uploading');
   if(updateError)throw updateError;
   return reply(200,{ok:true,durationMs:meta.durationMs});
  }
  if(body.action==='list'){
   const {data:submissions,error}=await client.from('technique_video_submissions').select('id,exercise_id,programme_week_id,review_state,created_at').eq('athlete_id',linkedAthlete.id).eq('upload_state','ready').order('created_at',{ascending:false}).limit(30);
   if(error)throw error;
   return reply(200,{athlete:{id:linkedAthlete.id,name:linkedAthlete.display_name||linkedAthlete.full_name},submissions:submissions||[]});
  }
  if(body.action==='playback'||body.action==='feedback'){
   if(!uuid(body.id))return reply(400,{error:'Invalid video'});
   const {data:clip}=await client.from('technique_video_submissions').select('id,object_key').eq('id',body.id).eq('athlete_id',linkedAthlete.id).eq('upload_state','ready').maybeSingle();
   if(!clip)return reply(404,{error:'Video not found'});
   if(body.action==='feedback'){
    const {data:feedback,error}=await client.from('technique_video_feedback').select('positive_cue,correction,created_at').eq('submission_id',clip.id).order('created_at',{ascending:false}).limit(10);
    if(error)throw error;
    return reply(200,{feedback:feedback||[]});
   }
   if(!clip.object_key)return reply(404,{error:'Video not found'});
   const {data:signed,error}=await client.storage.from('technique-review').createSignedUrl(clip.object_key,60);
   if(error||!signed)return reply(503,{error:'Playback unavailable'});
   return reply(200,{url:signed.signedUrl,expiresInSeconds:60});
  }
  return reply(400,{error:'Unknown action'});
 }catch(error){console.error('Technique parent error',error);return reply(500,{error:'Video service unavailable'});}
});
