import {corsHeaders} from './hub-core.ts';
import {ensurePrivateAthleteProfile,savePrivateAthleteOnboarding,bootstrapPrivateAthlete,savePrivateAthleteFeedback,loadPrivateAthleteHistory,loadPrivateAthleteProgrammeWeek} from './private-athlete-service.ts';

const defaults={ensurePrivateAthleteProfile,savePrivateAthleteOnboarding,bootstrapPrivateAthlete,savePrivateAthleteFeedback,loadPrivateAthleteHistory,loadPrivateAthleteProgrammeWeek};
function json(origin:string,status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(origin),'Content-Type':'application/json','Cache-Control':'no-store'}});}

export async function handlePrivateAthleteRequest(request:Request,ports:any){
  const origin=request.headers.get('origin')||'';const cors=corsHeaders(origin);
  if(request.method==='OPTIONS')return new Response('ok',{status:cors['Access-Control-Allow-Origin']?200:403,headers:cors});
  if(request.method!=='POST'||!cors['Access-Control-Allow-Origin'])return json(origin,403,{code:'REQUEST_DENIED',error:'Request not allowed.'});
  const user=await ports.verifyUser(request);
  if(!user)return json(origin,401,{code:'SESSION_EXPIRED',error:'Your session has expired. Please sign in again.'});
  let body:any;try{body=await request.json();}catch{return json(origin,400,{code:'INVALID_REQUEST',error:'Invalid request.'});}
  const services=ports.services||defaults;
  try{
    let result;
    if(body?.action==='profile')result=await services.ensurePrivateAthleteProfile({user,repository:ports.repository});
    else if(body?.action==='save-onboarding')result=await services.savePrivateAthleteOnboarding({user,input:body.profile,repository:ports.repository});
    else if(body?.action==='bootstrap')result=await services.bootstrapPrivateAthlete({user,repository:ports.repository});
    else if(body?.action==='save-feedback')result=await services.savePrivateAthleteFeedback({user,input:body.feedback,feedbackType:body.feedbackType,repository:ports.repository});
    else if(body?.action==='history')result=await services.loadPrivateAthleteHistory({user,weekNumber:Number(body.weekNumber),repository:ports.repository});
    else if(body?.action==='programme-week')result=await services.loadPrivateAthleteProgrammeWeek({user,weekNumber:Number(body.weekNumber),repository:ports.repository});
    else return json(origin,400,{code:'UNSUPPORTED_ACTION',error:'Unsupported request.'});
    return json(origin,200,result);
  }catch(error){
    const code=typeof error?.code==='string'?error.code:'';
    if(error instanceof Error&&(error.message==='Invalid private athlete onboarding information.'||error.message==='Invalid feedback information.'))return json(origin,400,{code:'INVALID_PROFILE',error:error.message});
    if(code==='PENDING_ACTIVATION'||code==='ACCESS_PAUSED')return json(origin,403,{code,error:error.message});
    if(code==='NO_ASSIGNMENT'||code==='PROGRAMME_PENDING'||code==='HISTORY_NOT_FOUND'||code==='WEEK_NOT_AVAILABLE')return json(origin,409,{code,error:error.message});
    return json(origin,500,{code:'SERVER_ERROR',error:'The Private Athlete Hub is temporarily unavailable.'});
  }
}

