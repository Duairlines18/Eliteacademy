'use strict';
// Browser-only fixtures: no real accounts, access codes, or backend writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 const exercises=[{id:'test',code:'TST01',title:'Test March',name:'Test March',description:'Ask Coach Du to confirm the movement sequence before you start. Use the order and positions your coach gives you.',coachingCues:'Avoid: Reaching too far. Stop if it hurts or you lose control.',category:['warm-up'],videoId:'abcdefghijk',videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',active:true}];
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
  const shortcut=page.locator('.hub-premium-routines a');await shortcut.waitFor();
  const brand=await page.locator('#hub-root').evaluate(el=>{
   const styles=getComputedStyle(el);
   return {background:styles.backgroundColor,body:styles.fontFamily};
  });
  ok(brand.background==='rgb(15, 39, 28)'&&brand.body.includes('Inter'),`${audience}/${role}: inherits academy green and Inter`);
  if(audience==='parent'||audience==='private-athlete'){
   const day=page.getByRole('navigation',{name:'Choose training day'}).locator('a[href="#/hub/session/d1"]');
   await day.waitFor();
   ok(await day.evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(20, 50, 34)'),`${audience}: workout card uses the academy panel green`);
   await day.hover();
   if(audience==='parent')ok(await day.evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(26, 61, 42)'&&getComputedStyle(el).borderTopColor==='rgb(199, 162, 90)'),'parent workout card uses academy green and gold on hover');
  }
  await shortcut.click();
  await page.locator('.hub-main h1').filter({hasText:'Your Routines'}).waitFor();
  ok(await page.locator('.hub-main .hub-card').count()===3,`${audience}/${role}: two standalone and one day-specific assigned routine`);
  ok(!await page.locator('.hub-main').innerText().then(t=>t.includes('Scheduled Strength')),`${audience}/${role}: no scheduled training in routines list`);
  await page.locator('.hub-card').filter({hasText:'Standard Warm-Up'}).click();
  await page.locator('.hub-main h1').filter({hasText:'Standard Warm-Up'}).waitFor();
  ok(await page.locator('[aria-label="Choose training day"]').count()===0,`${audience}/${role}: no Day picker in routine`);
  ok(await page.locator('.hub-main').innerText().then(t=>t.includes('2 x 8')),`${audience}/${role}: assigned dose preserved`);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${audience}/${role}/${width}: fits viewport`);
  const routineDisclosure=page.locator('[data-athlete-inline-demo]');
  ok(await routineDisclosure.count()===1,`${audience}/${role}: the standalone routine uses a compact movement dropdown`);
  ok(await routineDisclosure.evaluate(el=>!el.open),'routine technique is collapsed by default');
  const technique=routineDisclosure.getByText(/confirm the movement sequence/);
  const caution=routineDisclosure.getByText(/Stop if it hurts/);
  if(audience==='private-athlete'){
   ok(await routineDisclosure.locator('..').locator(':scope > .hub-visible-coach-note, :scope > .hub-dose-help').count()===0,'collapsed warm-up row has no trailing guidance or dose explanation');
   ok(!(await technique.isVisible())&&!(await caution.isVisible()),'private warm-up hides the full guidance in its collapsed row');
  }

  if(role==='staff'){
   const phase=page.locator('.hub-school-coach-phase');
   await phase.locator(':scope > summary').click();
  }
  await routineDisclosure.locator('summary').click();
  ok(await routineDisclosure.getByRole('button',{name:'Play Test March demonstration'}).isVisible(),'the assigned play control is inside the dropdown');
  if(audience==='private-athlete'){
   ok(await technique.isVisible()&&await caution.isVisible(),'expanded warm-up retains the complete movement guidance and safety cue');
  }

  await routineDisclosure.locator('summary').click();

  if(audience==='parent'){
   ok(await page.getByRole('button',{name:'Guided Workout',exact:true}).count()===0,'standalone parent warm-up offers full-screen demos');
   await page.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const demo=page.getByRole('dialog',{name:'Exercise demos'});
   await demo.getByRole('heading',{name:'Test March',exact:true}).waitFor();
   await demo.getByRole('button',{name:'Mark Complete',exact:true}).click();
   await demo.getByRole('button',{name:'Undo complete',exact:true}).waitFor();
   await demo.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByText('1/1 complete',{exact:true}).waitFor();
   ok(completionWrites===1,'routine completion uses existing persistence');
   ok(await page.locator('[aria-label="Choose training day"]').count()===0,'completion keeps routine navigation');
  }else if(role==='athlete'){
   const launch=page.getByRole('button',{name:'Full-screen demos',exact:true});
   await launch.click();
   const demo=page.getByRole('dialog',{name:'Exercise demos'});
   await demo.getByRole('heading',{name:'Test March',exact:true}).waitFor();
   ok((await demo.innerText()).includes('2 x 8'),'standalone presentation uses the assigned routine dose');
   await demo.getByRole('button',{name:'Close',exact:true}).click();
   ok(await launch.evaluate(el=>el===document.activeElement),'closing returns focus to the routine control');
  }
  await page.getByRole('link',{name:'← Your Routines',exact:true}).click();await page.locator('.hub-card').first().waitFor();
  if(audience==='parent'){
   await page.locator('.hub-card').filter({hasText:'Core Control'}).click();
   await page.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const demo=page.getByRole('dialog',{name:'Exercise demos'});
   await demo.getByText('2 x 6',{exact:true}).waitFor();
   await demo.getByRole('button',{name:'Close',exact:true}).click();
   ok(await page.getByRole('heading',{name:'Core Control',exact:true}).isVisible(),'closing presentation keeps the parent in the selected core routine');
   await page.goBack();await page.locator('.hub-card').first().waitFor();
  }
  await page.goBack();await page.locator('.hub-main h1').filter({hasText:'Standard Warm-Up'}).waitFor();
  await page.reload();await page.getByRole('link',{name:'← Your Routines',exact:true}).waitFor();
  await page.goto(base+(role==='staff'?'/#/hub/current-week':'/#/hub/session/d1'));
  if(role==='staff'){await page.locator('.ducc [data-day]').first().waitFor();}
  else {
   await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();
   ok(await page.locator('[aria-label="Choose training day"] a').count()===0,'workout has no sibling day cards');
   if(audience==='parent'||audience==='private-athlete'){
    const heading=page.locator('.hub-athlete-session-title h1');
    ok(await heading.evaluate(el=>getComputedStyle(el).fontFamily.includes('Playfair Display')&&getComputedStyle(el).color==='rgb(220, 195, 140)'),`${audience}: workout title uses the academy display font and gold`);
   }
  }
  if(role==='athlete'){
   await page.goto(base+'/#/hub/session/d2');await page.getByRole('link',{name:'Air Zim Warm-Up',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'Air Zim Warm-Up'}).waitFor();
   if(audience==='school'){
    ok(await page.locator('[data-completion-toggle],[data-workout-mode]').count()===0,'school routine is reference-only');
    ok((await page.locator('.hub-main').innerText()).includes('1 x 3'),'school routine keeps the assigned dose');
    ok(!(await page.locator('.hub-main').innerText()).includes('4 x 5'),'school warm-up excludes the main workout');
    ok(completionWrites===0,'school routine does not write completion');
   }else if(audience==='parent'){
    const launch=page.getByRole('button',{name:'Full-screen demos',exact:true});
    await launch.click();
    const demo=page.getByRole('dialog',{name:'Exercise demos'});
    await demo.getByText('1 of 1',{exact:true}).waitFor();
    ok((await demo.locator('.hub-private-dose').innerText()).includes('1 x 3'),'exact assigned Air Zim dose');
    ok(!(await demo.innerText()).includes('4 x 5'),'main workout stays separate');
    await demo.getByRole('button',{name:'Mark Complete',exact:true}).click();
    await demo.getByRole('button',{name:'Undo complete',exact:true}).waitFor();
    ok(saved.get('d2|p:0:0:TST01')?.completed===true,'Air Zim retains original completion identity');
    await page.reload();
    await launch.click();
    await demo.getByRole('button',{name:'Undo complete',exact:true}).waitFor();
    await demo.getByRole('button',{name:'Close',exact:true}).click();
   }else{
    await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();
    ok(await page.locator('.hub-guided-step').innerText()==='1 of 1','Air Zim contains only its assigned movement');
    const completion=page.locator('[data-completion-toggle]');
    ok(await completion.getAttribute('data-session-key')==='d2'&&await completion.getAttribute('data-item-key')==='p:0:0:TST01','Air Zim retains original completion identity');
    ok((await page.locator('.hub-guided-meta').innerText()).includes('1 x 3'),'exact assigned Air Zim dose');
    ok(!(await page.locator('.hub-main').innerText()).includes('4 x 5'),'main workout stays separate');
    await completion.click();await page.waitForFunction(()=>document.querySelector('[data-completion-toggle]')?.dataset.completed==='true');
    await page.reload();await page.locator('[data-workout-mode="guided"]').click();
    ok(await completion.getAttribute('data-completed')==='true','Air Zim completion persists after reload');
   }
   await page.goto(base+'/#/hub/session/d3');await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();
   ok(await page.locator('[aria-label="Training stages"]').count()===0,'rehabilitation day receives no inferred standard warm-up');
   const notes=page.locator(audience==='parent'?'.hub-parent-session-notes':'.hub-objective');
   ok((await notes.innerText()).includes('No running or jumping.'),'rehabilitation restrictions retained');
   if(audience==='parent')ok(await page.getByText('Coach instructions',{exact:true}).count()===0,'parent rehabilitation day uses compact notes');
   await page.goto(base+'/#/hub/routines/day/someone-else/0');await page.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
   ok(await page.locator('[data-completion-toggle]').count()===0,'foreign routine route reveals no prescription or progress');
  }
  ok(errors.length===0,`${audience}/${role}: no browser errors: ${errors}`);
  await context.close();console.log(`Routines browser QA passed: ${audience}/${role} at ${width}px`);
 }
 console.log(`Routines browser QA: ${checks} checks passed.`);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
