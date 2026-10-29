'use strict';
// Synthetic authenticated coach records; no live athlete data or writes.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs'],{stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 let browser;
 let checks=0;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')});
  for(const width of [390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4173/')?r.continue():r.abort());
   for(const route of ['staff','current-week','session/fixture-day-2']){
    await page.goto('http://127.0.0.1:4173/qa/staff#/hub/'+route);
    await page.locator('.ducc').waitFor({timeout:5000});
    // Hub startup schedules a second render after its account recovery check.
    await page.waitForTimeout(200);
    if(!route.startsWith('session/')){
     await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();
     await page.locator('.ducc [data-day="1"]').click();
    }
    await page.getByRole('heading',{name:'Full Workout',exact:true}).waitFor();
    assert.ok(await page.locator('.ducc').innerText().then(t=>t.includes('Capacity and control')),'requested day opens');checks++;
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__copied=t}})});
    await page.locator('.ducc [data-action="copy"]').first().click();
    assert.ok(await page.evaluate(()=>['Day 2','A-March','2 × 8','30 seconds','Move smoothly.','3 × 3','60 seconds','Stay balanced.','4lQsMyKRRn8'].every(t=>window.__copied.includes(t))),'complete workout export');checks++;
    await page.locator('.coach-cue summary').last().click();
    assert.ok(await page.locator('.coach-cue[open]').innerText().then(t=>t.includes('Stay balanced.')));checks++;
    await page.locator('.ducc [data-video]').last().click();
    assert.ok((await page.locator('.ducc iframe').getAttribute('src')).includes('4lQsMyKRRn8'));checks++;
    await page.locator('.ducc [data-action="close-video"]').click();
    await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=[...document.querySelectorAll('.ducc details')].every(d=>d.open)}});
    await page.locator('.ducc [data-action="print"]').click();
    assert.equal(await page.evaluate(()=>window.__printed),true);checks++;
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits viewport');checks++;
    await page.locator('.ducc [data-action="back"]').click();
    await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
   }
   await page.goto('http://127.0.0.1:4173/qa/01#/hub/session/fixture-day-1');
   await page.locator('.hub-athlete-one-sheet').waitFor();
   assert.equal(await page.locator('.ducc').count(),0,'athlete route keeps its own view');checks++;
   assert.deepEqual(errors,[]);checks++;
   await page.close();
  }
  console.log(checks+' coach route parity checks passed at phone, tablet and laptop widths.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1)});
