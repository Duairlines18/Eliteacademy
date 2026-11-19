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
    const section=page.locator('.ducc details.section').last();
    assert.equal(await section.evaluate(el=>el.open),false,'workout block starts compact');checks++;
    await section.locator(':scope > summary').click();
    const detail=section.locator('.movement-detail').last();
    assert.equal(await detail.evaluate(el=>el.open),false,'technique starts collapsed');checks++;
    assert.ok((await section.innerText()).includes('Stay balanced.'),'assigned session cue remains visible');checks++;
    await detail.locator('summary').click();
    await detail.locator('[data-video]').last().click();
    assert.ok((await page.locator('.ducc iframe').getAttribute('src')).includes('4lQsMyKRRn8'));checks++;
    await page.locator('.ducc [data-action="close-video"]').click();
    await page.evaluate(()=>{window.print=()=>{};});
    await page.locator('.ducc [data-action="print"]').click();
    assert.equal(await page.locator('.print-day').count(),1);checks++;
    assert.ok((await page.locator('.print-day').textContent()).includes('Capacity and control'));checks++;
    await page.locator('.ducc [data-action="print-week"]').click();
    assert.ok(await page.locator('.print-day').count()>1);checks++;
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.ducc .print-sheet').isVisible(),true);
    assert.equal(await page.locator('.ducc main').isVisible(),false);
    assert.equal(await page.locator('#schoolAttendanceRoot').isVisible(),false);checks+=3;
    await page.emulateMedia({media:'screen'});
    await page.locator('.ducc [data-action="present"]').click();
    await page.getByRole('region',{name:'Workout presentation'}).waitFor();
    assert.equal(await page.locator('.ducc .roster').count(),0);checks++;
    await page.locator('.ducc [data-action="next-block"]').click();
    const projection=await page.locator('.ducc .presentation').innerText();
    for(const value of ['3 × 3','60 seconds','Stay balanced.'])assert.ok(projection.includes(value),value);
    assert.ok(await page.locator('.ducc .presentation').evaluate(el=>el.scrollWidth<=el.clientWidth));checks+=4;
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Full Workout',exact:true}).waitFor();
    await page.locator('.ducc [data-day="0"]').click();
    assert.ok((await page.locator('.ducc .workout-head').innerText()).includes('Movement foundations'));checks++;
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
