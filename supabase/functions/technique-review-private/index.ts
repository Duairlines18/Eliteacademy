import { createClient } from 'npm:@supabase/supabase-js@2';
import { inspectVideo } from './media.ts';

const MAX=25*1024*1024,BUCKET='technique-review';
const ORIGINS=new Set(['https://duairlineseliteacademy.com','https://www.duairlineseliteacademy.com']);
const client=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status});};
Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  if(!ORIGINS.has(origin))return new Response('Forbidden',{status:403});
  const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json','cache-control':'no-store','vary':'Origin'};
  if(request.method==='OPTIONS')return new Response('',{headers});
  const reply=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  if(Deno.env.get('TECHNIQUE_REVIEW_ENABLED')!=='true')return reply(404,{error:'Feature unavailable'});
  try{
    const jwt=request.headers.get('authorization')?.replace(/^Bearer /,'');
    if(!jwt)fail('Sign in required',401);
    const db=client();
    const {data:{user},error:authError}=await db.auth.getUser(jwt);
    if(authError||!user)fail('Invalid session',401);
    const {data:athlete,error:ae}=await db.from('athletes').select('id,programme_id,access_status').eq('athlete_user_id',user.id).eq('athlete_type','private').maybeSingle();
    if(ae||!athlete||athlete.access_status!=='active')fail('Athlete not authorized',403);
    const body=await request.json();
    if(body.action==='list'){
      const {data:requests,error:re}=await db.from('technique_video_requests').select('id,programme_week_id,exercise_id,instruction_override,status').eq('athlete_id',athlete.id).order('created_at',{ascending:false}).limit(30);
      if(re)throw re;
      const {data:submissions,error:se}=await db.from('technique_video_submissions').select('id,request_id,programme_week_id,exercise_id,review_state,created_at').eq('athlete_id',athlete.id).eq('upload_state','ready').limit(30);
      if(se)throw se;
      return reply(200,{requests,submissions});
    }
    if(body.action==='reserve'){
      if(!uuid(body.weekId)||!uuid(body.exerciseId))fail('Invalid week or exercise');
      const {data:week}=await db.from('programme_weeks').select('id,status').eq('id',body.weekId).eq('programme_id',athlete.programme_id).maybeSingle();
      if(!week||week.status!=='live')fail('Week unavailable',403);
      const {data:exercise}=await db.from('exercises').select('id').eq('id',body.exerciseId).eq('active',true).maybeSingle();
      if(!exercise)fail('Exercise unavailable');
      const requestId=body.requestId||null;
      if(requestId){
        if(!uuid(requestId))fail('Invalid request');
        const {data:requested}=await db.from('technique_video_requests').select('exercise_id').eq('id',requestId).eq('athlete_id',athlete.id).eq('programme_week_id',body.weekId).eq('status','open').maybeSingle();
        if(!requested||requested.exercise_id!==body.exerciseId)fail('Request mismatch',403);
      }
      const {data:id,error:reservationError}=await db.rpc('reserve_technique_video_slot',{p_athlete_id:athlete.id,p_programme_week_id:body.weekId,p_uploaded_by:'athlete:'+user.id,p_request_id:requestId,p_exercise_id:body.exerciseId});
      if(reservationError||!id)fail('Weekly limit reached or reservation failed',409);
      const path=athlete.id+'/'+body.weekId+'/'+id+'.mp4';
      const {data:upload,error:uploadError}=await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if(uploadError||!upload){
        await db.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',id);
        fail('Upload unavailable',503);
      }
      const {error:markError}=await db.from('technique_video_submissions').update({object_key:path,upload_state:'uploading'}).eq('id',id);
      if(markError)fail('Upload setup failed',503);
      return reply(200,{id,path,token:upload.token,maxBytes:MAX,maxSeconds:15});
    }
    if(body.action==='finalize'){
      if(!uuid(body.id))fail('Invalid upload');
      const {data:clip}=await db.from('technique_video_submissions').select('id,object_key,upload_state,reserved_until').eq('id',body.id).eq('athlete_id',athlete.id).maybeSingle();
      if(!clip||clip.upload_state!=='uploading'||Date.parse(clip.reserved_until)<Date.now())fail('Upload expired',409);
      const {data:file,error:fe}=await db.storage.from(BUCKET).download(clip.object_key);
      if(fe||!file)fail('File missing',409);
      let meta;
      try{
        if(file.size<1||file.size>MAX)throw Error('Video exceeds 25 MB');
        meta=inspectVideo(new Uint8Array(await file.arrayBuffer()));
      }catch(e){
        await db.storage.from(BUCKET).remove([clip.object_key]);
        await db.from('technique_video_submissions').update({upload_state:'failed'}).eq('id',clip.id);
        fail(e instanceof Error?e.message:'Invalid video');
      }
      const {error:ue}=await db.from('technique_video_submissions').update({upload_state:'ready',duration_ms:meta.durationMs,byte_size:file.size}).eq('id',clip.id).eq('upload_state','uploading');
      if(ue)throw ue;
      return reply(200,{ok:true,durationMs:meta.durationMs});
    }
    fail('Unknown action');
  }catch(e){
    const status=e instanceof Error&&'status'in e?Number((e as {status:number}).status):500;
    if(status===500)console.error('Technique review error',e);
    return reply(status,{error:status===500?'Video service unavailable':e instanceof Error?e.message:'Invalid request'});
  }
});
