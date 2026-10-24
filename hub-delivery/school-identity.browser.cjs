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
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:4173/')?route.continue():route.abort());
  for(let n=1;n<=6;n++){
   const slot=String(n).padStart(2,'0');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/athlete');
   await page.getByRole('heading',{name:'Hi, St. George’s Athlete '+slot,exact:true}).waitFor();checks++;
   ok(await page.locator('.hub-school-day-picker a').count()===3,'two coached days and optional home day');
   ok(await page.locator('.hub-school-day-picker').innerText().then(t=>t.includes('Movement foundations')&&t.includes('Capacity and control')&&t.includes('Optional home day')),'school cards show session purpose');
   await page.locator('[aria-label="Choose training day"] a').first().click();
   const warmup=page.locator('.hub-athlete-warmup');if(await warmup.count()&&!await warmup.evaluate(e=>e.open))await warmup.locator('summary').click();
   const toggle=page.locator('[data-completion-toggle]').first();await toggle.waitFor();
   // A different athlete remains incomplete despite preceding athlete's activity.
   if(width===390)ok(await toggle.getAttribute('data-completed')==='false','independent initial progress '+slot);
   if(await toggle.getAttribute('data-completed')==='true'){await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='false');}
   await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');checks++;
   await page.reload();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');checks++;
   if(await warmup.count()&&!await warmup.evaluate(e=>e.open))await warmup.locator('summary').click();
   ok(await page.locator('.hub-main').innerText().then(t=>t.includes('1 × 20 m')&&t.includes('Walk-back recovery')),'dose and rest preserved');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'workout fits viewport');
   await page.locator('.hub-athlete-tips summary').first().click();
   ok(await page.locator('.hub-athlete-tips[open]').innerText().then(t=>t.includes('Stay tall; controlled rhythm.')),'short technique cue expands');
   await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}});});
   await page.locator('[data-athlete-copy]').click();
   ok(await page.evaluate(()=>['A-March','1 × 20 m','Walk-back recovery','Stay tall; controlled rhythm.','4lQsMyKRRn8'].every(t=>window.__copied.includes(t))),'athlete copy contains full dose, rest, cue and matching demo');
   await page.locator('.hub-athlete-demo').first().click();await page.locator('#hubVideoModal').waitFor({state:'visible'});
   ok(await page.locator('#hubVideoModal').evaluate(e=>!e.classList.contains('expanded')),'compact video default');
   ok(await page.locator('#hubVideoModal iframe').getAttribute('src').then(src=>src.includes('4lQsMyKRRn8')),'exact prescribed canonical demo');
   await page.locator('[data-hub-video-expand]').click();ok(await page.locator('#hubVideoModal').evaluate(e=>e.classList.contains('expanded')),'optional expand');
   await page.locator('[data-hub-video-close]').first().click();
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/routines');
   await page.locator('.hub-card').filter({hasText:'ASIM Warm-Up'}).waitFor();checks++;
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no viewport overflow');
  }
  await page.goto('http://127.0.0.1:4173/qa/director#/hub/staff');
  await page.getByRole('heading',{name:'School Overview',exact:true}).waitFor();checks++;
  ok(await page.locator('.hub-main').innerText().then(t=>t.includes('Mr Chivandire')&&t.includes('St. George’s Athlete 06')),'director school identity and roster');
  ok(await page.locator('.hub-main').innerText().then(t=>['Land','Spring','Project','Own','February','Weeks 2–4 remain unreleased'].every(x=>t.includes(x))),'director sees read-only development roadmap');
  ok(await page.locator('#school-send, #coachFeedbackForm, [data-completion-toggle]').count()===0,'director has no upload, feedback or completion mutation controls');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
  ok(await page.locator('.ducc [data-athlete]').count()===6,'coach sees exactly six assigned athletes');
  await page.locator('[data-att-week]').waitFor();
  await page.locator('[data-att-week]').selectOption('2');
  await page.getByText('Week 2 of 4',{exact:true}).waitFor();checks++;
  const dates={390:['2026-10-19','2026-10-21'],375:['2026-10-18','2026-10-20'],430:['2026-10-17','2026-10-19'],768:['2026-10-16','2026-10-18'],1440:['2026-10-15','2026-10-17']}[width];
  const person=width===390?'fixture-athlete-1':'fixture-athlete-2';
  await page.locator('[data-att-date="1"]').fill(dates[0]);
  await page.locator('[data-att-date="2"]').fill(dates[1]);
  await page.locator('[data-att-status][data-athlete="'+person+'"][data-day="1"]').selectOption('present');
  await page.locator('[data-att-status][data-athlete="'+person+'"][data-day="2"]').selectOption('present');
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
  await page.getByText('Week 2 of 4',{exact:true}).waitFor();
  ok(await page.locator('[data-att-status][data-athlete="'+person+'"][data-day="2"]').inputValue()==='present','reconciliation persists after refresh');
  await page.goto('http://127.0.0.1:4173/qa/director#/hub/staff');
  await page.locator('[data-att-week]').waitFor();await page.locator('[data-att-week]').selectOption('2');
  await page.getByText('Week 2 of 4',{exact:true}).waitFor();
  ok(await page.locator('.att-row').filter({hasText:width===390?'Athlete 01':'Athlete 02'}).innerText().then(t=>t.includes('2/2 attended')&&t.includes(dates[0])&&t.includes(dates[1])),'director sees shared coach register and actual dates');
  ok(await page.locator('[data-att-save],[data-att-status]').count()===0,'director cannot change attendance');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'attendance view fits viewport');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');
  await page.locator('.ducc [data-action="workout"]').first().click();
  await page.getByRole('button',{name:'Copy complete workout',exact:true}).waitFor();checks++;
  ok(await page.locator('[data-completion-toggle]').count()===0,'staff stays read only');
  await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}});});
  await page.getByRole('button',{name:'Copy complete workout',exact:true}).click();
  ok(await page.evaluate(()=>['A-March','1 × 20 m','Walk-back recovery','Stay tall; controlled rhythm.','4lQsMyKRRn8'].every(t=>window.__copied.includes(t))),'coach copy contains dose, rest, cues and demo');
  await page.locator('.ducc [data-action="back"]').click();
  await page.locator('.ducc [data-day="1"]').click();
  ok(await page.locator('.ducc .warmup').count()===1,'Day 2 includes warm-up before skills');
  await page.evaluate(()=>{window.__printSnapshot=null;window.print=()=>{const root=document.querySelector('.ducc');window.__printSnapshot={expanded:[...root.querySelectorAll('details')].every(d=>d.open),text:root.innerText};};});
  await page.locator('.ducc [data-action="print"]').click();
  ok(await page.evaluate(()=>window.__printSnapshot.expanded&&['2 × 8','30 seconds','Move smoothly.','3 × 3','Stay balanced.'].every(t=>window.__printSnapshot.text.includes(t))),'print includes expanded warm-up, skills, rest and cues');
  ok(await page.locator('.ducc .warmup').evaluate(e=>!e.open),'print restores compact warm-up');
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
