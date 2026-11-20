'use strict';
// Real Chromium rendering against synthetic local records. No production writes.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs','--extended-athlete-workout'],{stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 const browser=await chromium.launch({headless:true});let checks=0;
 const ok=(value,message)=>{assert.ok(value,message);checks++;};
 try{
 for(const width of [390,375,430,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:4173/')?route.continue():route.abort());
  for(let n=1;n<=6;n++){
   const slot=String(n).padStart(2,'0');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/athlete');
   await page.getByRole('heading',{name:'Hi, St. George’s Athlete '+slot,exact:true}).waitFor();checks++;
   ok(await page.locator('.hub-school-day-picker a').count()===3,'two coached days and optional home day');
   ok(await page.locator('.hub-school-day-picker a').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')),'school day cards render gradient');
   ok(await page.locator('.hub-school-day-picker').innerText().then(t=>t.includes('Movement foundations')&&t.includes('Capacity and control')&&t.includes('Optional home day')),'school cards show session purpose');
   await page.getByRole('navigation',{name:'Choose training day'}).getByRole('link',{name:/^Day 1\b/}).click();
   await page.getByRole('heading',{name:'Day 1 · Movement foundations',exact:true}).waitFor();
   const march=page.locator('.hub-athlete-movement').filter({has:page.getByText('A-March',{exact:true})});
   await march.waitFor({state:'attached'});
   ok(await page.locator('.hub-athlete-session-group').count()===0,'Saints day omits Form selector');
   ok(!await page.locator('.hub-main').innerText().then(t=>t.includes('Choose your Form')),'Saints day has no Form prompt');
   const warmup=page.locator('.hub-athlete-warmup');if(await warmup.count()&&!await warmup.evaluate(e=>e.open))await warmup.locator(':scope > summary').click();
   await march.waitFor({state:'visible'});
   ok(await page.locator('[data-completion-toggle]').count()===0,'school athlete never has completion controls');
   ok(await march.getByText('1 × 20 m',{exact:true}).isVisible(),'A-March prescription is exact and visible');
   ok(await march.getByText('Rest: Walk-back recovery',{exact:true}).isVisible(),'A-March recovery is exact and visible');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'workout fits viewport');
   // Assigned session instructions stay visible while library technique is collapsed.
   ok(await march.getByText('Stay tall; controlled rhythm.',{exact:true}).isVisible(),'A-March cue is exact and visible without opening tips');
   await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}});});
   await page.locator('[data-athlete-copy]').click();
   const athleteCopy=await page.evaluate(()=>window.__copied);
   ok(/\d+\. A-March — 1 × 20 m · Rest: Walk-back recovery\n   Demo: https:\/\/www\.youtube\.com\/shorts\/4lQsMyKRRn8/.test(athleteCopy),'athlete copy places the correct demo beneath the numbered exact dose and rest');
   ok(!/Stay tall; controlled rhythm|How to do it:|Coach cue:|Watch for:|For this session:|Coach instructions:|Full programme instructions/.test(athleteCopy),'athlete copy excludes portal-only coaching text');
   const technique=march.locator('.hub-school-technique');
   const demo=march.getByRole('link',{name:'Watch demo for A-March'});
   ok((await demo.getAttribute('href'))==='https://www.youtube.com/shorts/4lQsMyKRRn8','assigned A-March link is exact');
   ok(await technique.evaluate(el=>!el.open),'technique starts collapsed');
   ok(await demo.isVisible()&&(await demo.boundingBox()).height>=44,'demo is visible immediately with a full mobile tap target');
   await demo.click();await page.locator('#hubVideoModal').waitFor({state:'visible'});
   ok(await page.locator('#hubVideoModalTitle').textContent()==='A-March','player identifies the exercise');
   ok(await page.locator('#hubVideoModal').evaluate(e=>!e.classList.contains('expanded')),'compact video default');
   ok(await page.locator('#hubVideoModal iframe').getAttribute('src').then(src=>src.includes('4lQsMyKRRn8')),'exact prescribed canonical demo');
   await page.locator('[data-hub-video-expand]').click();ok(await page.locator('#hubVideoModal').evaluate(e=>e.classList.contains('expanded')),'optional expand');
   await page.locator('[data-hub-video-close]').first().click();
   ok(await demo.evaluate(el=>el===document.activeElement),'closing the video returns focus to the workout');
   await technique.locator('summary').click();
   ok(await technique.getByText(/March forward and lift one knee/).isVisible(),'full technique remains available');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/routines');
   await page.locator('.hub-card').filter({hasText:'ASIM Warm-Up'}).waitFor();checks++;
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no viewport overflow');
  }
  await page.goto('http://127.0.0.1:4173/qa/01#/hub/athlete');
  await page.getByRole('navigation',{name:'Choose training day'}).getByRole('link',{name:/^Day 2\b/}).click();
  const sheet=page.locator('.hub-athlete-workout-sheet');
  await sheet.waitFor();
  const warmup=sheet.locator('.hub-athlete-warmup');
  ok(await warmup.evaluate(el=>!el.open),'nine-movement warm-up starts collapsed');
  ok(await sheet.getByText('Land firm. Stick it.',{exact:true}).isVisible(),'compact Snap Down cue is visible');
  ok(await sheet.getByText('Stop if pain increases.',{exact:false}).isVisible(),'exercise-specific stop guidance remains visible');
  ok(await sheet.getByText('2 × 8 each leg; regress to 1 set if needed',{exact:true}).isVisible(),'long prescription and regression remain visible');
  ok(await sheet.getByText('Stop or do fewer landings if you lose good form or control.',{exact:true}).isVisible(),'readiness instruction stays in the jumping section');
  ok(await sheet.getByText('Landing readiness and skill check',{exact:true}).count()===0,'readiness checklist has no standalone athlete card');
  const recovery=sheet.locator('.hub-athlete-training-block').filter({has:page.getByText('Recovery',{exact:true})});
  ok(await recovery.getByText(/Walk easily/).isVisible()&&await recovery.getByRole('link',{name:/Watch/}).count()===0,'no fake video action on recovery instructions');
  await warmup.locator(':scope > summary').click();
  ok(await warmup.locator('.hub-athlete-movement:visible').count()===9,'warm-up expands in the same workout screen');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expanded long training sheet fits viewport');
  await page.goto('http://127.0.0.1:4173/qa/director#/hub/staff');
  await page.getByRole('heading',{name:'Programme Overview',exact:true}).waitFor();checks++;
  await page.locator('.saints-director-attendance summary').click();
  ok(await page.locator('.hub-main').innerText().then(t=>t.includes('St. George’s')&&t.includes('St. George’s Athlete 06')),'director school identity and roster');
  ok(await page.locator('.hub-main').innerText().then(t=>['Land','Spring','Project','Own','February','Weeks 2–4 remain unreleased'].every(x=>t.includes(x))),'director sees read-only development roadmap');
  ok(await page.locator('#school-send, #coachFeedbackForm, [data-completion-toggle]').count()===0,'director has no upload, feedback or completion mutation controls');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
  ok(await page.locator('.ducc [data-athlete]').count()===6,'coach sees exactly six assigned athletes');
  ok(await page.locator('.ducc [data-day]').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')),'coach day cards render gradient');
  ok(await page.locator('.ducc [data-day]:not(.selected)').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('114, 27, 44')||getComputedStyle(el).backgroundImage.includes('114,27,44')),'Saints unselected coach day card uses crimson');
  ok(await page.locator('.ducc [data-day].selected').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('145, 35, 60')||getComputedStyle(el).backgroundImage.includes('145,35,60')),'Saints selected coach day card uses brighter crimson');
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
  ok(await page.locator('.ducc .warmup').count()===1,'Day 2 includes warm-up before skills');
  await page.evaluate(()=>{window.__printSnapshot=null;window.print=()=>{const root=document.querySelector('.ducc');window.__printSnapshot=root.querySelector('.print-sheet').textContent;};});
  await page.locator('.ducc [data-action="print"]').click();
  ok(await page.evaluate(()=>['2 × 8','30 seconds','3 × 3','60 seconds'].every(t=>window.__printSnapshot.includes(t))&&!/Move smoothly|Stay balanced|Demo:/.test(window.__printSnapshot)),'print includes warm-up, skills, dose and rest');
  ok(await page.locator('.ducc .warmup').evaluate(e=>!e.open),'print leaves warm-up collapsed');
  await page.emulateMedia({media:'print'});
  ok(await page.locator('.hub-topbar').evaluate(e=>getComputedStyle(e).display==='none'),'print hides navigation');
  ok(await page.locator('#schoolAttendanceRoot').evaluate(e=>getComputedStyle(e).display==='none'),'print excludes register');
  ok(await page.locator('.hub-premium-routines').evaluate(e=>getComputedStyle(e).display==='none'),'print excludes routine navigation');
  await page.emulateMedia({media:'screen'});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'coach Day 2 fits viewport');

  ok(errors.length===0,'no page errors: '+errors.join('; '));
  await context.close();
 }
 console.log('School identity browser QA: '+checks+' checks passed at 375px, 390px, 430px, 768px and 1440px. Synthetic backend; no live Supabase or video playback verification.');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
