(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={unrecorded:'Not recorded',present:'Attended',absent:'Absent',excused:'Excused'};
const key=e=>e.athleteId+'|'+e.sessionNumber;
function summary(data,id){
 const rows=new Map((data.entries||[]).filter(e=>e.athleteId===id).map(e=>[e.sessionNumber,e]));
 const result={present:0,absent:0,excused:0,unrecorded:0,recorded:0};
 for(const n of [1,2]){const status=rows.get(n)?.status||'unrecorded';result[status]++;if(status!=='unrecorded')result.recorded++;}
 return result;
}
function changedEntries(data,values){
 const existing=new Map((data.entries||[]).map(e=>[key(e),e]));
 return values.map(e=>({...e,sessionDate:e.status==='unrecorded'?null:(e.sessionDate||null)})).filter(e=>{
  const old=existing.get(key(e));return (old?.status||'unrecorded')!==e.status||(old?.sessionDate||null)!==e.sessionDate;
 });
}
function collectEntries(data,selections,dates,touched){
 const existing=new Map((data.entries||[]).map(e=>[key(e),e]));
 return selections.map(e=>({...e,sessionDate:touched.has(e.sessionNumber)?(dates[e.sessionNumber]||null):(dates[e.sessionNumber]||existing.get(key(e))?.sessionDate||null)}));
}
const style=`.du-att{margin:20px 0;padding:20px;border:1px solid var(--hub-line,rgba(199,162,90,.2));border-radius:14px;background:var(--hub-panel,#111);color:var(--hub-text,#f5f1e8)}.du-att h2{margin:0 0 8px}.du-att p{line-height:1.6}.du-att .att-muted{color:var(--hub-muted,#aaa69f);font-size:.87rem}.du-att .att-toolbar,.du-att .att-dates{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:15px 0}.du-att label{display:grid;gap:6px;font-size:.85rem;min-width:0}.du-att input,.du-att select{width:100%;box-sizing:border-box;min-height:42px;background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border:1px solid var(--hub-line,#6d6047);border-radius:8px;padding:8px;font:inherit;color-scheme:dark}.du-att button{padding:11px 15px;border:1px solid var(--hub-gold,#c7a25a);border-radius:8px;background:var(--hub-panel-2,#171717);color:var(--hub-gold,#c7a25a);font:inherit;cursor:pointer}.du-att button:disabled{opacity:.6;cursor:default}.du-att .att-list{display:grid;gap:10px}.du-att .att-row{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(2,minmax(0,1fr));gap:12px;align-items:center;padding:14px;border:1px solid var(--hub-line,#6d6047);border-radius:10px}.du-att .att-row strong{overflow-wrap:anywhere}.du-att .att-metrics{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.du-att .att-metric{padding:12px;border:1px solid var(--hub-line,#6d6047);border-radius:9px}.du-att .att-error{color:#ffb3a8}.du-att [role=status]{min-height:1.6em}@media(max-width:560px){.du-att{padding:14px}.du-att .att-row{grid-template-columns:repeat(2,minmax(0,1fr))}.du-att .att-row>strong{grid-column:1/-1}.du-att .att-dates label{width:100%}}`;
// Compact register styling is scoped to school attendance only.
const compactStyle=`.du-att-compact{margin:14px 0;padding:14px}.du-att-compact .att-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.du-att-compact h2{margin:0;font-size:1.35rem}.du-att-compact .att-week-label{display:flex;align-items:center;gap:8px}.du-att-compact .att-week-label select{width:auto;min-height:38px}.du-att-compact .att-day-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.du-att-compact .att-day-tabs button.active{background:var(--hub-gold,#c7a25a);color:#15120e}.du-att-compact .att-day-panel[hidden]{display:none}.du-att-compact .att-date-label{max-width:260px;margin:0 0 12px}.du-att-compact .att-compact-head,.du-att-compact .att-compact-row{display:flex;justify-content:space-between;align-items:center;gap:10px}.du-att-compact .att-compact-head{font-size:.75rem;color:var(--hub-muted,#aaa69f);padding:4px 0 8px}.du-att-compact .att-compact-row{padding:9px 0;border-top:1px solid var(--hub-line,rgba(199,162,90,.2))}.du-att-compact .att-compact-row strong{min-width:0;font-size:.92rem;overflow-wrap:anywhere}.du-att-compact .att-choices{display:flex;gap:7px;flex-shrink:0}.du-att-compact .att-choice{min-height:39px;width:39px;padding:0;border-radius:50%;font-size:.82rem;font-weight:700;color:var(--hub-text,#f5f1e8);border-color:var(--hub-line,#6d6047)}.du-att-compact .att-choice.selected{background:var(--hub-gold,#c7a25a);color:#15120e}.du-att-compact .att-compact-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:15px}.du-att-compact .att-compact-footer span{font-size:.85rem;color:var(--hub-muted,#aaa69f)}@media(max-width:400px){.du-att-compact .att-choices{gap:4px}.du-att-compact .att-choice{width:35px;min-height:35px}.du-att-compact .att-compact-row strong{font-size:.83rem}}`;
function view(data){
 const entries=new Map((data.entries||[]).map(e=>[key(e),e]));
 const picker='<label class="att-week-label">Week <select data-att-week>'+Array.from({length:data.totalWeeks},(_,i)=>'<option value="'+(i+1)+'"'+(i+1===data.weekNumber?' selected':'')+'>Week '+(i+1)+(i+1===data.currentWeek?' (current)':'')+'</option>').join('')+'</select></label>';
 const panels=[1,2].map(n=>{
  const knownDates=[...new Set((data.entries||[]).filter(e=>e.sessionNumber===n&&e.sessionDate).map(e=>e.sessionDate))];
  const dateField=data.writable?'<label class="att-date-label">Session date (required to save)<input type="date" data-att-date="'+n+'" value="'+esc(knownDates.length===1?knownDates[0]:'')+'">'+(knownDates.length>1?'<small class="att-muted">Different recorded dates; retained unless replaced.</small>':'')+'</label>':'';
  const rows=(data.roster||[]).map((a,i)=>{
   const e=entries.get(a.id+'|'+n),status=e?.status||'unrecorded';
   if(!data.writable)return '<div class="att-compact-row"><strong>'+esc(a.name)+'</strong><span>'+esc(labels[status])+(e?.sessionDate?'<small class="att-muted" style="display:block">'+esc(e.sessionDate)+'</small>':'')+'</span></div>';
   return '<div class="att-compact-row"><strong>'+esc(a.name)+'</strong><input type="hidden" data-att-status data-athlete="'+esc(a.id)+'" data-day="'+n+'" value="'+esc(status)+'"><div class="att-choices" role="group" aria-label="Day '+n+' attendance for '+esc(a.name)+'">'+['present','absent','excused'].map(v=>'<button type="button" data-att-choice="'+v+'" aria-label="'+esc(a.name)+': '+esc(labels[v])+'" aria-pressed="'+(status===v)+'" class="att-choice'+(status===v?' selected':'')+'">'+(status===v?'✓':esc(v==='present'?'P':v==='absent'?'A':'E'))+'</button>').join('')+'</div></div>';
  }).join('');
  return '<div class="att-day-panel" data-att-panel="'+n+'"'+(n!==1?' hidden':'')+'>'+dateField+'<div class="att-compact-head"><span>Athlete</span><span>Present · Absent · Excused</span></div><div class="att-compact-list">'+rows+'</div></div>';
 }).join('');
 const totals=(data.roster||[]).map(a=>summary(data,a.id)),present=totals.reduce((n,s)=>n+s.present,0),recorded=totals.reduce((n,s)=>n+s.recorded,0),possible=totals.length*2;
 return '<style>'+style+compactStyle+'</style><section class="du-att du-att-compact" aria-label="Weekly attendance"><div class="att-top"><h2>Attendance</h2>'+picker+'</div><p class="att-muted">Two coached sessions · unmarked is not absent</p><div class="att-day-tabs" role="group" aria-label="Choose coached session"><button type="button" class="active" data-att-daytab="1" aria-pressed="true">Day 1</button><button type="button" data-att-daytab="2" aria-pressed="false">Day 2</button></div>'+panels+'<div class="att-compact-footer"><span data-att-progress>'+recorded+'/'+possible+' recorded · '+present+' present</span>'+(data.writable?'<button type="button" data-att-save>Save attendance</button>':'')+'</div><p role="status" aria-live="polite"></p></section>';
}
function mount(container,options){
 let data=null,version=0,busy=false,touchedDates=new Set();
 const alive=()=>container.isConnected!==false&&(!options.isCurrent||options.isCurrent());
 const say=(message,error=false)=>{if(!alive())return;const node=container.querySelector('[role="status"]');if(node){node.textContent=message;node.classList.toggle('att-error',error);}};
 function values(){
  const selections=[...container.querySelectorAll('[data-att-status]')].map(e=>({athleteId:e.dataset.athlete,sessionNumber:Number(e.dataset.day),status:e.value}));
  const dates=Object.fromEntries([1,2].map(n=>[n,container.querySelector('[data-att-date="'+n+'"]').value]));
  return collectEntries(data,selections,dates,touchedDates);
 }
 async function load(week){
  const stamp=++version;busy=true;
  if(!data)container.innerHTML='<section class="du-att"><p role="status">Loading school attendance…</p></section>';
  try{const result=await options.post({action:'attendance-read',weekNumber:week});if(!alive()||stamp!==version)return;data=result;touchedDates=new Set();container.innerHTML=view(data);}
  catch(error){if(!alive()||stamp!==version)return;say('Attendance could not load. Reconcile when connected. '+error.message,true);if(data)container.querySelector('[data-att-week]').value=String(data.weekNumber);}
  finally{if(stamp===version)busy=false;}
 }
 container.addEventListener('change',async event=>{
  if(!alive()||!data)return;
  if(event.target.matches('[data-att-week]')){
   if(busy){event.target.value=String(data.weekNumber);return;}
   if(data.writable&&changedEntries(data,values()).length&&!root.confirm('Discard unsaved attendance changes and change week?')){event.target.value=String(data.weekNumber);return;}
   await load(Number(event.target.value));return;
  }
  if(event.target.matches('[data-att-date]'))touchedDates.add(Number(event.target.dataset.attDate));
  if(data.writable)say('Unsaved changes. Save when connected.');
 });
 container.addEventListener('click',async event=>{
  if(!alive()||!data)return;
  const tab=event.target.closest('[data-att-daytab]');
  if(tab){const day=tab.dataset.attDaytab;container.querySelectorAll('[data-att-daytab]').forEach(b=>{const active=b.dataset.attDaytab===day;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});container.querySelectorAll('[data-att-panel]').forEach(p=>p.hidden=p.dataset.attPanel!==day);return;}
  const choice=event.target.closest('[data-att-choice]');
  if(choice&&data.writable&&!busy){
   const row=choice.closest('.att-compact-row'),input=row.querySelector('[data-att-status]'),next=input.value===choice.dataset.attChoice?'unrecorded':choice.dataset.attChoice;
   input.value=next;row.querySelectorAll('[data-att-choice]').forEach(b=>{const active=b.dataset.attChoice===next;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.textContent=active?'✓':b.dataset.attChoice==='present'?'P':b.dataset.attChoice==='absent'?'A':'E';});
   const inputs=[...container.querySelectorAll('[data-att-status]')],recorded=inputs.filter(i=>i.value!=='unrecorded').length,present=inputs.filter(i=>i.value==='present').length;
   container.querySelector('[data-att-progress]').textContent=recorded+'/'+inputs.length+' recorded · '+present+' present';say('Unsaved changes.');return;
  }
  if(!event.target.closest('[data-att-save]')||!data.writable||busy)return;
  const changes=changedEntries(data,values());if(!changes.length){say('No changes to save.');return;}
  const button=container.querySelector('[data-att-save]'),picker=container.querySelector('[data-att-week]');busy=true;button.disabled=true;picker.disabled=true;
  // Freeze editable inputs while this exact payload is in flight.
  const inputs=[...container.querySelectorAll('[data-att-status],[data-att-date]')];inputs.forEach(e=>e.disabled=true);say('Saving attendance…');
  const stamp=version;
  try{await options.post({action:'attendance-save',weekNumber:data.weekNumber,entries:changes});if(!alive()||stamp!==version)return;
   const merged=new Map(data.entries.map(e=>[key(e),e]));changes.forEach(e=>merged.set(key(e),e));data={...data,entries:[...merged.values()]};touchedDates=new Set();container.innerHTML=view(data);say('Attendance saved. You can reconcile this week again later.');}
  catch(error){if(alive()&&stamp===version)say('Not saved. Your edits are still here. '+error.message,true);}
  finally{busy=false;if(alive()){button.disabled=false;picker.disabled=false;inputs.forEach(e=>e.disabled=false);}}
 });
 load(options.weekNumber);
}
const api={summary,changedEntries,collectEntries,view,mount};if(typeof module==='object'&&module.exports)module.exports=api;root.DuSchoolAttendance=api;
})(typeof window!=='undefined'?window:globalThis);
