/* Technique Review — Control Room adapter.
   Mount only inside existing authenticated admin screen with API JWT wrapper.
   Does not alter login, programme publishing or existing workout views. */
export function mountTechniqueReviewAdmin({root,api,athletes,programmeWeeks,exercises}) {
 if(!root||typeof api!=='function')throw Error('Missing admin dependencies');
 const section=document.createElement('section');section.setAttribute('aria-label','Technique Review');
 const heading=document.createElement('h3');heading.textContent='Technique Review';
 const status=document.createElement('p');status.setAttribute('role','status');
 const queue=document.createElement('div');
 const form=document.createElement('form');
 const athleteSelect=document.createElement('select'),weekSelect=document.createElement('select'),exerciseSelect=document.createElement('select');
 function options(select,items){for(const item of items){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.name||item.full_name||('Week '+item.week_number);select.append(opt);}}
 options(athleteSelect,athletes);options(weekSelect,programmeWeeks);options(exerciseSelect,exercises);
 for(const [select,name] of [[athleteSelect,'Athlete'],[weekSelect,'Training week'],[exerciseSelect,'Exercise']]){const label=document.createElement('label');label.textContent=name;label.append(select);form.append(label);}
 const instructions=document.createElement('textarea');instructions.maxLength=500;instructions.placeholder='Optional filming instructions';instructions.setAttribute('aria-label','Filming instructions');
 const requestButton=document.createElement('button');requestButton.type='submit';requestButton.textContent='Request video';
 form.append(instructions,requestButton);
 form.onsubmit=async event=>{
  event.preventDefault();requestButton.disabled=true;status.textContent='Creating request…';
  try{await api('request',{athleteId:athleteSelect.value,weekId:weekSelect.value,exerciseId:exerciseSelect.value,instructions:instructions.value});status.textContent='Video request created.';}
  catch(e){status.textContent=e instanceof Error?e.message:'Request failed';}
  finally{requestButton.disabled=false;}
 };
 section.append(heading,form,status,queue);root.append(section);
 async function refresh(){
  status.textContent='Loading videos…';queue.replaceChildren();
  try{
   const {submissions=[]}=await api('queue',{});
   status.textContent=submissions.length+' videos in review history.';
   for(const clip of submissions){
    const card=document.createElement('article');
    const title=document.createElement('strong');
    title.textContent=(athletes.find(a=>a.id===clip.athlete_id)?.full_name||'Athlete')+' — '+(exercises.find(e=>e.id===clip.exercise_id)?.name||'Exercise');
    const play=document.createElement('button');play.textContent='Play private clip';play.type='button';
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.style.maxWidth='100%';
    play.onclick=async()=>{try{const data=await api('playback',{id:clip.id});video.src=data.url;}catch(e){status.textContent=e.message||'Playback unavailable';}};
    const correction=document.createElement('textarea');correction.maxLength=1000;correction.placeholder='One clear technical correction';
    const positive=document.createElement('input');positive.maxLength=500;positive.placeholder='What they did well (optional)';
    const save=document.createElement('button');save.textContent='Send coaching feedback';save.type='button';
    save.onclick=async()=>{save.disabled=true;try{await api('review',{id:clip.id,correction:correction.value,positiveCue:positive.value});status.textContent='Feedback saved.';await refresh();}catch(e){status.textContent=e.message||'Feedback failed';}finally{save.disabled=false;}};
    card.append(title,play,video,correction,positive,save);queue.append(card);
   }
  }catch(e){status.textContent=e instanceof Error?e.message:'Unable to load review queue';}
 }
 void refresh();
 return {refresh,destroy:()=>section.remove()};
}
