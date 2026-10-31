'use strict';
// Local synthetic accounts only. Real production credentials and records are never used.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const {handlePrivateAthleteRequest}=await import('../supabase/functions/_shared/private-athlete-handler.ts');
 const server=http.createServer((req,res)=>{try{let file=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
 try{for(const width of [390,1440]){
  let athlete={id:'synthetic-athlete',athlete_user_id:'synthetic-user',full_name:'Test Athlete',display_name:'Test',athlete_type:'private',access_status:'active',access_reason:'complimentary',payment_status:'not_required',paid:false,programme_id:'synthetic-programme',current_week:1,onboarding_complete:true,onboarding_data:{}};
  let failSave=false;const saves=[];
  const bundle={cohort:{id:'synthetic-athlete',current_week:1},programme:{id:'synthetic-programme',name:'Private Athlete Speed & Jumps',duration_weeks:10},week:{week_number:1,status:'live',verification_status:'verified',published_at:'2026-10-01',weekly_objective:'Build your foundations'},trainingDays:[{id:'day-1',day_key:'Day 1',title:'Movement and Acceleration',sort_order:1},{id:'day-2',day_key:'Day 2',title:'Foundational Strength',sort_order:2},{id:'day-3',day_key:'Day 3',title:'Core and Jump Preparation',sort_order:3}],blocks:[{training_day_id:'day-1',title:'Warm-up',content:{items:['March — 2 x 8']}},{training_day_id:'day-2',title:'Strength',content:{items:['Bridge — 2 x 8']}},{training_day_id:'day-3',title:'Core',content:{items:['Dead bug — 2 x 8']}}],exercises:[]};
  const repo={
   findPrivateAthlete:async id=>{assert.equal(id,'synthetic-user');return structuredClone(athlete);},
   ensurePrivateAthlete:async user=>{assert.equal(user.id,'synthetic-user');return structuredClone(athlete);},
   updatePrivateAthleteOnboarding:async(id,fields)=>{assert.equal(id,'synthetic-user');saves.push(fields);athlete={...athlete,...structuredClone(fields)};return structuredClone(athlete);},
   loadAssignedProgramme:async a=>{assert.equal(a.programme_id,'synthetic-programme');return structuredClone(bundle);},
   listAssignedPublishedWeeks:async()=>[],listAssignedProgrammeSchedule:async()=>[{week_number:1,status:'live',verification_status:'verified',published_at:'2026-10-01'}]
  };
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500});
  await context.addInitScript(()=>{window.supabase={createClient:()=>({auth:{
   signInWithPassword:async({email,password})=>{if(email!=='test@example.invalid'||password!=='synthetic-password')return {error:{message:'Invalid login credentials'}};localStorage.setItem('synthetic-auth','signed-in');return {error:null};},
   getSession:async()=>({data:{session:localStorage.getItem('synthetic-auth')?{access_token:'synthetic-token'}:null},error:null}),
   signOut:async()=>{localStorage.removeItem('synthetic-auth');return {error:null};}
  }})};});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=request.url();
   if(url.includes('.supabase.co/functions/')){
    const headers={'access-control-allow-origin':base,'access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json'};
    if(request.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
    if(!url.endsWith('/private-athlete-hub-data'))return route.fulfill({status:200,headers,body:'{}'});
    const body=request.postDataJSON();
    if(body.action==='save-onboarding'&&failSave)return route.fulfill({status:503,headers,body:JSON.stringify({error:'Unable to save right now. Please try again.'})});
    const response=await handlePrivateAthleteRequest(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com','content-type':'application/json'},body:JSON.stringify(body)}),{verifyUser:async()=>request.headers().authorization==='Bearer synthetic-token'?{id:'synthetic-user'}:null,repository:repo});
    return route.fulfill({status:response.status,headers,body:await response.text()});
   }
   if(!url.startsWith(base))return route.abort();return route.continue();
  });
  await page.goto(base+'/#/hub/login/private-athlete');
  await page.locator('#hubAccountLoginForm').waitFor();
  check(await page.locator('#hubCode').count()===0,`${width}: account login requires no access code`);
  await page.locator('#hubAccountLoginForm [name=email]').fill('test@example.invalid');await page.locator('#hubAccountLoginForm [name=password]').fill('synthetic-password');await page.locator('#hubAccountLoginForm button[type=submit]').click();
  await page.locator('#hubAccountOnboardingForm').waitFor();
  check(await page.locator('[name=first_name]').inputValue()==='Test',`${width}: identity retained and empty setup reopened`);
  await page.locator('[name=sport_pathway]').fill('Triple jump');
  await page.locator('[name=private_development_goals][value="Jumping / power"]').check();
  await page.locator('[name=private_development_goals][value="Speed / acceleration"]').check();
  await page.locator('[name=private_weekly_schedule]').fill('Track twice\nStrength once');
  await page.locator('[name=private_current_considerations]').fill('None');await page.locator('[name=private_injury_history]').fill('None');
  await page.locator('[name=private_training_environment][value="Track / field"]').check();await page.locator('[name=private_training_environment][value=Gym]').check();
  await page.locator('[name=private_equipment][value="Bodyweight only"]').check();await page.locator('[name=weekly_availability]').selectOption('3 days');
  failSave=true;await page.locator('#hubAccountOnboardingForm button[type=submit]').click();
  await page.locator('[data-onboarding-error]').filter({hasText:'Unable to save right now'}).waitFor();
  check(saves.length===0,`${width}: failed submission writes nothing`);
  check(await page.locator('[name=private_weekly_schedule]').inputValue()==='Track twice\nStrength once',`${width}: failed submission preserves entered answers`);
  failSave=false;await page.locator('#hubAccountOnboardingForm button[type=submit]').click();
  await page.waitForURL('**/#/hub/athlete');await page.locator('#hubNav').waitFor({state:'attached'});
  assert.deepEqual(athlete.onboarding_data.primaryGoals,['Speed / acceleration','Jumping / power']);
  check(athlete.access_status==='active'&&athlete.programme_id==='synthetic-programme'&&athlete.current_week===1&&athlete.payment_status==='not_required'&&!athlete.paid,`${width}: save preserves activation and assignment`);
  check(await page.locator('#hub-root a[href^="#/hub/session/"]').count()===3,`${width}: three Week 1 days visible`);
  await page.reload();await page.locator('#hubNav').waitFor({state:'attached'});
  await page.goto(base+'/#/hub/setup');await page.locator('#hubAccountOnboardingForm').waitFor();
  check(await page.locator('[name=private_development_goals]:checked').count()===2,`${width}: saved goals restored after refresh`);
  check(await page.locator('[name=private_training_environment]:checked').count()===2,`${width}: saved environments restored`);
  check(await page.locator('[name=private_weekly_schedule]').inputValue()==='Track twice\nStrength once',`${width}: multiline schedule restored`);
  check(await page.locator('[name=private_current_considerations]').inputValue()==='None',`${width}: health answers restored`);
  check(await page.locator('[name=training_experience]').inputValue()==='',`${width}: empty optional answer is safe`);
  await page.locator('[name=private_additional_notes]').fill('Updated by test athlete');await page.locator('#hubAccountOnboardingForm button[type=submit]').click();await page.waitForURL('**/#/hub/athlete');
  check(athlete.onboarding_data.scheduleNotes.includes('Updated by test athlete'),`${width}: existing setup can be updated`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: dashboard fits viewport`);
  check(errors.length===0,`${width}: no JavaScript errors: ${errors}`);
  console.log(`${width}px: private sign-in, questionnaire, failed-save retry, real handler validation, persistence, update and Week 1 passed`);
  await context.close();
 }
 console.log(`${checks} browser assertions passed (synthetic authentication and in-memory repository; not a live Nigel login).`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
