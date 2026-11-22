'use strict';
// Real Chromium rendering against synthetic local records. No production writes.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs'],{stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 const browser=await chromium.launch({headless:true});let checks=0;
 const ok=(value,message)=>{assert.ok(value,message);checks++;};
 try{
 for(const width of [390,375,430,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const athleteCompletionCalls=[];
  page.on('request',request=>{
   if(request.url().includes('/workout-completions')&&['list','set'].includes(request.postDataJSON()?.action))athleteCompletionCalls.push(request.url());
  });
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:4173/')?route.continue():route.abort());
  for(let n=1;n<=6;n++){
   const slot=String(n).padStart(2,'0');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/athlete');
   await page.getByRole('heading',{name:'Hi, St. George’s Athlete '+slot,exact:true}).waitFor();checks++;
   assert.deepEqual(await page.locator('.hub-main').locator('h1, .hub-premium-standard, .hub-parent-week-focus, .hub-school-day-picker').evaluateAll(nodes=>nodes.map(node=>node.tagName==='H1'?'greeting':node.classList.contains('hub-premium-standard')?'standard':node.classList.contains('hub-parent-week-focus')?'focus':'days')),['greeting','standard','focus','days']);
   ok(await page.locator('.hub-school-day-picker a').count()===3,'two coached days and optional home day');
   ok(await page.locator('.hub-school-day-picker a').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('26, 61, 42')),'school athlete day cards use the academy green gradient');
   ok(await page.locator('.hub-school-day-picker').innerText().then(t=>t.includes('Movement foundations')&&t.includes('Capacity and control')&&t.includes('Optional home day')),'school cards show session purpose');
   await page.getByRole('navigation',{name:'Choose training day'}).getByRole('link',{name:/^Day 1\b/}).click();
   await page.getByRole('heading',{name:'Day 1 · Movement foundations',exact:true}).waitFor();
   const march=page.locator('.hub-athlete-movement').filter({has:page.getByText('A-March',{exact:true})});
   await march.waitFor({state:'visible'});
   ok(await page.locator('.hub-athlete-session-group').count()===0,'Saints day omits Form selector');
   ok(!await page.locator('.hub-main').innerText().then(t=>t.includes('Choose your Form')),'Saints day has no Form prompt');
   const warmup=page.locator('.hub-athlete-warmup');if(await warmup.count()&&!await warmup.evaluate(e=>e.open))await warmup.locator('summary').click();
   ok(await page.locator('[data-completion-toggle]').count()===0,'school athlete never has completion controls');
   ok(await march.getByText('1 × 20 m',{exact:true}).isVisible(),'A-March prescription is exact and visible');
   ok(await march.getByText('Rest: Walk-back recovery',{exact:true}).isVisible(),'A-March recovery is exact and visible');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'workout fits viewport');
   // Assigned session instructions stay visible while library technique is collapsed.
   ok(await march.getByText('For this session Stay tall; controlled rhythm.',{exact:true}).isVisible(),'A-March cue is exact and visible without opening tips');
   await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}});});
   await page.locator('[data-athlete-copy]').click();
   const athleteCopy=await page.evaluate(()=>window.__copied);
   ok(/\d+\. A-March — 1 × 20 m · Rest: Walk-back recovery\n   Demo: https:\/\/www\.youtube\.com\/shorts\/4lQsMyKRRn8/.test(athleteCopy),'athlete copy places the correct demo beneath the numbered exact dose and rest');
   ok(!/Stay tall; controlled rhythm|How to do it:|Coach cue:|Watch for:|For this session:|Coach instructions:|Full programme instructions/.test(athleteCopy),'athlete copy excludes portal-only coaching text');
   const views=page.getByRole('group',{name:'Workout views'});
   ok(await views.getByRole('button',{name:'Workout',pressed:true,exact:true}).isVisible(),'Workout is selected on entry');
   assert.deepEqual(await views.getByRole('button').allTextContents(),['Workout','Full-screen demos']);checks++;
   ok(await march.locator('details').count()>=1,'Workout provides optional expandable demo previews');
   const fullScreen=views.getByRole('button',{name:'Full-screen demos',exact:true});
   await fullScreen.click();
   const presenter=page.getByRole('dialog',{name:'Exercise demos'});
   ok(await presenter.getByRole('heading',{name:'A-March',exact:true}).isVisible(),'presenter starts at the first assigned demo');
   ok(await presenter.getByText('1 × 20 m · Rest: Walk-back recovery',{exact:true}).isVisible(),'presenter preserves dosage and rest');
   ok(await presenter.locator('footer').evaluate(footer=>footer.getBoundingClientRect().bottom<=innerHeight+1),'navigation is reachable before playback');
   await presenter.getByRole('button',{name:'Play demo'}).click();
   ok((await presenter.locator('iframe').getAttribute('src')).includes('/embed/4lQsMyKRRn8'),'presenter uses the same assigned demo');
   ok(await presenter.getByRole('link',{name:'Open on YouTube'}).getAttribute('href')==='https://www.youtube.com/shorts/4lQsMyKRRn8','presenter retains the original link');
   ok(await presenter.evaluate(el=>el.scrollWidth<=el.clientWidth&&Math.abs(el.clientHeight-innerHeight)<=1),'presenter fills the viewport without horizontal scrolling');
   ok(await presenter.locator('footer').evaluate(footer=>footer.getBoundingClientRect().bottom<=innerHeight+1),'navigation stays in reach after opening the video');
   await presenter.getByRole('button',{name:'Close',exact:true}).click();
   await presenter.waitFor({state:'detached'});
   ok(await views.getByRole('button',{name:'Workout',pressed:true,exact:true}).isVisible(),'closing presenter returns to Workout');
   ok(await fullScreen.evaluate(el=>el===document.activeElement),'closing restores focus to Full-screen demos');
   await page.locator('[data-athlete-copy]').click();
   ok(await page.evaluate(()=>window.__copied)===athleteCopy,'copy stays identical after presentation');
   ok(await page.locator('[data-completion-toggle]').count()===0,'presentation has no completion controls');
   await page.getByRole('link',{name:'← Back to Week'}).click();
   await page.getByRole('navigation',{name:'Choose training day'}).getByRole('link',{name:/^Day 2\b/}).click();
   await views.getByRole('button',{name:'Workout',pressed:true,exact:true}).waitFor();checks++;
   ok(await page.getByText('Stay balanced.',{exact:false}).first().isVisible(),'Day 2 keeps assigned coaching cues on Workout');
   ok(await page.getByText('Stop if pain increases.',{exact:false}).first().isVisible(),'Day 2 keeps safety guidance on Workout');
   await fullScreen.click();
   await presenter.getByRole('button',{name:'Next',exact:true}).click();
   ok(await presenter.getByRole('heading',{name:'Snap Down',exact:true}).isVisible(),'Day 2 presenter follows assigned exercise order');
   ok(await presenter.getByText('3 × 3 · Rest: 60 seconds',{exact:true}).isVisible(),'Day 2 presenter keeps assigned dose and rest');
   await presenter.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('link',{name:'← Back to Week'}).click();
   await page.getByRole('navigation',{name:'Choose training day'}).getByRole('link',{name:/^Day 3\b/}).click();
   await fullScreen.click();
   const schoolWorkout=new URL(page.url()).hash;
   await presenter.getByRole('heading',{name:'Broad Jump + Stick',exact:true}).waitFor();
   for(const heading of ['Step-Up','Ankle Rock']){
    await presenter.getByRole('button',{name:'Play demo'}).click();
    await presenter.locator('iframe').waitFor();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await presenter.getByRole('button',{name:'Next',exact:true}).click();
    await presenter.getByRole('heading',{name:heading,exact:true}).waitFor();
    ok(new URL(page.url()).hash===schoolWorkout,'video and Next stay on the school workout');
   }
   await presenter.getByRole('button',{name:'Previous',exact:true}).click();
   await presenter.getByRole('heading',{name:'Step-Up',exact:true}).waitFor();
   await presenter.getByRole('button',{name:'Close',exact:true}).click();
   ok(new URL(page.url()).hash===schoolWorkout,'closing stays on the school workout');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/routines');
   await page.locator('.hub-card').filter({hasText:'ASIM Warm-Up'}).waitFor();checks++;
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no viewport overflow');
  }
  ok(athleteCompletionCalls.length===0,'school athlete views neither load nor save completion');
  await page.goto('http://127.0.0.1:4173/qa/director#/hub/staff');
  await page.getByRole('heading',{name:'Programme Overview',exact:true}).waitFor();checks++;
  ok(await page.locator('.saints-director-hero').evaluate(el=>getComputedStyle(el).backgroundImage.includes('26, 61, 42')),'director overview uses the academy forest-green panel');
  ok(await page.locator('.saints-director-kicker').evaluate(el=>getComputedStyle(el).color==='rgb(220, 195, 140)'),'director overview uses the academy gold accent');
  await page.locator('.saints-director-attendance summary').click();
  ok(await page.locator('.hub-main').innerText().then(t=>t.includes('St. George’s')&&t.includes('St. George’s Athlete 06')),'director school identity and roster');
  ok(await page.locator('.hub-main').innerText().then(t=>['Land','Spring','Project','Own','February','Weeks 2–4 remain unreleased'].every(x=>t.includes(x))),'director sees read-only development roadmap');
  ok(await page.locator('#school-send, #coachFeedbackForm, [data-completion-toggle]').count()===0,'director has no upload, feedback or completion mutation controls');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
  ok(await page.locator('.ducc [data-athlete]').count()===6,'coach sees exactly six assigned athletes');
  ok(await page.locator('.ducc [data-day]').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')),'coach day cards render gradient');
  const coachDays=page.locator('.ducc [data-day]');
  ok(await coachDays.first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('26, 61, 42')),'coach day cards use the academy forest-green gradient');
  ok(await page.locator('.ducc [data-day].selected').first().evaluate(el=>getComputedStyle(el).borderTopColor==='rgb(199, 162, 90)'),'selected coach day has the website gold outline');
  ok(await page.getByRole('heading',{name:'Team Command',exact:true}).evaluate(el=>getComputedStyle(el).fontFamily.includes('Playfair Display')),'coach heading uses the website display font');
  await page.locator('[data-att-week]').waitFor();
  await page.locator('[data-att-week]').selectOption('2');
  await page.locator('[data-att-week] option[value="2"][selected]').waitFor({state:'attached'});checks++;
  const dates={390:['2026-10-19','2026-10-21'],375:['2026-10-18','2026-10-20'],430:['2026-10-17','2026-10-19'],768:['2026-10-16','2026-10-18'],1440:['2026-10-15','2026-10-17']}[width];
  const person=width===390?'fixture-athlete-1':'fixture-athlete-2';
  await page.locator('[data-att-date="1"]').fill(dates[0]);
  const choose=async(day,status)=>{
   await page.locator('[data-att-daytab="'+day+'"]').click();
   const row=page.locator('[data-att-panel="'+day+'"] .att-compact-row').filter({has:page.locator('[data-athlete="'+person+'"]')});
   if(await row.locator('[data-att-status]').inputValue()!==status)await row.locator('[data-att-choice="'+status+'"]').click();
  };
  await choose(1,'present');
  await page.locator('[data-att-daytab="2"]').click();
  await page.locator('[data-att-date="2"]').fill(dates[1]);
  await choose(2,'present');
  let failOnce=true;
  await page.route('**/functions/v1/hub-data',async route=>{
   if(failOnce&&route.request().postDataJSON()?.action==='attendance-save'){failOnce=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic weak-Wi-Fi failure'})});}
   return route.fallback();
  });
  await page.locator('[data-att-save]').click();
  await page.getByRole('status').filter({hasText:'Not saved. Your edits are still here.'}).waitFor();checks++;
  ok(await page.locator('[data-att-status][data-athlete="'+person+'"][data-day="1"]').inputValue()==='present','failed save retains edits');
  await page.locator('[data-att-save]').click();
  await page.getByRole('status').filter({hasText:'Attendance saved.'}).waitFor();checks++;
  await page.reload();await page.locator('[data-att-week]').waitFor();
  await page.locator('[data-att-week]').selectOption('2');
  await page.locator('[data-att-week] option[value="2"][selected]').waitFor({state:'attached'});
  ok(await page.locator('[data-att-status][data-athlete="'+person+'"][data-day="2"]').inputValue()==='present','reconciliation persists after refresh');
  await page.goto('http://127.0.0.1:4173/qa/director#/hub/staff');
  await page.locator('.saints-director-attendance summary').click();
  await page.locator('[data-att-week]').waitFor();await page.locator('[data-att-week]').selectOption('2');
  await page.locator('[data-att-week] option[value="2"][selected]').waitFor({state:'attached'});
  for(const day of [1,2]){
   await page.locator('[data-att-daytab="'+day+'"]').click();
   ok(await page.locator('[data-att-panel="'+day+'"] .att-compact-row').filter({hasText:width===390?'Athlete 01':'Athlete 02'}).innerText().then(t=>t.includes('Attended')&&t.includes(dates[day-1])),'director sees shared coach register and actual date');
  }
  ok(await page.locator('[data-att-save],[data-att-status]').count()===0,'director cannot change attendance');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'attendance view fits viewport');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');
  await page.locator('.ducc [data-action="workout"]').first().click();
  await page.getByRole('button',{name:'Copy complete workout',exact:true}).waitFor();checks++;
  ok(await page.locator('[data-completion-toggle]').count()===0,'staff stays read only');
  await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}});});
  await page.getByRole('button',{name:'Copy complete workout',exact:true}).click();
  ok(await page.evaluate(()=>['A-March','1 × 20 m','Walk-back recovery'].every(t=>window.__copied.includes(t))&&!/Stay tall; controlled rhythm|https:/.test(window.__copied)),'coach copy contains the assigned dose and rest');
  await page.locator('.ducc [data-action="back"]').click();
  await page.locator('.ducc [data-day="1"]').click();
  const workoutBlocks=page.locator('.ducc .workout-section > h3');
  ok((await workoutBlocks.allTextContents()).join('|')==='Warm-up|Plyometric skills','Day 2 includes warm-up before skills');
  await page.evaluate(()=>{window.__printSnapshot=null;window.print=()=>{const root=document.querySelector('.ducc');window.__printSnapshot=root.querySelector('.print-sheet').textContent;};});
  await page.locator('.ducc [data-action="print"]').click();
  await page.getByRole('button',{name:'Print or save PDF',exact:true}).click();
  ok(await page.evaluate(()=>['2 × 8','30 seconds','3 × 3','60 seconds'].every(t=>window.__printSnapshot.includes(t))&&!/Move smoothly|Stay balanced|Demo:/.test(window.__printSnapshot)),'print includes warm-up, skills, dose and rest');
  ok(await page.locator('.ducc .coaching-views [aria-current="true"]').textContent()==='Workout','print leaves Workout selected');
  ok(await page.locator('.print-sheet .print-brand').textContent()==='DU AIRLINES ELITE ACADEMY','print uses the academy name');
  await page.emulateMedia({media:'print'});
  ok(await page.locator('.hub-topbar').evaluate(e=>getComputedStyle(e).display==='none'),'print hides navigation');
  ok(await page.locator('#schoolAttendanceRoot').evaluate(e=>getComputedStyle(e).display==='none'),'print excludes register');
  ok(await page.locator('.hub-premium-routines').evaluate(e=>getComputedStyle(e).display==='none'),'print excludes routine navigation');
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Back to workout',exact:true}).click();
  ok(await workoutBlocks.first().isVisible(),'closing print returns to the same warm-up');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'coach Day 2 fits viewport');

  ok(errors.length===0,'no page errors: '+errors.join('; '));
  await context.close();
 }
 console.log('School identity browser QA: '+checks+' checks passed at 375px, 390px, 430px, 768px and 1440px. Synthetic backend; no live Supabase or video playback verification.');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
