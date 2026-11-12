'use strict';
// Browser-only fixtures: no real accounts, access codes, or backend writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 const exercises=[{id:'test',code:'TST01',title:'Test March',name:'Test March',category:['warm-up'],videoId:'abcdefghijk',videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',active:true}];
 const sessions=[{id:'warm',day:'Game Warm-Up',title:'Standard Warm-Up',duration:'5 minutes',watch:'Follow the assigned prescription.',prescriptions:[{sectionTitle:'Routine movements',exerciseCode:'TST01',dosage:'2 x 8'}]},{id:'core',day:'Core Routine',title:'Core Control',prescriptions:[{sectionTitle:'Core',exerciseCode:'TST01',dosage:'2 x 6'}]},{id:'d1',day:'Day 1',title:'Scheduled Strength',prescriptions:[{sectionTitle:'Strength',exerciseCode:'TST01',dosage:'3 x 8'}]}];
 sessions.push({id:'d2',day:'Day 2',title:'Assigned Air Zim day',prescriptions:[{sectionTitle:'Air Zim Warm-Up',exerciseCode:'TST01',dosage:'1 x 3'},{sectionTitle:'Main',sectionOrder:1,exerciseCode:'TST01',dosage:'4 x 5'}]}, {id:'d3',day:'Day 3',title:'Modified rehabilitation',watch:'No running or jumping.',prescriptions:[{sectionTitle:'Core',exerciseCode:'TST01',dosage:'1 x 2'}]});
 let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
 try{
 for(const width of [390,1440])for(const [audience,role] of [['parent','athlete'],['private-athlete','athlete'],['school','athlete'],['school','staff'],['professional','athlete']]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({audience,role,origin})=>{
   if(location.origin!==origin)return;
   localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify(audience==='school'?{role,token:'test-fixture'}:{role,mode:'account',audience}));
   window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-fixture'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};
  },{audience,role,origin:base});
  let completionWrites=0;const saved=new Map();
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();
   if(url.includes('/functions/v1/')){
    const body=req.postDataJSON()||{};let data={};
    if(body.action==='checkin-state')return route.fulfill({json:{checkins:{enabled:false}}});
   if(body.action==='profile')data={onboardingComplete:true,onboarding:audience==='private-athlete'?{sportPathway:'Track',primaryGoals:['Speed / acceleration'],trainingEnvironment:'Track / field',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Track twice\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}:{}};
    if(body.action==='bootstrap')data={contentStatus:'published',audience:audience==='school'?null:audience,cohort:{id:'test-school',name:'Test School',currentWeek:1},athlete:{displayName:'Test Athlete'},viewer:{firstName:'Test'},programme:{id:'test-programme',title:'Test Programme',school:'Test School',week:1,totalWeeks:6,sessions},exercises,delivery:{model:'private-athlete',copyWorkout:true}};
    if(body.action==='library')data={exercises};
    if(body.action==='list')data={completions:[...saved.values()]};
    if(body.action==='set'){completionWrites++;const row={sessionKey:body.sessionKey,itemKey:body.itemKey,completed:body.completed};saved.set(row.sessionKey+'|'+row.itemKey,row);data={completion:row};}
    return route.fulfill({json:data});
   }
   return route.abort();
  });
  await page.goto(base+'/#/hub/'+(role==='staff'?'staff':'athlete'));
  const shortcut=page.locator('.hub-premium-routines a');await shortcut.waitFor();await shortcut.click();
  await page.locator('.hub-main h1').filter({hasText:'Your Routines'}).waitFor();
  ok(await page.locator('.hub-main .hub-card').count()===3,`${audience}/${role}: two standalone and one day-specific assigned routine`);
  ok(!await page.locator('.hub-main').innerText().then(t=>t.includes('Scheduled Strength')),`${audience}/${role}: no scheduled training in routines list`);
  await page.locator('.hub-card').filter({hasText:'Standard Warm-Up'}).click();
  await page.locator('.hub-main h1').filter({hasText:'Standard Warm-Up'}).waitFor();
  ok(await page.locator('[aria-label="Choose training day"]').count()===0,`${audience}/${role}: no Day picker in routine`);
  ok(await page.locator('.hub-main').innerText().then(t=>t.includes('2 x 8')),`${audience}/${role}: assigned dose preserved`);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${audience}/${role}/${width}: fits viewport`);
  if(audience==='parent'){
   await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-workout-experience.guided').waitFor();
   ok(await page.locator('[aria-label="Choose training day"]').count()===0,'Guided toggle stays inside routine');
   const demo=page.locator('.hub-main a[href*="abcdefghijk"]').first();await demo.click();
   await page.locator('#hubVideoModal').waitFor({state:'visible'});
   ok(await page.locator('#hubVideoModal').evaluate(e=>!e.classList.contains('expanded')),'routine demo opens compact');
   await page.locator('[data-hub-video-close]').first().click();
   await page.locator('[data-completion-toggle]').first().click();
   await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');
   ok(completionWrites===1,'routine completion uses existing persistence');
   ok(await page.locator('[aria-label="Choose training day"]').count()===0,'completion keeps routine navigation');
  }
  await page.getByRole('link',{name:'← Your Routines',exact:true}).click();await page.locator('.hub-card').first().waitFor();
  await page.goBack();await page.locator('.hub-main h1').filter({hasText:'Standard Warm-Up'}).waitFor();
  await page.reload();await page.getByRole('link',{name:'← Your Routines',exact:true}).waitFor();
  await page.goto(base+(role==='staff'?'/#/hub/current-week':'/#/hub/session/d1'));
  if(role==='staff'){await page.locator('.ducc [data-day]').first().waitFor();}
  else {await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();ok(await page.locator('[aria-label="Choose training day"] a').count()===0,'workout has no sibling day cards');}
  if(role==='athlete'){
   await page.goto(base+'/#/hub/session/d2');await page.getByRole('link',{name:'Air Zim Warm-Up',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'Air Zim Warm-Up'}).waitFor();
   await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();
   ok(await page.locator('.hub-guided-step').innerText()==='1 of 1','Air Zim contains only its assigned movement');
   const completion=page.locator('[data-completion-toggle]');
   ok(await completion.getAttribute('data-session-key')==='d2'&&await completion.getAttribute('data-item-key')==='p:0:0:TST01','Air Zim retains original completion identity');
   ok((await page.locator('.hub-guided-meta').innerText()).includes('1 x 3'),'exact assigned Air Zim dose');
   ok(!(await page.locator('.hub-main').innerText()).includes('4 x 5'),'main workout stays separate');
   await completion.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');
   await page.reload();await page.locator('[data-workout-mode="guided"]').click();
   ok(await completion.getAttribute('data-completed')==='true','Air Zim completion persists after reload');
   await page.goto(base+'/#/hub/session/d3');await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();
   ok(await page.locator('[aria-label="Training stages"]').count()===0,'rehabilitation day receives no inferred standard warm-up');
   ok((await page.locator('.hub-objective').innerText()).includes('No running or jumping.'),'rehabilitation restrictions retained');
   await page.goto(base+'/#/hub/routines/day/someone-else/0');await page.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
   ok(await page.locator('[data-completion-toggle]').count()===0,'foreign routine route reveals no prescription or progress');
  }
  ok(errors.length===0,`${audience}/${role}: no browser errors: ${errors}`);
  await context.close();console.log(`Routines browser QA passed: ${audience}/${role} at ${width}px`);
 }
 console.log(`Routines browser QA: ${checks} checks passed.`);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
