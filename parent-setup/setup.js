/* Parent setup only. No programme, identity or access fields are submitted. */
(function(global){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const priorities=['Speed','Jumping / Explosiveness','Movement / Coordination','Strength','Mobility / Resilience'];
 const frequency=['1 day','2 days','3 days','4+ days'];
 function render(root,profile,ports){
  const data=profile.onboarding||{};
  const selected={development_priorities:data.developmentPriorities||[],hub_frequency:data.hubFrequency||profile.assignedHubFrequency||'',training_locations:data.trainingLocations||[],equipment:data.formVersion===2?data.equipment||[]:[],safety_status:data.safetyStatus||''};
  function choices(name,options,multi){return '<div class="du-setup-choices">'+options.map(option=>{const [value,label]=Array.isArray(option)?option:[option,option];const checked=multi?selected[name].includes(value):selected[name]===value;return '<label class="du-setup-chip"><input type="'+(multi?'checkbox':'radio')+'" name="'+name+'" value="'+esc(value)+'"'+(checked?' checked':'')+'> <span>'+esc(label)+'</span></label>';}).join('')+'</div>';}
  root.innerHTML='<div class="hub-shell hub-access"><section class="hub-access-card du-parent-setup"><p class="hub-eyebrow">PARENT ACCESS</p><h1 class="hub-login-heading">Athlete Setup</h1><p class="hub-login-sub">A few quick details to help Coach Du prepare your athlete’s Performance Hub.</p><form id="hubParentSetupForm">'
   +'<fieldset><legend>What should we focus on most?</legend><p class="hub-helper">Select up to two.</p>'+choices('development_priorities',priorities,true)+'<p class="hub-helper" data-priority-note role="status"></p></fieldset>'
   +'<fieldset><legend>How many days per week will your athlete use the Performance Hub?</legend>'+choices('hub_frequency',frequency,false)+'<p class="hub-helper">Confirm the schedule agreed with Coach Du.</p></fieldset>'
   +'<fieldset><legend>Where will your athlete usually train?</legend><p class="hub-helper">Select all that apply.</p>'+choices('training_locations',['Home','Gym','Field / Court'],true)+'</fieldset>'
   +'<fieldset><legend>What equipment is available?</legend><p class="hub-helper">Select all that apply. Bodyweight only clears other equipment.</p>'+choices('equipment',['Bodyweight only','Resistance bands','Weights','Other'],true)+'</fieldset>'
   +'<fieldset><legend>Does your athlete have any current pain, injury or physical limitation we should know about?</legend>'+choices('safety_status',[['no','No current concerns'],['yes','Yes — I’ll provide details'],['already_discussed','Already discussed with Coach Du']],false)+'<div data-safety-details'+(selected.safety_status==='yes'?'':' hidden')+'><label for="duSetupSafety">Safety details</label><textarea id="duSetupSafety" name="safety_details" rows="2" maxlength="1000">'+esc(data.safetyDetails||'')+'</textarea></div></fieldset>'
   +'<p class="hub-helper" data-draft-status role="status"></p><button class="hub-button" type="submit">Save &amp; Continue</button><p class="hub-error" data-setup-error role="alert"></p></form><button class="hub-access-back hub-account-signout" type="button">Sign Out</button></section></div>';
  const form=root.querySelector('form'),error=form.querySelector('[data-setup-error]'),status=form.querySelector('[data-draft-status]'),button=form.querySelector('button[type=submit]');
  let timer,queue=Promise.resolve(),submitting=false,finished=false;
  function payload(){const fd=new FormData(form),result={form_version:2};for(const key of ['development_priorities','training_locations','equipment'])result[key]=fd.getAll(key);for(const key of ['hub_frequency','safety_status'])if(fd.get(key))result[key]=fd.get(key);if(result.safety_status==='yes')result.safety_details=String(fd.get('safety_details')||'').trim();return result;}
  function saveDraft(){if(finished||submitting||!form.isConnected)return;const draft=payload();queue=queue.catch(()=>{}).then(()=>form.isConnected&&!finished?ports.save(draft,true):undefined).then(()=>{if(form.isConnected&&!finished)status.textContent='Draft saved. You can return to finish.';}).catch(()=>{if(form.isConnected&&!finished)status.textContent='Draft not saved. Keep this page open and try Save & Continue.';});}
  function changed(event){
   if(submitting||finished)return;
   if(event.target.name==='development_priorities'){
    const checked=[...form.querySelectorAll('[name=development_priorities]:checked')];
    if(checked.length>2){event.target.checked=false;form.querySelector('[data-priority-note]').textContent='Choose up to two priorities.';}else form.querySelector('[data-priority-note]').textContent='';
   }
   if(event.target.name==='equipment'&&event.target.checked){for(const input of form.querySelectorAll('[name=equipment]'))if(input!==event.target&&(event.target.value==='Bodyweight only'||input.value==='Bodyweight only'))input.checked=false;}
   const yes=!!form.querySelector('[name=safety_status][value=yes]:checked');form.querySelector('[data-safety-details]').hidden=!yes;
   form.querySelector('textarea').required=yes;
   clearTimeout(timer);status.textContent='Saving draft…';timer=setTimeout(saveDraft,600);
  }
  form.addEventListener('input',changed);form.addEventListener('change',changed);
  form.querySelector('textarea').required=selected.safety_status==='yes';
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(submitting||finished)return;error.textContent='';const answers=payload();
   if(!answers.development_priorities.length){error.textContent='Choose one or two development priorities.';return;}
   if(!answers.hub_frequency){error.textContent='Choose your Performance Hub frequency.';return;}
   if(!answers.training_locations.length||!answers.equipment.length){error.textContent='Choose a training location and available equipment.';return;}
   if(!answers.safety_status||answers.safety_status==='yes'&&!answers.safety_details){error.textContent='Confirm safety considerations and provide details if needed.';return;}
   submitting=true;clearTimeout(timer);button.disabled=true;button.textContent='Saving…';
   // Freeze inputs until the confirmed save returns. Earlier drafts finish first.
   for(const input of form.querySelectorAll('input,textarea'))input.disabled=true;
   try{
    await queue;const saved=await ports.save(answers,false);if(saved.onboardingComplete!==true)throw Error('Your setup could not be confirmed. Please try again.');finished=true;
    if(!form.isConnected)return;
    if(saved.accessState==='ACTIVE'){await ports.enter();return;}
    const paused=saved.accessState==='ACCESS_PAUSED';
    root.innerHTML='<div class="hub-shell hub-access"><section class="hub-access-card"><h1 class="hub-login-heading">'+(paused?'Setup saved':'You’re all set!')+'</h1><p class="hub-login-sub">Thank you for completing your athlete’s setup.</p><p>'+(paused?'Your access remains paused. Please contact Coach Du.':'Coach Du will review your information and activate your Performance Hub programme.')+'</p><p>'+(paused?'Your saved setup does not change your access status.':'You’ll be able to access your assigned training once your account is activated.')+'</p><button class="hub-button secondary" type="button" data-check-access>Check access</button><button class="hub-access-back hub-account-signout" type="button">Sign Out</button></section></div>';
    root.querySelector('[data-check-access]').addEventListener('click',()=>ports.enter());
   }catch(err){error.textContent=err.message||'Unable to save your setup. Please try again.';}
   finally{submitting=false;button.disabled=false;button.textContent='Save & Continue';for(const input of form.querySelectorAll('input,textarea'))input.disabled=false;}
  });
 }
 global.DuParentSetup={render};
})(window);
