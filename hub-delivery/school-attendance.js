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
function view(data){
 const entries=new Map((data.entries||[]).map(e=>[key(e),e]));
 const weekPicker='<label>Attendance week<select data-att-week>'+Array.from({length:data.totalWeeks},(_,i)=>'<option value="'+(i+1)+'"'+(i+1===data.weekNumber?' selected':'')+'>Week '+(i+1)+(i+1===data.currentWeek?' (current)':'')+'</option>').join('')+'</select></label>';
 let dateInputs='';
 if(data.writable)dateInputs='<div class="att-dates">'+[1,2].map(n=>{const dates=[...new Set((data.entries||[]).filter(e=>e.sessionNumber===n&&e.sessionDate).map(e=>e.sessionDate))];return '<label>Day '+n+' actual date<input type="date" data-att-date="'+n+'" value="'+esc(dates.length===1?dates[0]:'')+'">'+(dates.length>1?'<small class="att-muted">Different recorded dates; retained unless replaced.</small>':'')+'</label>';}).join('')+'</div>';
 const rows=(data.roster||[]).map(a=>{
  const s=summary(data,a.id);
  return '<div class="att-row"><strong>'+esc(a.name)+'<small class="att-muted" style="display:block">'+(s.recorded?s.present+'/2 attended · '+s.unrecorded+' unrecorded':'Attendance not recorded')+'</small></strong>'+[1,2].map(n=>{
   const e=entries.get(a.id+'|'+n),status=e?.status||'unrecorded';
   if(!data.writable)return '<div><span class="att-muted">Day '+n+'</span><br>'+esc(labels[status])+(e?.sessionDate?'<br><small>'+esc(e.sessionDate)+'</small>':'')+'</div>';
   return '<label>Day '+n+'<select data-att-status data-athlete="'+esc(a.id)+'" data-day="'+n+'">'+Object.entries(labels).map(([v,l])=>'<option value="'+v+'"'+(status===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label>';
  }).join('')+'</div>';
 }).join('');
 const totals=(data.roster||[]).map(a=>summary(data,a.id));
 const present=totals.reduce((n,s)=>n+s.present,0),recorded=totals.reduce((n,s)=>n+s.recorded,0),possible=totals.length*2;
 return '<style>'+style+'</style><section class="du-att" aria-label="Weekly attendance"><h2>'+ (data.writable?'Weekly attendance':'School participation')+'</h2><p class="att-muted">Coach-recorded attendance. Daily entry or weekly reconciliation - use whichever is easier. No daily Hub login is required.</p><div class="att-toolbar">'+weekPicker+'</div><p><strong>Week '+data.weekNumber+' of '+data.totalWeeks+'</strong></p>'+dateInputs+'<div class="att-metrics"><span class="att-metric">'+present+' attended session places</span><span class="att-metric">'+recorded+'/'+possible+' recorded</span><span class="att-metric">'+(possible-recorded)+' not recorded</span></div><div class="att-list">'+rows+'</div><p class="att-muted">Two coached sessions per week. Optional home work is not counted. Not recorded does not mean absent.</p>'+(data.writable?'<button type="button" data-att-save>Save changes</button>':'')+'<p role="status" aria-live="polite"></p></section>';
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
  if(!event.target.closest('[data-att-save]')||!alive()||!data?.writable||busy)return;
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
