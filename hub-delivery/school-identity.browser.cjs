'use strict';
// Real Chromium rendering against synthetic local records. No production writes.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs'],{stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 const browser=await chromium.launch({headless:true});let checks=0;
 const ok=(value,message)=>{assert.ok(value,message);checks++;};
 try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:4173/')?route.continue():route.abort());
  for(let n=1;n<=6;n++){
   const slot=String(n).padStart(2,'0');
   await page.goto('http://127.0.0.1:4173/qa/'+slot+'#/hub/athlete');
   await page.getByRole('heading',{name:'Hi, St. George’s Athlete '+slot,exact:true}).waitFor();checks++;
   await page.locator('[aria-label="Choose training day"] a').first().click();
   const toggle=page.locator('[data-completion-toggle]').first();await toggle.waitFor();
   // A different athlete remains incomplete despite preceding athlete's activity.
   if(width===390)ok(await toggle.getAttribute('data-completed')==='false','independent initial progress '+slot);
   if(await toggle.getAttribute('data-completed')==='true'){await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='false');}
   await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');checks++;
   await page.reload();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');checks++;
   ok(await page.locator('.hub-main').innerText().then(t=>t.includes('1 × 20 m')&&t.includes('Walk-back recovery')),'dose and rest preserved');
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
  ok(await page.locator('#school-send, #coachFeedbackForm, [data-completion-toggle]').count()===0,'director has no upload, feedback or completion mutation controls');
  await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
  ok(await page.locator('.ducc [data-athlete]').count()===6,'coach sees exactly six assigned athletes');
  await page.locator('.ducc [data-action="workout"]').first().click();
  await page.getByRole('button',{name:'Copy complete workout',exact:true}).waitFor();checks++;
  ok(await page.locator('[data-completion-toggle]').count()===0,'staff stays read only');
  ok(errors.length===0,'no page errors: '+errors.join('; '));
  await context.close();
 }
 console.log('School identity browser QA: '+checks+' checks passed at 390px and 1440px. Synthetic backend; no live Supabase or video playback verification.');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
