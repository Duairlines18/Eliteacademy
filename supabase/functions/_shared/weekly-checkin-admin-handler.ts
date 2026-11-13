import {corsHeaders} from './hub-core.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function handleWeeklyCheckinAdmin(request:Request,ports:any){
 const origin=request.headers.get('origin')||'',cors=corsHeaders(origin);
 const json=(status:number,body:any)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response('ok',{status:cors['Access-Control-Allow-Origin']?200:403,headers:cors});
 if(request.method!=='POST'||!cors['Access-Control-Allow-Origin'])return json(403,{error:'Request denied.'});
 const user=await ports.verifyUser(request);if(!user)return json(401,{error:'Sign in again.'});
 try{
  if(!await ports.repository.isCheckinAdmin(user.id))return json(403,{error:'Coach admin access required.'});
  let body;try{body=await request.json();}catch{return json(400,{error:'Invalid request.'});}
  if(body?.action==='list')return json(200,await ports.repository.checkinAdminOverview());
  if(body?.action==='release'){
   if(!uuid.test(body.holdId)||!Number.isInteger(body.generation)||body.generation<1||typeof body.note!=='string'||body.note.trim().length<3||body.note.length>1000)return json(400,{error:'A hold and review note are required.'});
   return json(200,await ports.repository.releaseWeeklyCheckinHold(user.id,body.holdId,body.generation,body.note.trim()));
  }
  if(body?.action==='review'){
   if(!uuid.test(body.feedbackId)||typeof body.note!=='string'||body.note.trim().length<3||body.note.length>1000)return json(400,{error:'Feedback and a review note are required.'});
   return json(200,await ports.repository.reviewWeeklyCheckinFeedback(body.feedbackId,body.note.trim()));
  }
  return json(400,{error:'Unsupported request.'});
 }catch(error){if(error?.code==='CHECKIN_CONFLICT')return json(409,{error:'The safety report changed. Reload and review it again.'});return json(500,{error:'Check-in review is unavailable. Try again.'});}
}
