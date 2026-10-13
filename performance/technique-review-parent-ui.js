// Read-only parent Technique Review. Uses the existing parent account JWT.
export function mountParentTechniqueReview({root,api,athleteId,exercises=[]}){
 if(!root||!athleteId||typeof api!=='function')throw Error('Parent review dependencies unavailable');
 const section=document.createElement('section');section.setAttribute('aria-label','Parent Technique Review');
 const title=document.createElement('h3');title.textContent='Technique Review';
 const status=document.createElement('p');status.setAttribute('role','status');
 const history=document.createElement('div');section.append(title,status,history);root.append(section);
 async function refresh(){
  status.textContent='Loading technique feedback…';history.replaceChildren();
  try{
   const {submissions=[]}=await api('list',{athleteId});
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
