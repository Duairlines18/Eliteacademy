// Parent Technique Review with linked-athlete upload. Uses the existing parent account JWT.
export function mountParentTechniqueReview({root,api,athleteId,exercises=[],uploadSigned}){
 if(!root||typeof api!=='function')throw Error('Parent review dependencies unavailable');
 const section=document.createElement('section');section.setAttribute('aria-label','Parent Technique Review');
 const title=document.createElement('h3');title.textContent='Technique Review';
 const status=document.createElement('p');status.setAttribute('role','status');
 const history=document.createElement('div');const upload=document.createElement('div');section.append(title,status,upload,history);root.append(section);
 async function refresh(){
  status.textContent='Loading technique feedback…';history.replaceChildren();upload.replaceChildren();
  try{
   const {submissions=[]}=await api('list',{athleteId});
   const context=await api('context',{athleteId});
   if(context.weekId){
    const input=document.createElement('input');input.type='file';input.accept='video/mp4,video/quicktime';input.setAttribute('aria-label','Select technique video');
    const button=document.createElement('button');button.type='button';button.textContent='Upload video for Coach Du';
    button.onclick=async()=>{const file=input.files?.[0];if(!file){status.textContent='Choose a video first.';return;}if(file.size>25*1024*1024){status.textContent='Maximum 25 MB.';return;}
     button.disabled=true;try{status.textContent='Uploading…';const slot=await api('reserve',{athleteId,weekId:context.weekId});await uploadSigned({path:slot.path,token:slot.token,file});status.textContent='Validating video…';await api('finalize',{athleteId,id:slot.id});await refresh();}
     catch(error){status.textContent=error instanceof Error?error.message:'Upload failed';}finally{button.disabled=false;}};
    const hint=document.createElement('p');hint.textContent='Maximum 15 seconds, 25 MB, and 3 videos per athlete each week.';
    upload.append(input,button,hint);
   }
   status.textContent=submissions.length?'Your athlete’s submitted technique videos.':'No technique videos submitted yet.';
   for(const clip of submissions){
    const card=document.createElement('article');
    const name=document.createElement('strong');name.textContent=(exercises.find(x=>x.id===clip.exercise_id)?.name||'Technique video')+' — '+(clip.review_state==='reviewed'?'Reviewed':'Awaiting review');
    const playback=document.createElement('button');playback.type='button';playback.textContent='Watch video';
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='none';video.style.maxWidth='100%';video.hidden=true;
    playback.onclick=async()=>{playback.disabled=true;try{const {url}=await api('playback',{athleteId,id:clip.id});video.src=url;video.hidden=false;video.load();}catch(e){status.textContent=e instanceof Error?e.message:'Video unavailable';}finally{playback.disabled=false;}};
    const notes=document.createElement('div');
    if(clip.review_state==='reviewed'){
     try{const {feedback=[]}=await api('feedback',{athleteId,id:clip.id});for(const item of feedback){const p=document.createElement('p');p.textContent=(item.positive_cue?'What went well: '+item.positive_cue+'. ':'')+'Next correction: '+item.correction;notes.append(p);}}
     catch{notes.textContent='Feedback unavailable.';}
    }
    card.append(name,playback,video,notes);history.append(card);
   }
  }catch(e){status.textContent=e instanceof Error?e.message:'Unable to load technique reviews';}
 }
 void refresh();
 return {refresh,destroy:()=>section.remove()};
}
