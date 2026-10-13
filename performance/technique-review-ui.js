/* Technique Review UI adapter. Standalone, disabled until wired to an authenticated hub.
   Integration: call mountTechniqueReview({root, api, weekId, exercises}) from the
   existing private athlete screen. api(action,payload) must supply the current JWT.
   No DOM insertion into the production app has been made. */
export function mountTechniqueReview({root,api,weekId,exercises,uploadSigned}) {
  if(!root||typeof api!=='function'||typeof uploadSigned!=='function')throw Error('Technique Review adapter missing dependencies');
  const node=document.createElement('section');
  node.className='technique-review';
  node.setAttribute('aria-label','Technique Review');
  const heading=document.createElement('h3');heading.textContent='Technique Review';
  const message=document.createElement('p');message.setAttribute('role','status');
  const requests=document.createElement('div');
  const history=document.createElement('div');history.setAttribute('aria-label','Your technique review history');
  node.append(heading,message,requests,history);root.append(node);
  const filmingHint=exercise=>{
    const name=(exercise?.name||'').toLowerCase();
    if(/sprint|acceleration|approach|broad jump|takeoff|triple jump|pogo/.test(name))return 'Film from the side. Keep your full body and landing in frame.';
    if(/single.leg|balance|landing/.test(name))return 'Film from the front or side. Show the landing clearly.';
    return 'Keep the camera steady and your full body visible.';
  };
  const setStatus=text=>{message.textContent=text;};
  async function refresh(){
    setStatus('Loading requests…');requests.replaceChildren();history.replaceChildren();
    try {
      const data=await api('list',{});
      const items=(data.requests||[]).filter(r=>(!weekId||r.programme_week_id===weekId)&&r.status==='open');
      if(!items.length)setStatus('No video requested this week.');
      else setStatus('Record up to 15 seconds. Maximum three accepted videos per week.');
      for(const submission of (data.submissions||[]).filter(x=>!weekId||x.programme_week_id===weekId)){
        const card=document.createElement('article');
        const name=document.createElement('strong');name.textContent=(exercises.find(x=>x.id===submission.exercise_id)?.name||'Technique video')+' — '+(submission.review_state==='reviewed'?'Reviewed':'Awaiting review');
        const feedback=document.createElement('div');
        if(submission.review_state==='reviewed'){
          try{const result=await api('feedback',{id:submission.id});for(const item of result.feedback||[]){const p=document.createElement('p');p.textContent=(item.positive_cue?'What went well: '+item.positive_cue+' | ':'')+'Next correction: '+item.correction;feedback.append(p);}}
          catch{feedback.textContent='Feedback temporarily unavailable.';}
        }
        card.append(name,feedback);history.append(card);
      }
      for(const req of items){
        const exercise=exercises.find(x=>x.id===req.exercise_id);
        const wrap=document.createElement('div');
        const title=document.createElement('strong');title.textContent=exercise?.name||'Technique video';
        const cue=document.createElement('p');cue.textContent=req.instruction_override||filmingHint(exercise);
        const input=document.createElement('input');input.type='file';input.accept='video/mp4,video/quicktime';input.setAttribute('capture','environment');input.setAttribute('aria-label','Choose technique video');
        const button=document.createElement('button');button.type='button';button.textContent='Upload for review';
        button.onclick=async()=>{
          const file=input.files?.[0];if(!file)return setStatus('Choose a video first.');
          if(file.size>25*1024*1024)return setStatus('Maximum file size is 25 MB.');
          button.disabled=true;setStatus('Preparing secure upload…');
          try {
            const slot=await api('reserve',{weekId:req.programme_week_id,exerciseId:req.exercise_id,requestId:req.id});
            setStatus('Uploading video…');
            await uploadSigned({path:slot.path,token:slot.token,file});
            setStatus('Checking video duration…');
            await api('finalize',{id:slot.id});
            setStatus('Video received for Coach Du’s review.');
            await refresh();
          }catch(e){setStatus(e instanceof Error?e.message:'Upload failed. Please retry.');}
          finally{button.disabled=false;}
        };
        wrap.append(title,cue,input,button);requests.append(wrap);
      }
    }catch(e){setStatus(e instanceof Error?e.message:'Unable to load requests.');}
  }
  void refresh();
  return {refresh,destroy:()=>node.remove()};
}
