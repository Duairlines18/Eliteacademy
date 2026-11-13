(function(root){
 'use strict';
 const UNKNOWN=['unknown','Not sure — need to ask my child'];
 const fields={
  start:[
   ['body','How is your body feeling?','How is your child’s body feeling?',[['good','Good — no problems'],['sore','Normal muscle soreness'],['pain','Pain or unusual tightness'],['unwell','Injured or feeling sick']]],
   ['readiness','How ready do you feel to train?','How ready does your child feel to train?',[['very_ready','Very ready'],['ready','Ready'],['tired','Tired, but okay'],['exhausted','Not ready / exhausted']]],
   ['plannedOutside','Do you have other training or competitions planned this week?','Does your child have other training or competitions planned this week?',[['no','No'],['practice','School or club practice'],['match','Competition / match'],['both','Both practice and competition']]],
   ['recentOutside','Have you trained or competed outside your programme since your last check-in?','Has your child trained or competed outside their programme since the last check-in?',[['no','No'],['training','Yes — training'],['competition','Yes — competition'],['both','Yes — both']]],
  ],
  end:[
   ['completion','How much of your Du Airlines training did you complete?','How much of their Du Airlines training did your child complete?',[['all','All sessions'],['most','Most sessions'],['some','Some sessions'],['none','No sessions']]],
   ['challenge','How challenging was your programme?','How challenging was your child’s programme?',[['easy','Too easy'],['right','About right'],['manageable','Challenging but manageable'],['difficult','Too difficult']]],
   ['recovery','How did your body feel after training this week?','How did your child’s body feel after training this week?',[['good','Good — recovering well'],['sore','Normal muscle soreness'],['fatigued','Unusually tired / struggling to recover'],['unwell','Pain, injury or illness']]],
  ],
 };
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function safety(v){return ['pain','unwell'].includes(v.body)||v.recovery==='unwell'||v.incompleteReason==='pain';}
 function radios(name,title,options,value,parent,unknown=true){const list=parent&&unknown?[...options,UNKNOWN]:options;return '<fieldset class="wc-field"><legend>'+esc(title)+'</legend><div class="wc-options">'+list.map(([id,label])=>'<label class="wc-option"><input type="radio" name="'+esc(name)+'" value="'+id+'" required '+(value===id?'checked':'')+'><span>'+esc(label)+'</span></label>').join('')+'</div></fieldset>';}
 function textfield(name,title,value,max=300){return '<label class="wc-text">'+esc(title)+'<input name="'+name+'" maxlength="'+max+'" value="'+esc(value)+'" required></label>';}
 function read(form){const value={formVersion:'2.0'};for(const [key,v] of new FormData(form))value[key]=v;if(value.severity!==undefined&&value.severity!==''&&value.severity!=='unknown')value.severity=Number(value.severity);return value;}
 function conditions(kind,value,parent){let html='';
  for(const name of kind==='start'?['plannedOutside','recentOutside']:[])if(value[name]&&!['no','unknown'].includes(value[name]))html+=textfield(name+'Details',name==='plannedOutside'?'What activity is planned, and when?':'What activity happened since the last check-in, and when?',value[name+'Details']);
  if(kind==='end'&&['most','some','none'].includes(value.completion)){
   html+=radios('incompleteReason','Why was some training missed?',[['school','School/exams'],['schedule','Time or schedule'],['pain','Pain or illness'],['other','Other']],value.incompleteReason,parent);
   if(value.incompleteReason==='other')html+=textfield('incompleteDetails','What got in the way?',value.incompleteDetails);
  }
  if(safety(value)){
   html+='<div class="wc-notice">Thank you for reporting this. Coach Du will review it before training resumes.</div>'+textfield('symptoms','Where is the problem, or what symptoms are present?',value.symptoms==='unknown'?'Not sure — need to ask my child':value.symptoms,500)+(parent?'<button type="button" data-wc-symptoms-unknown>Not sure — need to ask my child</button>':'');
   html+=radios('painApplicable',parent?'Is your child experiencing pain?':'Are you experiencing pain?',[['yes','Yes'],['no','No']],value.painApplicable,parent);
   if(value.painApplicable==='yes')html+='<label class="wc-text">Pain severity, 0–10<select name="severity" required><option value="">Choose severity</option>'+Array.from({length:11},(_,i)=>'<option value="'+i+'" '+(value.severity===i?'selected':'')+'>'+i+(i===0?' — no pain':i===10?' — worst pain':'')+'</option>').join('')+(parent?'<option value="unknown" '+(value.severity==='unknown'?'selected':'')+'>Not sure — need to ask my child</option>':'')+'</select></label>';
   html+=radios('movement','Does it affect normal movement or training?',[['yes','Yes'],['no','No'],['unsure','Not sure']],value.movement,parent);
  }
  return html;
 }
 function create(options){
  const {root:container,post,getSession,clearTraining,onReady,onLogout}=options;
  let state=null,version=0,identity='',active=null,activeDraft=null;
  const drafts=new Map();
  const eligible=()=>{const s=getSession();return s?.mode==='account'&&['parent','private-athlete'].includes(s.audience);};
  const parent=()=>getSession()?.audience==='parent';
  function shell(title,body){container.innerHTML='<section class="wc-screen"><div class="wc-wrap"><p class="wc-brand">DU AIRLINES · PERFORMANCE HUB</p><h1 tabindex="-1">'+esc(title)+'</h1>'+body+'<nav class="wc-support" aria-label="Check-in support"><a href="#/hub/checkin-safety">Safety information</a><a href="#/hub/checkin-issue">Report an issue</a><a href="mailto:coachdu@duairlineseliteacademy.com">Contact Coach Du</a><button type="button" data-wc-logout>Log out</button></nav></div></section>';container.querySelector('[data-wc-logout]').onclick=onLogout;}
  function errorScreen(message){shell('Unable to verify your check-in','<p>Your training will open after we can verify your check-in.</p><p role="alert">'+esc(message||'Please try again.')+'</p><button type="button" class="wc-primary" data-wc-retry>Try again</button>');container.querySelector('[data-wc-retry]').onclick=()=>onReady();}
  function form(requirement){
   active=requirement;
   const prior=drafts.get(requirement.id);
   activeDraft=prior&&prior.revision===requirement.revision?prior:{revision:requirement.revision,value:requirement.payload?{...requirement.payload}:{formVersion:'2.0'},submission:null,serialized:null};
   drafts.set(requirement.id,activeDraft);
   const value=activeDraft.value,kind=requirement.kind,isParent=parent();
   const title=kind==='start'?'Start-of-week check-in':isParent?'Weekly training review':'End-of-week check-in';
   shell(title,'<p class="wc-sub">'+(isParent?'Your child’s weekly training review':'Week '+esc(requirement.week_number)+' · '+esc(requirement.period_start))+'<br>About 1 minute'+(isParent?'. Answer from what your child told you or what you observed. If you do not know, choose “Not sure”.':'. Honest answers help Coach Du plan your training.')+'</p>'+(kind==='end'?'<p>You can report the week so far if training is unfinished, then update it later.</p>':'')+'<form id="mandatoryCheckinForm">'+fields[kind].map(([name,athleteTitle,parentTitle,opts])=>radios(name,isParent?parentTitle:athleteTitle,opts,value[name],isParent)).join('')+'<div data-wc-conditions>'+conditions(kind,value,isParent)+'</div><label class="wc-text">'+(kind==='start'?'Anything else Coach Du should know?':'Anything sport-related or anything else Coach Du should know?')+' <small>(optional)</small><textarea name="note" maxlength="1000" rows="3">'+esc(value.note)+'</textarea></label><p data-wc-error role="alert"></p><button type="submit" class="wc-primary">'+(requirement.submitted_at?'Save updated check-in':'Submit check-in')+'</button></form>');
   const el=container.querySelector('#mandatoryCheckinForm');
   function remember(){activeDraft.value={...activeDraft.value,...read(el)};}
   el.onclick=e=>{if(e.target.closest('[data-wc-symptoms-unknown]')){el.querySelector('[name=symptoms]').value='Not sure — need to ask my child';remember();}};
   el.oninput=remember;
   el.onchange=()=>{remember();const focused=document.activeElement?.name;el.querySelector('[data-wc-conditions]').innerHTML=conditions(kind,activeDraft.value,isParent);if(focused)el.querySelector('[name="'+focused+'"]:checked')?.focus();};
   el.onsubmit=async e=>{
    e.preventDefault();remember();const current=read(el),serialized=JSON.stringify(current),button=el.querySelector('[type=submit]'),error=el.querySelector('[data-wc-error]');
    if(serialized!==activeDraft.serialized){activeDraft.submission=crypto.randomUUID();activeDraft.serialized=serialized;}
    const draft=activeDraft,stamp=identity,saveVersion=version;button.disabled=true;button.textContent='Saving…';error.textContent='';
    try{await post({action:'save-checkin',requirementId:requirement.id,kind,input:current,submissionId:draft.submission,expectedRevision:requirement.revision});if(stamp!==identity||saveVersion!==version)return;drafts.delete(requirement.id);active=null;location.hash='#/hub/athlete';onReady();}
    catch(err){if(!el.isConnected)return;error.textContent=err.message||'Your check-in could not be saved. Try again.';if(err.code==='CHECKIN_CONFLICT'){error.textContent+=' Open this check-in again to load the latest saved answers.';const reload=document.createElement('button');reload.type='button';reload.textContent='Reload saved check-in';reload.onclick=()=>{drafts.delete(requirement.id);onReady();};error.append(' ',reload);}button.disabled=false;button.textContent='Try saving again';}
   };
  }
  function hold(){shell('Coach Du needs to review this','<div class="wc-notice"><p>Your report has been saved. Training is on hold while Coach Du reviews it.</p><p>Submitting a check-in does not give medical clearance. Contact Coach Du about the next step.</p></div><a class="wc-primary" href="mailto:coachdu@duairlineseliteacademy.com">Contact Coach Du</a>');}
  function safetyInfo(){shell('Safety information','<p>Stop any exercise that causes pain or makes symptoms worse. Do not use a check-in as permission to continue through pain or illness.</p><p>If symptoms need urgent help, seek local medical care. For a child, involve their parent or guardian.</p><p>Coach Du can review and adjust training. Feedback submission is not medical clearance.</p><a href="#/hub/athlete">Return to check-in / Hub</a>');}
  function issue(){shell('Report an issue','<p>Tell Coach Du what is affecting training. You can send this even while a check-in is overdue.</p><form id="wcIssueForm">'+radios('reason','What is affecting training?',[['pain','Pain / injury / tightness'],['illness','Illness'],['schedule','School / schedule'],['other','Other']],null,false,false)+'<label class="wc-text">What should Coach Du know?<textarea name="note" maxlength="1000" required rows="4"></textarea></label><p data-wc-error role="alert"></p><button type="submit" class="wc-primary">Send to Coach Du</button></form>');const el=container.querySelector('#wcIssueForm');let id=null,serialized=null;el.onsubmit=async e=>{e.preventDefault();const data=read(el),input={reason:data.reason,note:data.note},value=JSON.stringify(input),button=el.querySelector('[type=submit]');if(value!==serialized){id=crypto.randomUUID();serialized=value;}const stamp=JSON.stringify(getSession());button.disabled=true;try{await post({action:'report-checkin-issue',input,submissionId:id});if(stamp!==JSON.stringify(getSession())||!el.isConnected)return;shell('Issue sent to Coach Du','<p>Your report is saved.</p><a href="#/hub/athlete">Return to check-in / Hub</a>');}catch(err){el.querySelector('[data-wc-error]').textContent=err.message||'Unable to send. Try again.';button.disabled=false;}};}
  function list(){const reqs=state.requirements||[];shell('Your weekly check-ins','<p>Completed reports stay saved. Update a report if you have more information.</p>'+reqs.slice().reverse().map(r=>'<article class="wc-history"><strong>'+(parent()?'Weekly training review':'Week '+esc(r.week_number)+' · '+(r.kind==='start'?'Start':'End')+' of week')+'</strong><p>'+esc(r.period_start)+' · '+(r.submitted_at?'Submitted':r.due_date<=state.today?'Due':'Opens '+esc(r.due_date))+'</p>'+(r.submitted_at?'<button type="button" data-wc-amend="'+esc(r.id)+'">View / update report</button>':'')+'</article>').join('')+(reqs.some(r=>r.kind==='end'&&!r.submitted_at&&r.due_date>state.today)?'<button type="button" class="wc-primary" data-wc-open-end>I have finished this week’s training</button><p>Only choose this if the final assigned session is complete. This opens your weekly review early.</p>':'')+'<a href="#/hub/athlete">Back to Hub</a>');container.querySelectorAll('[data-wc-amend]').forEach(button=>button.onclick=()=>form(reqs.find(r=>r.id===button.dataset.wcAmend)));const open=container.querySelector('[data-wc-open-end]');if(open)open.onclick=async()=>{open.disabled=true;try{await post({action:'open-end-checkin'});onReady();}catch(err){errorScreen(err.message);}};}
  async function guard(route){
   if(!eligible())return false;
   const nextIdentity=JSON.stringify(getSession());if(identity!==nextIdentity){identity=nextIdentity;drafts.clear();active=null;}
   const requestVersion=++version,stamp=identity;
   // Support must remain usable even if the verification endpoint is temporarily unavailable.
   if(route==='/checkin-safety'){clearTraining();safetyInfo();return true;}
   if(route==='/checkin-issue'){clearTraining();issue();return true;}
   shell('Checking your weekly check-in…','<p>Please wait a moment.</p>');
   try{const data=await post({action:'checkin-state'});if(requestVersion!==version||stamp!==JSON.stringify(getSession())||(location.hash.replace('#/hub','')||'/')!==route)return true;state=data.checkins;if(!state||typeof state.enabled!=='boolean')throw Error('Check-in verification is unavailable.');
    if(!state.enabled)return false;
    if(!Array.isArray(state.due)||typeof state.held!=='boolean')throw Error('Check-in verification is unavailable.');
    if(state.due.length){clearTraining();form(state.due[0]);return true;}
    if(state.held){clearTraining();hold();return true;}
    if(route==='/feedback'||route==='/checkin'){list();return true;}
    return false;
   }catch(err){if(requestVersion!==version||stamp!==JSON.stringify(getSession()))return true;clearTraining();errorScreen(err.message);return true;}
  }
  function forget(){version++;identity='';state=null;drafts.clear();active=null;activeDraft=null;}
  return {guard,eligible,forget,get enabled(){return state?.enabled===true;}};
 }
 root.DuWeeklyCheckins={create,fields};
})(globalThis);
