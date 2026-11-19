'use strict';
// Synthetic authenticated coach records; no live athlete data or writes.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs'],{stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 let browser;
 let checks=0;
 const evidence=process.env.DU_COACHING_EVIDENCE;
 if(evidence)await fs.mkdir(evidence,{recursive:true});
 async function verifyPrintPages(page,name,expected){
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({path:evidence?path.join(evidence,name+'.pdf'):undefined,format:'A4',preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
  // Chromium emits the page dictionaries outside its compressed content streams.
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,expected,name+' pagination');
  checks++;
 }
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
     assert.ok(await page.getByText('Synthetic browser test only.',{exact:true}).isVisible());checks++;
     if(evidence&&route==='staff'&&[390,1440].includes(width))
      await page.locator('.ducc').screenshot({path:path.join(evidence,'school-week-'+width+'.png')});
     await page.locator('.ducc [data-day="1"]').click();
    }
    await page.getByRole('heading',{name:'Full Workout',exact:true}).waitFor();
    assert.ok(await page.locator('.ducc').innerText().then(t=>t.includes('Capacity and control')),'requested day opens');checks++;
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__copied=t}})});
    await page.locator('.ducc [data-action="copy"]').first().click();
    const copied=await page.evaluate(()=>window.__copied);
    assert.match(copied,/WARM-UP\n1\. A-March — 2 × 8 · Rest: 30 seconds/);checks++;
    assert.match(copied,/Snap Down — 3 × 3 · Rest: 60 seconds/);checks++;
    assert.doesNotMatch(copied,/How to do it|Watch for|Move smoothly|Stay balanced|https:/);checks++;
    const section=page.locator('.ducc details.section').last();
    assert.equal(await section.evaluate(el=>el.open),false,'workout block starts compact');checks++;
    await section.locator(':scope > summary').click();
    const detail=section.locator('.movement-detail').last();
    assert.equal(await detail.evaluate(el=>el.open),false,'technique starts collapsed');checks++;
    assert.ok((await section.innerText()).includes('Stay balanced.'),'assigned session cue remains visible');checks++;
    assert.ok((await section.innerText()).includes('Drop quickly into a shallow landing.'));checks++;
    if(evidence&&route==='staff'&&[390,1440].includes(width)){
     await page.locator('.ducc .warmup > summary').click();
     await page.locator('.ducc').screenshot({path:path.join(evidence,'coaching-workout-'+width+'.png')});
     if(width===1440)await fs.writeFile(path.join(evidence,'Copy-Workout.txt'),copied+'\n');
    }
    await detail.locator('summary').click();
    await detail.locator('[data-video]').last().click();
    assert.ok((await page.locator('.ducc iframe').getAttribute('src')).includes('Dv6blgFNo28'));checks++;
    await page.locator('.ducc [data-action="close-video"]').click();
    await page.evaluate(()=>{window.print=()=>{};});
    await page.locator('.ducc [data-action="print"]').click();
    assert.equal(await page.locator('.print-day').count(),1);checks++;
    assert.ok((await page.locator('.print-day').textContent()).includes('Capacity and control'));checks++;
    const printDay=await page.locator('.print-day').textContent();
    assert.match(printDay,/A-March — 2 × 8 · Rest: 30 seconds.*Snap Down — 3 × 3 · Rest: 60 seconds/);checks++;
    assert.doesNotMatch(printDay,/How to do it|Watch for|Move smoothly|Stay balanced|Demo:/);checks++;
    if(route==='staff'&&width===1440)await verifyPrintPages(page,'Print-Day',1);
    await page.locator('.ducc [data-action="print-week"]').click();
    assert.equal(await page.locator('.print-day').count(),3);checks++;
    if(route==='staff'&&width===1440)await verifyPrintPages(page,'Print-Week',1);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.ducc .print-sheet').isVisible(),true);
    assert.equal(await page.locator('.ducc main').isVisible(),false);
    assert.equal(await page.locator('#schoolAttendanceRoot').isVisible(),false);
    assert.equal(await page.locator('.hub-shell > :not(.hub-main), .hub-wrap > :not(#du-coach-command-root)').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).display==='none')),true);checks+=4;
    await page.emulateMedia({media:'screen'});
    await page.locator('.ducc [data-action="present"]').click();
    await page.getByRole('region',{name:'Workout presentation'}).waitFor();
    assert.equal(await page.locator('.ducc .roster').count(),0);checks++;
    const presenter=page.getByRole('region',{name:'Workout presentation'});
    assert.equal(await presenter.locator('.presentation-progress').textContent(),'1 of 2');checks++;
    assert.ok(await presenter.getByRole('button',{name:'Previous',exact:true}).isDisabled());checks++;
    await page.keyboard.press('ArrowRight');
    assert.equal(await presenter.locator('.presentation-progress').textContent(),'2 of 2');checks++;
    const projection=await presenter.innerText();
    for(const value of ['3 × 3','60 seconds','Stay balanced.','Stop if pain increases.'])assert.ok(projection.includes(value),value);
    assert.ok(await page.locator('.ducc .presentation').evaluate(el=>el.scrollWidth<=el.clientWidth));checks+=5;
    if(evidence&&route==='staff'&&[768,1440].includes(width))
     await page.screenshot({path:path.join(evidence,'projector-'+width+'.png')});
    assert.ok(!projection.includes('Drop quickly into a shallow landing.'));checks++;
    const detailToggle=presenter.getByText('Coach Details',{exact:true});
    await detailToggle.click();
    assert.ok(await presenter.getByText('Drop quickly into a shallow landing.',{exact:false}).isVisible());checks++;
    await detailToggle.click();
    await presenter.getByRole('button',{name:'Watch Demo',exact:true}).click();
    const video=page.getByRole('dialog',{name:'Exercise demonstration',exact:true});
    assert.match(await video.locator('iframe').getAttribute('src'),/Dv6blgFNo28$/);checks++;
    assert.ok(await video.locator('iframe').evaluate(e=>e.getBoundingClientRect().height>e.getBoundingClientRect().width));checks++;
    assert.match(await video.getByRole('link',{name:'open it on YouTube'}).getAttribute('href'),/shorts\/Dv6blgFNo28$/);checks++;
    assert.doesNotMatch(await video.locator('iframe').getAttribute('allow'),/autoplay/);checks++;
    await page.keyboard.press('Escape');
    await video.waitFor({state:'detached'});checks++;
    assert.equal(await presenter.locator('.presentation-progress').textContent(),'2 of 2');checks++;
    assert.ok(await presenter.getByRole('button',{name:'Watch Demo',exact:true}).evaluate(e=>document.activeElement===e));checks++;
    await page.keyboard.press('ArrowLeft');
    assert.ok(await presenter.getByRole('heading',{name:'A-March',exact:true}).isVisible());checks++;
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Full Workout',exact:true}).waitFor();
    assert.ok((await page.locator('.ducc .workout-head').innerText()).includes('Capacity and control'));checks++;
    if(route==='staff'){
     await page.locator('.ducc [data-day="2"]').click();
     assert.ok((await page.locator('.ducc .workout-head').innerText()).includes('OPTIONAL EXTRA'));checks++;
     await page.locator('.ducc [data-action="present"]').click();
     for(const [heading,tokens] of [
      ['Sprint technique',['3 × 40 m at 75%','Walk back.']],
      ['Jump technique',['Broad Jump + Stick','2 × 3','60 seconds']],
      ['Strength',['Step-Up','2 × 6 per side','45 seconds']],
      ['Mobility',['Ankle Rock','1 × 8 per side']],
      ['Recovery',['Walk easily for 2 minutes.']],
     ]){
      await page.locator('.presentation-block').getByText(heading,{exact:true}).waitFor();
      const slide=await page.locator('.presentation').innerText();
      for(const token of tokens){assert.ok(slide.includes(token),token);checks++;}
      if(heading==='Recovery'){assert.ok(slide.includes('No video for this exercise.'));checks++;}
      const next=page.locator('.presentation [data-action="next-slide"]');
      if(await next.isEnabled())await next.click();
     }
     await page.locator('.ducc [data-action="exit-present"]').click();
    }
    await page.locator('.ducc [data-day="0"]').click();
    assert.ok((await page.locator('.ducc .workout-head').innerText()).includes('Movement foundations'));checks++;
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits viewport');checks++;
    await page.locator('.ducc [data-action="back"]').click();
    await page.getByRole('heading',{name:'Team Command',exact:true}).waitFor();checks++;
   }
   await page.goto('http://127.0.0.1:4173/qa/01#/hub/session/fixture-day-1');
   await page.locator('.hub-athlete-one-sheet').waitFor();
   assert.equal(await page.locator('.ducc').count(),0,'athlete route keeps its own view');checks++;
   if(evidence&&width===390)
    await page.locator('.hub-main').screenshot({path:path.join(evidence,'athlete-workout-390.png')});
   if(width===1440){
    await page.goto('http://127.0.0.1:4173/qa/staff#/hub/staff');
    await page.locator('.ducc').waitFor();
    await page.waitForTimeout(200);
    // Exercise counts match the three published Saints days. Use synthetic doses and names.
    await page.evaluate(()=>{
     const exercises=Array.from({length:17},(_,i)=>({code:'test-'+i,title:'Single-leg jump and balance variation '+(i+1)}));
     const sessions=[17,17,11].map((count,i)=>({day:'Day '+(i+1),title:'Plyometrics and Stability',requirement:i===2?'Optional':'',prescriptions:exercises.slice(0,count).map((exercise,j)=>({
      exerciseCode:exercise.code,sectionTitle:['Warm-up','Jump technique','Stability'][Math.floor(j/6)],sectionOrder:Math.floor(j/6),
      dosage:'3 × 6 each side at 75%',rest:'60 seconds between sets',
     }))}));
     window.DuCoachCommand.mount(document.getElementById('du-coach-command-root'),{
      role:'staff',cohort:{name:'Synthetic school cohort',currentWeek:1},programme:{sessions},exercises,
     });
     window.print=()=>{};
    });
    await page.locator('.ducc [data-day="1"]').click();
    await page.locator('.ducc [data-action="print"]').click();
    assert.equal(await page.locator('.print-day li').count(),17);checks++;
    await verifyPrintPages(page,'Print-Day-17-rows',1);
    await page.locator('.ducc [data-action="print-week"]').click();
    assert.equal(await page.locator('.print-day li').count(),45);checks++;
    await verifyPrintPages(page,'Print-Week-45-rows',1);
    await page.setViewportSize({width:1440,height:810});
    await page.evaluate(()=>{
     const exercise={code:'long-jump',title:'Single-Leg Broad Jump and Stick with Controlled Two-Foot Landing',videoUrl:'https://www.youtube.com/watch?v=Dv6blgFNo28'};
     const dosage='3 rounds of 6 repetitions at 75% effort with a deliberate three-second pause on each landing';
     window.DuCoachCommand.mount(document.getElementById('du-coach-command-root'),{
      role:'staff',cohort:{id:'wide-test',name:'Long-content fixture'},exercises:[exercise],
      programme:{sessions:[{id:'wide-test',title:'Projector layout test',prescriptions:[
       {exerciseCode:'long-jump',dosage,rest:'90 seconds between rounds',sectionTitle:'Main session',cues:'Hold each landing.'},
      ]}]},
     },{initialSessionId:'wide-test'});
    });
    await page.getByRole('button',{name:'Present workout'}).click();
    const widePresenter=page.getByRole('region',{name:'Workout presentation'});
    assert.equal(await widePresenter.locator('.presentation-progress').textContent(),'1 of 1');checks++;
    assert.ok(await widePresenter.getByRole('button',{name:'Next',exact:true}).isDisabled());checks++;
    assert.ok(await widePresenter.evaluate(e=>e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight));checks++;
    await widePresenter.getByRole('button',{name:'Watch Demo'}).click();
    const widePlayer=page.getByRole('dialog',{name:'Exercise demonstration'});
    assert.ok(await widePlayer.locator('iframe').evaluate(e=>e.clientWidth>e.clientHeight));checks++;
    await widePlayer.getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(await widePresenter.locator('.presentation-progress').textContent(),'1 of 1');checks++;
   }
   assert.deepEqual(errors,[]);checks++;
   await page.close();
  }
  console.log(checks+' coach route parity checks passed at phone, tablet and laptop widths.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1)});
