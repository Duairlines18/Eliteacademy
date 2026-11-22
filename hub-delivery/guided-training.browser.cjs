'use strict';
// Synthetic account sessions only. This is not hosted athlete/device sign-off.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const parentWebKit=process.env.PARENT_DEMO_WEBKIT==='1';
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await (parentWebKit?webkit:chromium).launch({headless:true});
 const codes=['WU01','WU06','WU07','WU05','WU03','SPR01','PLY03','STR02','PLY01','MOB04','CORE01'];
 const names=['Ankle Rock','Leg Swing Front / Back','Leg Swing Side / Side','High-Knee Hip Rotation Out','Walking Lunge + Rotation','A-March','Two-Leg Pogos','Step-Up','Snap Down','Diaphragmatic Breathing','Dead Bug'];
 const exercises=codes.map((code,i)=>({code,title:names[i],videoId:code==='CORE01'?'lmnopqrstuv':'abcdefghijk',videoUrl:code==='STR02'?'https://www.youtube.com/shorts/abcdefghijk':'https://youtu.be/'+(code==='CORE01'?'lmnopqrstuv':'abcdefghijk'),description:'Use the prescribed comfortable position.',coachingCues:'Cue: Stay controlled. Avoid: Rushing transitions.',active:true}));
 exercises.push({code:'MOB99',title:'Unfilmed mobility',description:'Keep the movement slow and controlled.',active:true});
 let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
 try{for(const width of (parentWebKit?[320,390]:[320,390,768,1440]))for(const who of (parentWebKit?['parent','parent-demo','parent-cleanup']:['parent','parent-demo','private','private-demo','parent-cleanup'])){
  const cleanup=who==='parent-cleanup';
  if(cleanup&&width!==390&&width!==1440)continue;
  const parent=who.startsWith('parent'),audience=parent?'parent':'private-athlete',prefix=who+'-',completions=new Map(),errors=[];
  const rx=(exerciseCode,sectionOrder,dosage='2 × 6')=>({exerciseCode,sectionOrder,sectionTitle:sectionOrder===0?'Established Standard Warm-Up':'Today’s Workout',dosage,rest:'45–60 seconds',cues:'Only if comfortable. Do not push through your feet.'});
  const day={id:prefix+'day',day:'Monday',title:parent?'Strength and landing':'Core Foundation',watch:parent?'Stop if your hip hurts.':'No jumping, running, loaded calf work, bridges, planks, kneeling or full Air Zim.',prescriptions:parent?[...Array.from({length:8},()=>rx('WU01',0,'1 × 8')),rx('STR02',1,'2 × 8/leg'),rx('PLY01',1,'2 × 4'),rx('MOB99',1,'1 × 2')]:[rx('MOB04',1,'2 × 5 breaths'),rx('CORE01',1,'2 × 6/side'),rx('MOB99',1,'1 × 2')]};
  const mob={id:prefix+'mob',routineKind:'mobility',day:'Mobility Routine',title:'Mobility',prescriptions:['WU01','WU06','WU07','WU05'].map(code=>({...rx(code,0,'1 × 8'),rest:'30 sec between sets'}))};
  const warm={id:prefix+'warm',routineKind:'warm-up',day:'Standard Warm-Up',title:'Standard Volleyball Warm-Up',prescriptions:[rx('WU03',0,'1 × 6/leg'),rx('SPR01',0,'2 × 15 m'),rx('PLY03',0,'2 × 10')]};
  if(parent)day.preparation={routineIds:[mob.id,warm.id],replacedSectionOrders:[0]};
  const otherDays=[{...day,id:prefix+'day2',day:'Wednesday',title:'Second assigned workout'},{...day,id:prefix+'day3',day:'Friday',title:'Third assigned workout'}];
  if(!parent)otherDays[0].prescriptions=['MOB04','CORE01','WU01','WU06','WU05'].map(code=>rx(code,1));
  const sessions=parent?[day,...otherDays,mob,warm]:[day,...otherDays];
  const context=await browser.newContext({viewport:{width,height:parent&&width<500?570:900},hasTouch:width<500,permissions:parent?[]:['clipboard-read','clipboard-write']}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({audience,who})=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role:'athlete',mode:'account',audience}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:who}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};},{audience,who});
  let failSave=true,openedEndCheckin=false;
  const finalParentWorkout=who==='parent-demo';
  if(finalParentWorkout)for(const previous of otherDays)for(const key of ['p:1:8:STR02','p:1:9:PLY01','p:1:10:MOB99']){
   completions.set(previous.id+'|'+key,{sessionKey:previous.id,itemKey:key,completed:true});
  }
  const requirement={id:'test-final-checkin',kind:'end',calendar_weekly:true,week_number:9,period_start:'2026-11-15',due_date:'2026-11-22',revision:0};
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();
   if(url.startsWith('https://www.youtube-nocookie.com/embed/'))return route.fulfill({contentType:'text/html',body:'<title>Test video</title>'});
   if(!url.includes('/functions/v1/'))return route.abort();
   const body=req.postDataJSON()||{};let data={};
   if(body.action==='open-end-checkin'){
    ok(finalParentWorkout&&req.headers().authorization==='Bearer '+who,'final workout opens check-in as the current parent');
    openedEndCheckin=true;
   }
   if(['checkin-state','open-end-checkin'].includes(body.action)){
    const due=openedEndCheckin?[requirement]:[];
    return route.fulfill({json:{checkins:{enabled:finalParentWorkout,held:false,requirements:due,due}}});
   }
   if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Core'],trainingEnvironment:'Home',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Approved\nCurrent pain / injury / restriction: Follow approved restrictions\nPrevious significant injuries: Coach aware'}};
   if(body.action==='bootstrap')data={contentStatus:'published',audience,viewer:{firstName:'Synthetic'},athlete:{id:prefix+'athlete',displayName:'Synthetic'},programme:{id:prefix+'programme',title:cleanup?'Andria Torres — Volleyball Development':'Assigned programme',week:cleanup?11:parent?9:2,totalWeeks:cleanup?11:10,sessions},exercises,delivery:{model:'private-athlete',copyWorkout:true}};
   if(body.action==='library')data={exercises};
   if(body.action==='list')data={completions:[...completions.values()]};
   if(body.action==='set'){
    ok(req.headers().authorization==='Bearer '+who,'save uses current account token');
    ok(sessions.some(s=>s.id===body.sessionKey),'save stays in own assigned sessions');
    if(failSave){failSave=false;return route.fulfill({status:503,json:{error:'Save failed'}});}
    const row={sessionKey:body.sessionKey,itemKey:body.itemKey,completed:body.completed};completions.set(row.sessionKey+'|'+row.itemKey,row);data={completion:row};
   }
   return route.fulfill({json:data});
  });
  await page.goto(base+'/#/hub/athlete');
  await page.getByRole('heading',{name:'My training',exact:true}).waitFor();
  const main=page.locator('.hub-main');
  ok(await main.getByRole('heading',{name:'Choose a training day',exact:true}).isVisible(),'the athlete can choose a day directly');
  ok(!(await main.innerText()).includes('Parent access:'),'training view uses athlete-first language');
  const trainingCards=main.locator('.hub-parent-session-card');
  const coachInstructions=scope=>scope.getByText('Coach instructions',{exact:true});
  if(cleanup){
   ok((await main.innerText()).includes('Week 11'),'targeted parent sees Week 11');
   ok(await trainingCards.count()===3,'targeted parent sees three training days');
   for(let i=1;i<3;i++){
    await trainingCards.nth(i).click();
    ok(new URL(page.url()).hash.endsWith('/session/'+otherDays[i-1].id),'targeted parent can open each assigned day');
    await main.getByText('2 × 8/leg',{exact:true}).waitFor();
    ok(await coachInstructions(main).count()===0,'assigned day omits redundant panel');
    await page.getByRole('link',{name:'← Back to Week',exact:true}).click();
   }
  }
  const trainingCard=trainingCards.first();
  await trainingCard.click();
  ok(page.url().endsWith('/session/'+day.id),'training card opens the selected day');
  await page.locator('[data-private-present]').waitFor();
  ok(await page.locator('[aria-label="Choose training day"]').count()===0,'selected workout has no other day cards');
  await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();
  if(!parent){
   await page.getByRole('button',{name:'Copy workout',exact:true}).click();
   await page.getByText('Copied!',{exact:true}).waitFor();
   const copied=await page.evaluate(()=>navigator.clipboard.readText());
   ok(copied.includes('Week 2 · Monday · Core Foundation\n\nTODAY’S WORKOUT'),'private copy has a clear session title and section');
   ok(copied.includes('1. Diaphragmatic Breathing — 2 × 5 breaths · Rest: 45–60 seconds\n   Demo: https://youtu.be/abcdefghijk'),'private copy retains dosage, rest and matching demo');
   ok(!/No jumping|Only if comfortable|How to do it:|Watch for:/.test(copied),'private copy leaves coaching notes in the portal');
   const options=main.getByRole('group',{name:'Workout views'});
   ok(await options.evaluate(el=>el.scrollWidth<=el.clientWidth),'workout view controls fit without horizontal scrolling');
   ok(await options.getByRole('button',{name:'Workout',pressed:true}).count()===1,'Workout is the private default');
   ok(await main.getByText('2 × 5 breaths',{exact:true}).isVisible(),'Workout shows prescription');
   assert.deepEqual(await options.getByRole('button').allTextContents(),['Workout','Full-screen demos']);
   ok(await main.getByRole('button',{name:'Guided Workout',exact:true}).count()===0,'private athlete has only two workout views');
   await main.getByText('Technique tips for Unfilmed mobility').click();
   ok(await main.getByText('Keep the movement slow and controlled.',{exact:false}).isVisible(),'Workout keeps tips for exercises without a demo');
   ok(await main.getByText('Only if comfortable.',{exact:false}).first().isVisible(),'Workout retains assigned restrictions');
   const workoutRoute=await page.evaluate(()=>location.hash);
   await options.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const presentation=page.getByRole('dialog',{name:'Exercise demos'});
   ok(await presentation.getByRole('heading',{name:'Diaphragmatic Breathing'}).isVisible(),'Full screen opens assigned exercise');
   ok(await presentation.getByText('Use the prescribed comfortable position.',{exact:false}).isVisible(),'Full screen keeps exercise guidance');
   ok(await presentation.getByRole('button',{name:'Previous'}).isDisabled(),'no previous clip at the beginning');
   await presentation.getByRole('button',{name:'Play demo'}).click();
   ok((await presentation.locator('iframe').getAttribute('src')).includes('/embed/abcdefghijk'),'Full screen uses assigned video');
   const fallback=presentation.getByRole('link',{name:'Open on YouTube'});
   ok(await fallback.getAttribute('href')==='https://youtu.be/abcdefghijk','player fallback uses the original demo');
   const allowed=await fallback.evaluate(link=>link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
   ok(allowed,'YouTube fallback opens externally instead of opening a second Hub player');
   await presentation.getByRole('button',{name:'Next'}).click();
   ok(await presentation.locator('iframe').count()===0,'navigating removes the former player');
   ok(await presentation.getByRole('heading',{name:'Dead Bug'}).isVisible(),'next demo follows workout order');
   ok(await page.evaluate(()=>location.hash)===workoutRoute,'Next demo stays on the selected training day');
   await presentation.getByRole('button',{name:'Play demo'}).click();
   ok((await presentation.locator('iframe').getAttribute('src')).includes('/embed/lmnopqrstuv'),'next exercise opens its own video');
   ok(await presentation.getByRole('button',{name:'Next'}).isDisabled(),'no next clip at the end');
   ok(await page.evaluate(()=>location.hash)===workoutRoute,'playing another demo does not navigate back to week');
   ok(await presentation.evaluate(el=>el.scrollWidth<=el.clientWidth),'Full screen fits viewport width');
   await presentation.getByRole('button',{name:'Close',exact:true}).click();
   await presentation.waitFor({state:'detached'});
   ok(await options.getByRole('button',{name:'Workout',pressed:true}).count()===1,'closing returns to Workout');
   ok(await options.getByRole('button',{name:'Full-screen demos'}).evaluate(el=>document.activeElement===el),'closing restores focus');
   await options.getByRole('button',{name:'Full-screen demos'}).press('Enter');
   await presentation.getByRole('button',{name:'Close'}).focus();
   await page.keyboard.press('Escape');
   await presentation.waitFor({state:'detached'});
   ok(completions.size===0,'viewing demos leaves completion untouched');
   await page.getByRole('link',{name:'← Back to Week',exact:true}).click();
   await main.locator('.hub-parent-session-card').filter({hasText:'Second assigned workout'}).click();
   await options.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const secondWorkout=new URL(page.url()).hash;
   const next=presentation.getByRole('button',{name:'Next',exact:true});
   for(let index=2;index<=5;index++){
    await next.click();
    await presentation.getByText(index+' of 5',{exact:true}).waitFor();
    ok(new URL(page.url()).hash===secondWorkout,'repeated Next stays on the private workout');
   }
   await presentation.getByRole('button',{name:'Play demo'}).click();
   await presentation.locator('iframe').waitFor();
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await presentation.getByRole('button',{name:'Previous',exact:true}).click();
   await presentation.getByText('4 of 5',{exact:true}).waitFor();
   await presentation.getByRole('button',{name:'Close',exact:true}).click();
   ok(new URL(page.url()).hash===secondWorkout,'closing stays on the second private workout');
  }
  if(parent){
   ok(await coachInstructions(main).count()===0,'all parent workout pages omit the large instructions panel');
   ok((await main.locator('.hub-parent-session-notes').innerText()).includes('Stop if your hip hurts.'),'workout displays the session safety note');
   await main.getByText('2 × 8/leg',{exact:true}).waitFor();
   ok(await main.getByText('45–60 seconds',{exact:false}).count()>0,'parent Quick View retains prescribed rest');
   ok(await main.getByRole('button',{name:'Quick View',exact:true}).count()===1,'parent still uses their own Quick View');
   ok(await main.getByRole('button',{name:'Guided Workout',exact:true}).count()===0,'parent day has no separate guided view');
   const stepUp=main.locator('.hub-parent-quick-row').filter({hasText:'Step-Up'});
   ok(await stepUp.count()===1,'workout shows one row per prescription');
   ok(await stepUp.getByText('2 × 8/leg',{exact:true}).isVisible(),'dose is visible before opening technique');
   ok(await stepUp.locator('[data-completion-toggle]').isVisible(),'completion is visible before opening technique');
   ok(await stepUp.getByText('Only if comfortable.',{exact:false}).isVisible(),'session-specific safety is visible');
   await stepUp.getByText('Demo & technique',{exact:false}).click();
   ok(await stepUp.getByText('How to do it',{exact:true}).count()===1,'one technique explanation inside the dropdown');
   const exerciseDemo=stepUp.getByRole('link',{name:'Watch Step-Up demo'});
   ok((await exerciseDemo.getAttribute('href')).includes('abcdefghijk'),'dropdown carries the exact assigned demo');
   await exerciseDemo.click();
   await page.locator('#hubVideoModal iframe').waitFor();
   ok((await page.locator('#hubVideoModal iframe').getAttribute('src')).includes('abcdefghijk'),'demo opens inside the Hub');
   await page.locator('#hubVideoModal [data-hub-video-close]').click();
   ok(new URL(page.url()).hash.endsWith('/session/'+day.id),'closing the demo stays on the workout');
   ok(await page.locator('[aria-label="Training stages"] a').count()===1,'one combined warm-up card');
   await page.getByRole('link',{name:'My Warm-Up',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'My Warm-Up'}).waitFor();
   ok(await coachInstructions(main).count()===0,'all parent warm-up cards omit the large instructions panel');
   ok((await main.locator('.hub-parent-session-notes').innerText()).includes('Stop if your hip hurts.'),'warm-up keeps the session safety note visible');
   ok(await main.locator('.hub-parent-quick-row').count()===7,'warm-up and mobility each render their assigned rows once');
   const ankle=main.locator('.hub-parent-quick-row').filter({hasText:'Ankle Rock'});
   ok(await ankle.getByText('1 × 8',{exact:true}).isVisible(),'warm-up dose is visible in Quick View');
   ok(await ankle.locator('details').count()===1,'warm-up shares the same exercise dropdown');
   ok(await main.getByText('Exercise guide',{exact:true}).count()===0,'warm-up has no duplicate exercise list');
   const openWarmUp=main.getByRole('button',{name:'Full-screen demos',exact:true});
   const warmUpDemo=page.getByRole('dialog',{name:'Exercise demos'});
   const warmUpMark=warmUpDemo.getByRole('button',{name:'Mark Complete',exact:true});
   const warmUpNext=warmUpDemo.getByRole('button',{name:'Next',exact:true});
   const closeWarmUp=warmUpDemo.getByRole('button',{name:'Close',exact:true});
   ok(await main.getByRole('button',{name:'Quick View',exact:true}).count()===1,'warm-up has Quick View');
   ok(await main.getByRole('button',{name:'Guided Workout',exact:true}).count()===0,'warm-up uses full-screen demos');
   await openWarmUp.click();
   await warmUpDemo.getByText('1 of 7',{exact:true}).waitFor();
   ok(await warmUpDemo.getByRole('heading',{name:'Ankle Rock',exact:true}).isVisible(),'mobility opens first');
   ok(!(await warmUpDemo.locator('.hub-private-dose').innerText()).includes('Rest:'),'single-set rest hidden');
   ok(await coachInstructions(warmUpDemo).count()===0,'parent warm-up demos omit the large instructions panel');
   ok((await warmUpDemo.innerText()).includes('Only if comfortable.'),'warm-up preserves exercise safety guidance');
   const warmUpNotes=warmUpDemo.locator('details.hub-parent-session-notes');
   ok(!(await warmUpNotes.getByText('Stop if your hip hurts.').isVisible()),'warm-up demo notes start collapsed');
   await warmUpNotes.getByText('Session notes',{exact:true}).click();
   ok(await warmUpNotes.getByText('Stop if your hip hurts.').isVisible(),'warm-up demo makes session guidance available');
   await warmUpNotes.getByText('Session notes',{exact:true}).click();
   await warmUpDemo.getByRole('button',{name:'Play demo'}).click();
   ok((await warmUpDemo.locator('iframe').getAttribute('src')).includes('/embed/abcdefghijk'),'warm-up links the correct demo');
   await warmUpMark.click();
   await warmUpDemo.getByRole('button',{name:'Try again',exact:true}).click();
   await warmUpDemo.getByText('2 of 7',{exact:true}).waitFor();
   ok(completions.get(mob.id+'|p:0:0:WU01')?.completed,'mobility saves against its original session key');
   const warmUpRoute=new URL(page.url()).hash;
   for(let index=3;index<=5;index++){
    await warmUpNext.click();
    await warmUpDemo.getByText(index+' of 7',{exact:true}).waitFor();
    ok(new URL(page.url()).hash===warmUpRoute,'repeated Next stays on the parent warm-up');
   }
   await page.evaluate(()=>{
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
   });
   const warmUpPrevious=warmUpDemo.getByRole('button',{name:'Previous',exact:true});
   await warmUpPrevious.click();
   await warmUpDemo.getByText('4 of 7',{exact:true}).waitFor();
   await warmUpNext.click();
   await warmUpDemo.getByText('5 of 7',{exact:true}).waitFor();
   ok(await warmUpDemo.getByRole('heading',{name:'Walking Lunge + Rotation',exact:true}).isVisible(),'sequence crosses the original routine boundary');
   await warmUpMark.click();
   await warmUpDemo.getByText('6 of 7',{exact:true}).waitFor();
   ok(completions.get(warm.id+'|p:0:0:WU03')?.completed,'warm-up saves against its original session key');
   ok(!openedEndCheckin,'warm-up does not open the end-of-week check-in');
   await closeWarmUp.click();
   await main.getByText('2/7 complete',{exact:true}).waitFor();
   ok(await openWarmUp.evaluate(button=>document.activeElement===button),'closing returns focus to the warm-up demo button');
   await page.reload();
   await openWarmUp.click();
   await warmUpDemo.getByText('2 of 7',{exact:true}).waitFor();
   for(let i=0;i<3;i++)await warmUpNext.click();
   const undoWarmUp=warmUpDemo.getByRole('button',{name:'Undo complete',exact:true});
   ok(await undoWarmUp.isVisible(),'routine completion persists on reload');
   await undoWarmUp.click();
   await warmUpMark.waitFor();
   ok(completions.get(warm.id+'|p:0:0:WU03')?.completed===false,'warm-up undo uses the original key');
   await closeWarmUp.click();
   await main.getByRole('link',{name:'Return to Today’s Workout →',exact:true}).click();
   await main.getByRole('link',{name:'My Warm-Up',exact:true}).waitFor();
   ok(page.url().endsWith('/session/'+day.id),'warm-up returns to the originating day');
   await main.getByRole('link',{name:'My Warm-Up',exact:true}).click();
   await page.getByRole('link',{name:'← Your Routines',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'Your Routines'}).waitFor();
   const routineLinks=page.locator('.hub-main .hub-grid a.hub-card');
   await routineLinks.filter({hasText:'My Warm-Up'}).first().waitFor();
   ok(await routineLinks.filter({hasText:'My Warm-Up'}).count()===1,'Your Routines contains exactly one combined warm-up card');
   ok(await routineLinks.filter({hasText:/^(?!.*My Warm-Up).*(?:Mobility|Standard Volleyball Warm-Up)/i}).count()===0,'Your Routines does not expose duplicate preparation cards');
   await page.goto(base+'/#/hub/session/'+day.id);
   const launch=main.getByRole('button',{name:'Full-screen demos',exact:true});
   await launch.waitFor();
   failSave=true;
   await launch.click();
   const dialog=page.getByRole('dialog',{name:'Exercise demos'});
   const mark=dialog.getByRole('button',{name:'Mark Complete',exact:true});
   await dialog.getByRole('heading',{name:'Step-Up',exact:true}).waitFor();
   const layout=()=>dialog.evaluate(el=>{
    const bounds=selector=>el.querySelector(selector).getBoundingClientRect();
    const body=el.querySelector('.hub-private-presentation-body');
    const heading=bounds('.hub-parent-demo-heading'),stage=bounds('.hub-private-video-stage');
    const coaching=bounds('.hub-parent-demo-details'),footer=bounds('footer'),dialogBounds=el.getBoundingClientRect();
    return {
     headingAboveVideo:heading.bottom<=stage.top,
     videoClearOfCoaching:coaching.top>=stage.bottom||coaching.left>=stage.right,
     footerInView:footer.top>=bounds('.hub-private-presentation-body').bottom&&footer.bottom<=dialogBounds.bottom+1,
     bodyScrollable:body.scrollHeight>body.clientHeight,
    };
   });
   const preview=await layout();
   ok(preview.headingAboveVideo&&preview.videoClearOfCoaching,'exercise name, prescription, video and coaching do not overlap in the preview');
   ok(preview.footerInView,'completion controls stay in view');
   if(width<500)ok(preview.bodyScrollable,'instructions can scroll on a short phone viewport');
   for(const label of ['How to do it','Coach cue','Watch for']){
    ok(await dialog.locator('.hub-parent-demo-details .hub-visible-coach-note > strong').filter({hasText:label}).isVisible(),'separate '+label+' coaching block is present');
   }
   ok(await coachInstructions(dialog).count()===0,'parent workout demos omit the large instructions panel');
   ok((await dialog.innerText()).includes('Only if comfortable.'),'parent fullscreen keeps exercise restrictions');
   const workoutNotes=dialog.locator('details.hub-parent-session-notes');
   ok(!(await workoutNotes.getByText('Stop if your hip hurts.').isVisible()),'workout demo notes start collapsed');
   await workoutNotes.getByText('Session notes',{exact:true}).click();
   ok(await workoutNotes.getByText('Stop if your hip hurts.').isVisible(),'workout demo makes session guidance available');
   await workoutNotes.getByText('Session notes',{exact:true}).click();
   ok(await dialog.getByText('1 of 3',{exact:true}).isVisible(),'only main exercises are included');
   await dialog.getByRole('button',{name:'Play demo'}).click();
   ok((await dialog.locator('iframe').getAttribute('src')).includes('/embed/abcdefghijk'),'parent fullscreen opens the correct demo');
   ok(await dialog.locator('.hub-private-video-stage.vertical iframe').count()===1,'the portrait player is exercised');
   const playback=await layout();
   ok(playback.headingAboveVideo&&playback.videoClearOfCoaching&&playback.footerInView,'portrait playback keeps the exercise info and controls clear');
   ok(await dialog.getByRole('link',{name:'Open on YouTube',exact:true}).isVisible(),'video fallback stays available');
   if(width<500){
    await dialog.locator('.hub-parent-demo-details .hub-visible-coach-note').last().scrollIntoViewIfNeeded();
    ok((await layout()).footerInView,'completion controls stay in view after scrolling to the last coaching block');
   }
   await mark.click();
   const retry=dialog.getByRole('button',{name:'Try again',exact:true});
   await retry.waitFor();
   ok(!completions.has(day.id+'|p:1:8:STR02'),'failed save does not complete the exercise');
   await retry.click();
   await dialog.getByText('2 of 3',{exact:true}).waitFor();
   ok(completions.has(day.id+'|p:1:8:STR02'),'full screen uses the original exercise key');
   await dialog.getByRole('button',{name:'Close',exact:true}).click();
   await dialog.waitFor({state:'detached'});
   await main.getByText('1/3 complete',{exact:true}).waitFor();
   ok(await main.getByText('1/3 complete',{exact:true}).isVisible(),'Quick View reflects new progress');
   ok(await launch.evaluate(button=>document.activeElement===button),'closing restores focus');
   await page.reload();
   await launch.click();
   await dialog.getByText('2 of 3',{exact:true}).waitFor();
   await dialog.getByRole('button',{name:'Previous',exact:true}).click();
   ok(await dialog.getByRole('button',{name:'Undo complete',exact:true}).isVisible(),'saved completion survives reload');
   await dialog.getByRole('button',{name:'Next',exact:true}).click();
   await mark.click();
   await dialog.getByRole('heading',{name:'Unfilmed mobility',exact:true}).waitFor();
   ok(await dialog.getByText('No demo linked for this step.',{exact:true}).isVisible(),'exercise without a demo still has a step');
   ok(await dialog.getByText('Keep the movement slow and controlled.',{exact:false}).isVisible(),'exercise without a demo retains instructions');
   ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'parent full-screen controls fit viewport');
   await mark.click();
   if(finalParentWorkout){
    await page.locator('#mandatoryCheckinForm').waitFor();
    ok(openedEndCheckin,'final movement opens the due parent check-in');
   }else{
    await dialog.getByRole('button',{name:'Undo complete',exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await main.getByText('Workout Complete',{exact:false}).first().waitFor();
    ok(await main.getByRole('link',{name:'Send feedback →',exact:true}).isVisible(),'Quick View retains the feedback link');
   }
   ok(errors.length===0,errors.join('\n'));
   await context.close();
   console.log(`${who} ${width}px: full-screen parent workout, completion, reload and routine regression passed`);
   continue;
  }
  // Guided mode was retired; verify the two supported private workout controls instead.
  const privateViews=page.getByRole('group',{name:'Workout views'});
  ok(await privateViews.getByRole('button',{name:'Workout',exact:true}).count()===1,'private Workout remains available');
  ok(await privateViews.getByRole('button',{name:'Full-screen demos',exact:true}).count()===1,'private demos remain available');
  ok(await page.locator('[data-workout-mode="guided"]').count()===0,'retired Guided Workout is absent');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'private workout fits mobile viewport');
  ok(errors.length===0,errors.join('\\n'));
  await context.close();console.log(`${who} ${width}px: private two-view workout and demo regression passed`);
 }console.log(`${checks} guided browser assertions passed`);}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
