// Parent Technique Review with linked-athlete upload. Uses the existing parent account JWT.
export function mountParentTechniqueReview({root,api,athleteId,exercises=[],uploadSigned}){
 if(!root||typeof api!=='function')throw Error('Parent review dependencies unavailable');
 const section=document.createElement('section');section.className='du-technique-card';section.setAttribute('aria-label','Parent Technique Review');
 const eyebrow=document.createElement('div');eyebrow.className='du-technique-eyebrow';eyebrow.textContent='COACH DU • VIDEO ANALYSIS';const title=document.createElement('h3');title.textContent='Technique Review';const subtitle=document.createElement('p');subtitle.className='du-technique-subtitle';subtitle.textContent='Share a short clip. Get focused coaching feedback.';
 const status=document.createElement('p');status.setAttribute('role','status');
 const history=document.createElement('div');history.className='du-technique-history';const upload=document.createElement('div');upload.className='du-technique-upload';status.className='du-technique-status';section.append(eyebrow,title,subtitle,upload,status,history);root.append(section);
 async function refresh(){
  status.textContent='Loading technique feedback…';history.replaceChildren();upload.replaceChildren();
  try{
   const {submissions=[]}=await api('list',{athleteId});
   const context=await api('context',{athleteId});
   if(context.weekId){
    const input=document.createElement('input');input.type='file';input.accept='video/mp4,video/quicktime';input.id='du-technique-file-'+athleteId;input.className='du-technique-file';input.setAttribute('aria-label','Select technique video');const pick=document.createElement('label');pick.className='du-technique-picker';pick.htmlFor=input.id;const pickIcon=document.createElement('span');pickIcon.className='du-technique-camera';pickIcon.textContent='↥';const pickTitle=document.createElement('strong');pickTitle.textContent='Choose a video';const pickDetail=document.createElement('span');pickDetail.textContent='Tap to select or record a clip';pick.append(pickIcon,pickTitle,pickDetail);input.addEventListener('change',()=>{pickTitle.textContent=input.files?.[0]?.name||'Choose a video';pickDetail.textContent=input.files?.[0]?'Ready to send for review':'Tap to select or record a clip';});
    const button=document.createElement('button');button.type='button';button.textContent='Send to Coach Du →';button.className='du-technique-submit';
    button.onclick=async()=>{const file=input.files?.[0];if(!file){status.textContent='Choose a video first.';return;}if(file.size>25*1024*1024){status.textContent='Maximum 25 MB.';return;}
     button.disabled=true;try{status.textContent='Uploading…';const slot=await api('reserve',{athleteId,weekId:context.weekId});await uploadSigned({path:slot.path,token:slot.token,file});status.textContent='Validating video…';await api('finalize',{athleteId,id:slot.id});await refresh();}
     catch(error){status.textContent=error instanceof Error?error.message:'Upload failed';}finally{button.disabled=false;}};
    const hint=document.createElement('p');hint.textContent='Max 3 videos per week';hint.className='du-technique-hint';
    upload.append(input,pick,button,hint);
   }
   status.textContent=submissions.length?'Your video reviews':'Your videos will appear here after upload.';
   for(const clip of submissions){
    const card=document.createElement('article');card.className='du-technique-history-card';
    const name=document.createElement('strong');name.textContent=(exercises.find(x=>x.id===clip.exercise_id)?.name||'Technique video')+' — '+(clip.review_state==='reviewed'?'Reviewed':'Awaiting review');
    const playback=document.createElement('button');playback.type='button';playback.textContent='Watch clip →';playback.className='du-technique-watch';
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
 const styleId='du-technique-review-style';if(!document.getElementById(styleId)){const style=document.createElement('style');style.id=styleId;style.textContent=`
.du-technique-card{box-sizing:border-box;max-width:760px;margin:28px auto;padding:clamp(20px,4vw,34px);border:1px solid rgba(148,163,184,.23);border-radius:22px;background:linear-gradient(155deg,rgba(30,41,59,.72),rgba(15,23,42,.45));color:#f8fafc;font-family:inherit;box-shadow:0 12px 40px rgba(0,0,0,.12)}
.du-technique-card *{box-sizing:border-box}.du-technique-eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#c6a875;margin-bottom:10px}.du-technique-card h3{font-size:clamp(23px,4vw,32px);line-height:1.2;letter-spacing:-.035em;margin:0 0 8px;font-weight:750;color:inherit}.du-technique-subtitle{font-size:14px;color:#cbd5e1;margin:0 0 22px;line-height:1.55}
.du-technique-upload{display:flex;flex-direction:column;gap:12px}.du-technique-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}.du-technique-picker{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:20px;border:1.5px dashed rgba(198,168,117,.65);border-radius:15px;background:rgba(255,255,255,.035);cursor:pointer;transition:background .15s}.du-technique-picker:hover,.du-technique-picker:focus-within{background:rgba(198,168,117,.1)}.du-technique-picker strong{font-size:15px;color:#f8fafc}.du-technique-picker span:last-child{font-size:12px;color:#cbd5e1;flex-basis:100%;padding-left:48px}.du-technique-camera{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:rgba(198,168,117,.15);color:#e4c58b;font-size:23px}
.du-technique-submit{width:100%;min-height:46px;border:0;border-radius:12px;background:#d2b47e;color:#111827;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.du-technique-submit:disabled{opacity:.55;cursor:wait}.du-technique-hint{text-align:center;font-size:12px;color:#aebbd0;margin:0}.du-technique-status{font-size:13px;color:#cbd5e1;margin:18px 0 0;line-height:1.5}.du-technique-history{display:grid;gap:10px;margin-top:10px}.du-technique-history-card{display:grid;gap:10px;padding:16px;border-radius:13px;border:1px solid rgba(148,163,184,.22);background:rgba(255,255,255,.04)}.du-technique-history-card strong{font-size:14px}.du-technique-watch{justify-self:start;border:1px solid rgba(198,168,117,.6);background:transparent;color:#e8c98f;border-radius:9px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}.du-technique-history-card video{width:100%;border-radius:10px}
@media(max-width:520px){.du-technique-card{margin:16px 0;padding:20px 16px;border-radius:16px}.du-technique-picker{padding:16px}}
`;document.head.append(style);} 
 void refresh();
 return {refresh,destroy:()=>section.remove()};
}
