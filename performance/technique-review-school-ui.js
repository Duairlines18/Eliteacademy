/* School Coach Training Sheet Technique Review adapter.
   Receives the current x-du-session token from the EXISTING school login.
   Mount only in staff training-sheet view; no separate authentication.
   The backend verifies staff session, access code, cohort and athlete again. */
export function mountSchoolTechniqueReview({root,api,weekId,exercises,uploadSigned}) {
 if(!root||typeof api!=='function'||typeof uploadSigned!=='function')throw Error('Missing Technique Review integration');
 const section=document.createElement('section');section.setAttribute('aria-label','School Technique Review');
 const title=document.createElement('h3');title.textContent='Technique Review';
 const message=document.createElement('p');message.setAttribute('role','status');
 const select=document.createElement('select');select.setAttribute('aria-label','Select school athlete');
 const requests=document.createElement('div');
 section.append(title,select,message,requests);root.append(section);
 let athletes=[];
 async function load(){
  message.textContent='Loading assigned athletes…';
  try{
   const response=await api('athletes',{});
   athletes=response.athletes||[];
   select.replaceChildren();
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose athlete';select.append(placeholder);
   for(const athlete of athletes){const option=document.createElement('option');option.value=athlete.id;option.textContent=athlete.display_name||athlete.full_name||'Athlete';select.append(option);}
   message.textContent=athletes.length?'Select an athlete to view coach-requested clips.':'No athletes assigned to this school cohort.';
  }catch(e){message.textContent=e instanceof Error?e.message:'Unable to load school athletes';}
 }
 select.onchange=async()=>{
  requests.replaceChildren();
  if(!select.value)return;
  message.textContent='Loading video requests…';
  try{
   const {requests:items=[]}=await api('list',{athleteId:select.value});
   const open=items.filter(x=>x.status==='open'&&(!weekId||x.programme_week_id===weekId));
   message.textContent=open.length?'Videos are limited to 15 seconds and three per athlete per week.':'No video requested for this athlete this week.';
   for(const request of open){
    const exercise=exercises.find(x=>x.id===request.exercise_id);
    const card=document.createElement('article');
    const heading=document.createElement('strong');heading.textContent=exercise?.name||'Technique video';
    const cue=document.createElement('p');cue.textContent=request.instruction_override||'Keep the camera steady, with the athlete’s full body and landing visible.';
    const file=document.createElement('input');file.type='file';file.accept='video/mp4,video/quicktime';file.setAttribute('aria-label','Choose technique video');
    const button=document.createElement('button');button.type='button';button.textContent='Upload for Coach Du';
    button.onclick=async()=>{
     const clip=file.files?.[0];if(!clip)return;
     if(clip.size>25*1024*1024){message.textContent='Maximum file size is 25 MB';return;}
     button.disabled=true;
     try{
      message.textContent='Preparing private upload…';
      const slot=await api('reserve',{athleteId:select.value,weekId:request.programme_week_id,exerciseId:request.exercise_id,requestId:request.id});
      message.textContent='Uploading…';
      await uploadSigned({path:slot.path,token:slot.token,file:clip});
      message.textContent='Verifying duration…';
      await api('finalize',{athleteId:select.value,id:slot.id});
      message.textContent='Video submitted for review.';
      file.value='';
     }catch(e){message.textContent=e instanceof Error?e.message:'Upload failed';}
     finally{button.disabled=false;}
    };
    card.append(heading,cue,file,button);requests.append(card);
   }
  }catch(e){message.textContent=e instanceof Error?e.message:'Unable to load requests';}
 };
 void load();
 return {refresh:load,destroy:()=>section.remove()};
}
