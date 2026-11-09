'use strict';
// Synthetic account sessions only. This is not hosted athlete/device sign-off.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 const codes=['WU01','WU06','WU07','WU05','WU03','SPR01','PLY03','STR02','PLY01','MOB04','CORE01'];
 const names=['Ankle Rock','Leg Swing Front / Back','Leg Swing Side / Side','High-Knee Hip Rotation Out','Walking Lunge + Rotation','A-March','Two-Leg Pogos','Step-Up','Snap Down','Diaphragmatic Breathing','Dead Bug'];
 const exercises=codes.map((code,i)=>({code,title:names[i],videoId:'abcdefghijk',videoUrl:'https://youtu.be/abcdefghijk',description:'Use the prescribed comfortable position.',coachingCues:'Cue: Stay controlled.',active:true}));
 let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
 try{for(const width of [390,1440])for(const who of ['parent','parent-demo','private','private-demo']){
  const parent=who.startsWith('parent'),audience=parent?'parent':'private-athlete',prefix=who+'-',completions=new Map(),errors=[];
  const rx=(exerciseCode,sectionOrder,dosage='2 × 6')=>({exerciseCode,sectionOrder,sectionTitle:sectionOrder===0?'Established Standard Warm-Up':'Today’s Workout',dosage,rest:'45–60 seconds',cues:'Only if comfortable. Do not push through your feet.'});
  const day={id:prefix+'day',day:'Monday',title:parent?'Strength and landing':'Core Foundation',watch:parent?'Stop if your hip hurts.':'No jumping, running, loaded calf work, bridges, planks, kneeling or full Air Zim.',prescriptions:parent?[...Array.from({length:8},()=>rx('WU01',0,'1 × 8')),rx('STR02',1,'2 × 8/leg'),rx('PLY01',1,'2 × 4')]:[rx('MOB04',1,'2 × 5 breaths'),rx('CORE01',1,'2 × 6/side')]};
  const mob={id:prefix+'mob',routineKind:'mobility',day:'Mobility Routine',title:'Mobility',prescriptions:['WU01','WU06','WU07','WU05'].map(code=>({...rx(code,0,'1 × 8'),rest:'30 sec between sets'}))};
  const warm={id:prefix+'warm',routineKind:'warm-up',day:'Standard Warm-Up',title:'Standard Volleyball Warm-Up',prescriptions:[rx('WU03',0,'1 × 6/leg'),rx('SPR01',0,'2 × 15 m'),rx('PLY03',0,'2 × 10')]};
  if(parent)day.preparation={routineIds:[mob.id,warm.id],replacedSectionOrders:[0]};
  const otherDays=[{...day,id:prefix+'day2',day:'Wednesday',title:'Second assigned workout'},{...day,id:prefix+'day3',day:'Friday',title:'Third assigned workout'}];
  const sessions=parent?[day,...otherDays,mob,warm]:[day,...otherDays];
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({audience,who})=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role:'athlete',mode:'account',audience}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:who}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};},{audience,who});
  let failSave=true;
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();if(!url.includes('/functions/v1/'))return route.abort();
   const body=req.postDataJSON()||{};let data={};
   if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Core'],trainingEnvironment:'Home',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Approved\nCurrent pain / injury / restriction: Follow approved restrictions\nPrevious significant injuries: Coach aware'}};
   if(body.action==='bootstrap')data={contentStatus:'published',audience,viewer:{firstName:'Synthetic'},athlete:{id:prefix+'athlete',displayName:'Synthetic'},programme:{id:prefix+'programme',title:'Assigned programme',week:parent?9:2,totalWeeks:10,sessions},exercises,delivery:{model:'private-athlete',copyWorkout:true}};
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
  await page.goto(base+'/#/hub/session/'+day.id);await page.locator('[data-workout-mode="guided"]').waitFor();
  ok(await page.locator('[aria-label="Choose training day"]').count()===0,'selected workout has no other day cards');
  await page.getByRole('link',{name:'← Back to Week',exact:true}).waitFor();
  if(parent){
   ok(await page.locator('[aria-label="Training stages"] a').count()===1,'one combined warm-up card');
   await page.getByRole('link',{name:'My Warm-Up',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'My Warm-Up'}).waitFor();
   await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();
   ok(await page.locator('.hub-guided-step').innerText()==='1 of 7','one continuous seven-exercise routine');
   ok(!(await page.locator('.hub-guided-meta').innerText()).includes('Rest:'),'single-set rest hidden');
   ok(await page.locator('[data-completion-toggle]').getAttribute('data-session-key')===mob.id,'mobility retains original session key');
   for(let i=0;i<4;i++)await page.locator('[data-guided-next]').click();
   ok(await page.locator('.hub-guided-step').innerText()==='5 of 7','guided sequence crosses original routine boundary');
   ok(await page.locator('[data-completion-toggle]').getAttribute('data-session-key')===warm.id,'warm-up retains original session key');
   await page.locator('[data-completion-toggle]').click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor();
   await page.locator('[data-completion-toggle]').click();await page.waitForFunction(()=>document.querySelector('.hub-guided-step')?.textContent==='6 of 7');
   await page.locator('[data-guided-prev]').click();ok(await page.locator('[data-completion-toggle]').getAttribute('data-completed')==='true','routine saved against original key');
   await page.reload();await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();
   for(let i=0;i<4;i++)await page.locator('[data-guided-next]').click();
   ok(await page.locator('[data-completion-toggle]').getAttribute('data-completed')==='true','routine completion persists on reload');
   await page.getByRole('link',{name:'← Your Routines',exact:true}).click();
   await page.locator('.hub-main h1').filter({hasText:'Your Routines'}).waitFor();
   const routineLinks=page.locator('.hub-main .hub-grid a.hub-card');
   await routineLinks.filter({hasText:'My Warm-Up'}).first().waitFor();
   ok(await routineLinks.filter({hasText:'My Warm-Up'}).count()===1,'Your Routines contains exactly one combined warm-up card');
   ok(await routineLinks.filter({hasText:/^(?!.*My Warm-Up).*(?:Mobility|Standard Volleyball Warm-Up)/i}).count()===0,'Your Routines does not expose duplicate preparation cards');
   await page.goto(base+'/#/hub/session/'+day.id);await page.locator('[data-workout-mode="guided"]').waitFor();
   failSave=true;
  }
  await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();
  const firstKey=parent?'p:1:8:STR02':'p:1:0:MOB04';ok(await page.locator('[data-completion-toggle]').getAttribute('data-item-key')===firstKey,'original completion key retained');
  ok(await page.locator('.hub-guided-teach').count()>=2,'instructions and cue visible');ok(await page.locator('[data-guided-next]').isEnabled(),'next available');
  if(!parent)ok((await page.locator('.hub-objective').innerText()).includes('No jumping'),'injury restrictions visible');
  await page.locator('[data-completion-toggle]').click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor();ok(!completions.has(day.id+'|'+firstKey),'failed save does not mark complete');await page.locator('[data-completion-toggle]').click();await page.waitForFunction(()=>document.querySelector('.hub-guided-step')?.textContent==='2 of 2');
  await page.reload();await page.locator('[data-workout-mode="guided"]').click();await page.locator('.hub-guided-card').waitFor();ok((await page.locator('.hub-guided-step').innerText())==='2 of 2','reload resumes unfinished exercise');
  await page.locator('[data-guided-prev]').click();ok(await page.locator('[data-completion-toggle]').getAttribute('data-completed')==='true','saved completion restored');
  await page.locator('[data-guided-next]').click();await page.locator('[data-completion-toggle]').click();await page.getByText('Workout Complete',{exact:false}).first().waitFor();ok(await page.getByRole('link',{name:'Send feedback →',exact:true}).count()===1,'completion leads to feedback');
  await page.locator('[data-workout-mode="quick"]').click();ok(await page.getByRole('link',{name:'Send feedback →',exact:true}).count()===1,'quick view retains completion feedback handoff');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fits mobile viewport');ok(errors.length===0,errors.join('\n'));
  await context.close();console.log(`${who} ${width}px: guided navigation, restrictions, original keys, retry and reload persistence passed`);
 }console.log(`${checks} guided browser assertions passed`);}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
