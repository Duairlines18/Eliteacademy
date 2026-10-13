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
 if(Deno.env.get('TECHNIQUE_REVIEW_ENABLED')!=='true')return reply(404,{error:'Feature disabled'});
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return reply(401,{error:'Sign in required'});
  const client=db();
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return reply(401,{error:'Invalid session'});
  const body=await req.json();
  const athleteId=body.athleteId;
  if(!uuid(athleteId))return reply(400,{error:'Invalid athlete'});
  const {data:athlete,error:athleteError}=await client.from('athletes').select('id,display_name,full_name').eq('id',athleteId).eq('parent_user_id',user.id).eq('athlete_type','private').eq('access_status','active').maybeSingle();
  if(athleteError||!athlete)return reply(403,{error:'Parent access not authorized'});
  if(body.action==='list'){
   const {data:submissions,error}=await client.from('technique_video_submissions').select('id,exercise_id,programme_week_id,review_state,created_at').eq('athlete_id',athlete.id).eq('upload_state','ready').order('created_at',{ascending:false}).limit(30);
   if(error)throw error;
   return reply(200,{athlete:{id:athlete.id,name:athlete.display_name||athlete.full_name},submissions:submissions||[]});
  }
  if(body.action==='playback'||body.action==='feedback'){
   if(!uuid(body.id))return reply(400,{error:'Invalid video'});
   const {data:clip}=await client.from('technique_video_submissions').select('id,object_key').eq('id',body.id).eq('athlete_id',athlete.id).eq('upload_state','ready').maybeSingle();
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
  return reply(400,{error:'Read-only parent actions only'});
 }catch(error){console.error('Technique parent error',error);return reply(500,{error:'Video service unavailable'});}
});
