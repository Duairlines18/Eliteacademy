// Technique Review integration bridge for the existing academy screens.
// Existing school-code login is unchanged. Call this only after the relevant
// role screen is mounted and its existing auth/session state is available.
import { mountSchoolTechniqueReview } from './technique-review-school-ui.js';
import { mountTechniqueReview } from './technique-review-ui.js';
import { mountTechniqueReviewAdmin } from './technique-review-admin-ui.js';
import { mountParentTechniqueReview } from './technique-review-parent-ui.js';

export async function attachTechniqueReview({role,root,supabase,sessionToken,jwt,weekId,exercises=[],athletes=[],programmeWeeks=[],athleteId,enabled=false}) {
 if(!enabled)return null;
 if(!root||!supabase)throw Error('Technique Review dependencies unavailable');
 const url=supabase.supabaseUrl||supabase.url;
 const key=supabase.supabaseKey||supabase.key;
 if(!url||!key)throw Error('Missing Supabase connection');
 const slug=role==='staff'?'technique-review-staff':role==='admin'?'technique-review-admin':role==='parent'?'technique-review-parent':'technique-review-private';
 const api=async(action,payload={})=>{
  const headers={'content-type':'application/json','apikey':key};
  if(role==='staff'){
   if(!sessionToken)throw Error('School code session required');
   headers['x-du-session']=sessionToken;
  }else{
   if(!jwt)throw Error('Authenticated session required');
   headers.authorization='Bearer '+jwt;
  }
  const response=await fetch(url+'/functions/v1/'+slug,{method:'POST',headers,body:JSON.stringify({action,...payload})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Technique Review unavailable');
  return data;
 };
 if((role==='staff'||role==='athlete')&&!weekId){const context=await api('context',{});weekId=context.weekId;}
 const uploadSigned=async({path,token,file})=>{
  const {error}=await supabase.storage.from('technique-review').uploadToSignedUrl(path,token,file,{contentType:file.type||'video/mp4'});
  if(error)throw error;
 };
 if(role==='staff')return mountSchoolTechniqueReview({root,api,weekId,exercises,uploadSigned});
 if(role==='parent')return mountParentTechniqueReview({root,api,athleteId,exercises,uploadSigned});
 if(role==='admin')return mountTechniqueReviewAdmin({root,api,athletes,programmeWeeks,exercises});
 if(role==='athlete')return mountTechniqueReview({root,api,weekId,exercises,uploadSigned});
 return null;
}
