import {buildJourney} from './journey-core.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={past:'<path d="M5 12l4 4L19 6"/>',current:'<circle cx="12" cy="9" r="3"/><path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0z"/>',next:'<path d="M5 22V3m0 1c5-5 9 5 14 0v10c-5 5-9-5-14 0"/>'};
function milestones(pb){const p=pb?.reported_progression;if(!p?.form3)return '';return ['200m','400m'].map(event=>{const key=event+'_seconds',a=Number(p.form2?.[key]),b=Number(p.form3?.[key]);return a>0&&b>0?'<div><span class="duj-muted">'+event+' · Athlete reported</span><strong>'+b.toFixed(2)+'s</strong><span class="duj-muted">'+a.toFixed(2)+'s → '+b.toFixed(2)+'s</span></div>':'';}).join('');}
export function mount(host,{request,audience}={}){
 if(!host||typeof request!=='function')return {destroy(){}};
 let destroyed=false,sequence=0,current=null,selected='',snapshotId='';
 async function load(id=''){
  const ticket=++sequence;selected=id;snapshotId='';
  host.innerHTML='<section class="duj" aria-label="Performance Journey"><div class="duj-kicker">PERFORMANCE JOURNEY</div><p role="status">Loading your training journey…</p></section>';
  try{const result=await request({action:'read',audience,...(id?{athleteId:id}:{})});if(destroyed||ticket!==sequence||!host.isConnected)return;current=result;render();}
  catch{if(destroyed||ticket!==sequence||!host.isConnected)return;host.innerHTML='<section class="duj" aria-label="Performance Journey"><div class="duj-kicker">PERFORMANCE JOURNEY</div><p>Your journey is temporarily unavailable.</p><p class="duj-muted">Your training is still available above.</p><button type="button" data-duj-retry>Try again</button></section>';host.querySelector('[data-duj-retry]').onclick=()=>load(selected);}
 }
 function render(){
  if(!current)return;
  const archived=snapshotId?(current.snapshots||[]).find(s=>s.id===snapshotId):null;
  const src=archived?.source||current.source,j=buildJourney(src,{group:current.group,parent:current.parent});
  const choices=current.staff?current.roster:current.linked;
  const picker=(current.staff&&choices?.length)||(choices?.length>1)?'<label>'+(current.staff?'Group or athlete':'Your athlete')+'<select data-duj-subject>'+(current.staff?'<option value="">Group journey</option>':'')+(choices||[]).map(a=>'<option value="'+esc(a.id)+'"'+(selected===a.id||(!selected&&!current.staff&&current.subjectId===a.id)?' selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></label>':'';
  const snapshots=current.snapshots||[];
  const archive=snapshots.length?'<label>Journey updates<select data-duj-snapshot><option value="">Current journey</option>'+snapshots.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===snapshotId?' selected':'')+'>'+esc(new Date(s.captured_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}))+' · Saved update</option>').join('')+'</select></label>':'';
  const pb=milestones(src.personal_bests);
  const map=j.steps.map(s=>'<div class="duj-step duj-'+s.kind+'"><span class="duj-symbol" aria-hidden="true"><svg viewBox="0 0 24 24">'+icons[s.kind]+'</svg></span><div><p class="duj-kicker">'+esc(s.label)+'</p><h3>'+esc(s.title)+'</h3><p>'+esc(s.body)+'</p></div></div>').join('');
  host.innerHTML='<section class="duj" aria-label="Performance Journey"><div class="duj-kicker">'+(current.group?'OUR PERFORMANCE JOURNEY':current.parent?'ATHLETE PERFORMANCE JOURNEY':'MY PERFORMANCE JOURNEY')+'</div><h2>'+esc(j.heading)+'</h2><p class="duj-muted">Your training. Its purpose. Your next direction.</p>'+(picker?'<div class="duj-controls">'+picker+'</div>':'')+(archived?'<p class="duj-muted duj-archive-note">Saved '+esc(new Date(archived.captured_at).toLocaleDateString())+' · Historical programme snapshot</p>':'')+'<div class="duj-path">'+map+'</div><div class="duj-purpose"><strong>Why this matters '+(current.group?'for your group':current.parent?'for your athlete':'for you')+'</strong><p>'+esc(j.purpose)+'</p></div><details><summary>See the work behind your journey</summary>'+j.weeks.map(w=>'<div class="duj-week"><p class="duj-kicker">WEEK '+esc(w.week)+' · PLANNED FOCUS</p><h3>'+esc(w.title)+'</h3><p>'+esc(w.objective||w.phase)+'</p></div>').join('')+'<div class="duj-week"><p class="duj-kicker">RECORDED EVIDENCE · LAST 14 DAYS</p><p>'+esc(j.evidence)+'</p><p class="duj-muted">Training focus describes assigned work. Reported improvements are observations, not measured test results.</p></div>'+(pb?'<div class="duj-week"><p class="duj-kicker">YOUR REPORTED MILESTONES</p><div class="duj-pb">'+pb+'</div><p class="duj-muted">Form 2 → Form 3. Timing method and meet verification pending. These historical changes are not attributed to this programme.</p></div>':'')+'<div class="duj-controls">'+archive+'</div><p class="duj-muted duj-archive-note">Saved updates every 14 days. Training stages change when Coach Du changes your programme.</p></details></section>';
  const p=host.querySelector('[data-duj-subject]');if(p)p.onchange=()=>load(p.value);
  const a=host.querySelector('[data-duj-snapshot]');if(a)a.onchange=()=>{snapshotId=a.value;render();const details=host.querySelector('details');if(details)details.open=true;};
 }
 load();return {destroy(){destroyed=true;++sequence;host.replaceChildren();}};
}
window.DuPerformanceJourney=Object.freeze({mount});
