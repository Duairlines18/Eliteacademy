'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const {handleParentRequest}=await import('../supabase/functions/_shared/parent-handler.ts');
 const {handlePrivateAthleteRequest}=await import('../supabase/functions/_shared/private-athlete-handler.ts');
 const server=http.createServer((req,res)=>{try{let name=req.url.split('?')[0];if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true});
 try{for(const audience of ['parent','private-athlete'])for(const width of [390,1440]){
  const parent=audience==='parent',handler=parent?handleParentRequest:handlePrivateAthleteRequest;
  const req={id:'50000000-0000-4000-8000-000000000001',kind:parent?'end':'start',calendar_weekly:parent,week_number:10,period_start:parent?'2026-11-09':'2026-11-16',due_date:parent?'2026-11-15':'2026-11-16',revision:0,payload:null,submitted_at:null};
  const state={enabled:true,today:'2026-11-16',timezone:'America/Chicago',requirements:[req],due:[req],held:false,holds:[]};let failStatus=false,failSave=true,saves=0,bootstraps=0;
  const repository={weeklyCheckinState:async(actor,role)=>{assert.equal(actor,'synthetic-user');assert.equal(role,audience);if(failStatus)throw Error('offline');return structuredClone(state);},saveWeeklyCheckin:async(actor,role,id,submission,payload,revision,safety)=>{if(failSave)throw Error('offline');saves++;req.payload=payload;req.submitted_at='2026-11-16T16:00Z';req.revision++;state.due=[];state.held=safety;return {saved:true,id:'feedback',revision:req.revision};}};
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500});
  await context.addInitScript(audience=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role:'athlete',mode:'account',audience}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})}})};},audience);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const request=route.request(),url=request.url();if(url.startsWith(base))return route.continue();if(!url.includes('/functions/v1/'))return route.abort();const body=request.postDataJSON()||{};
   if(['checkin-state','save-checkin','open-end-checkin','report-checkin-issue'].includes(body.action)){
    const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com','content-type':'application/json'},body:JSON.stringify(body)}),{verifyUser:async()=>({id:'synthetic-user'}),repository});return route.fulfill({status:response.status,json:await response.json()});
   }
   let data={};if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Speed'],trainingEnvironment:'Track',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Track\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}};
   if(body.action==='bootstrap'){bootstraps++;data={audience,contentStatus:'published',athlete:{displayName:'Synthetic'},viewer:{firstName:'Parent'},delivery:{model:audience,copyWorkout:true},programme:{id:'assigned',title:'Synthetic Programme',week:10,totalWeeks:10,sessions:[{id:'day-1',day:'Monday',title:'Strength',itemSections:[{title:'Strength',items:['Bridge — 2 x 8; rest 60 sec']}]}]},historyWeeks:[],programmeSchedule:[]};}
   if(body.action==='list')data={completions:[]};return route.fulfill({json:data});
  });
  await page.goto(base+'/#/hub/session/day-1');await page.locator('#mandatoryCheckinForm').waitFor();assert.equal(bootstraps,0);assert.equal(await page.locator('#hub-root').getByText('Bridge — 2 x 8; rest 60 sec',{exact:true}).count(),0);
  const choose=async(name,value)=>page.locator(`[name="${name}"][value="${value}"]`).check();
  for(const [name,value] of Object.entries(parent?{completion:'all',challenge:'right',recovery:'good'}:{body:'good',readiness:'ready',plannedOutside:'practice',recentOutside:'no'}))await choose(name,value);
  if(!parent)await page.locator('[name=plannedOutsideDetails]').fill('Soccer on Tuesday');else assert.equal(await page.locator('[name=outside]').count(),0);await page.locator('[name=note]').fill('Keep this note after failure');
  await page.locator('#mandatoryCheckinForm button[type=submit]').click();await page.locator('[data-wc-error]').filter({hasText:'unavailable'}).waitFor();assert.equal(await page.locator('[name=note]').inputValue(),'Keep this note after failure');
  failSave=false;await page.locator('#mandatoryCheckinForm button[type=submit]').click();await page.locator('a[href="#/hub/session/day-1"]').first().waitFor();assert.equal(saves,1);if(!parent)assert.equal(req.payload.plannedOutsideDetails,'Soccer on Tuesday');else assert.equal(req.payload.outside,undefined);
  await page.evaluate(()=>location.hash='#/hub/feedback');await page.locator('[data-wc-amend]').waitFor();await page.locator('[data-wc-amend]').click();await page.locator('#mandatoryCheckinForm').waitFor();assert.equal(await page.locator('[name=note]').inputValue(),'Keep this note after failure');
  if(parent){await choose('recovery','unknown');assert.equal(await page.locator('[name=symptoms]').count(),0);}else assert.equal(await page.locator('[name=body][value=unknown]').count(),0);
  await choose(parent?'recovery':'body',parent?'unwell':'pain');await page.locator('[name=symptoms]').fill('Ankle tightness');await choose('painApplicable','yes');await page.locator('[name=severity]').selectOption('4');await choose('movement','unsure');await page.locator('#mandatoryCheckinForm button[type=submit]').click();await page.getByRole('heading',{name:'Coach Du needs to review this'}).waitFor();assert.equal(state.held,true);assert.equal(req.payload.severity,4);
  await page.getByRole('link',{name:'Safety information',exact:true}).click();await page.getByRole('heading',{name:'Safety information',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Contact Coach Du',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Log out',exact:true}).count(),1);
  state.held=false;failStatus=true;await page.evaluate(()=>location.hash='#/hub/session/day-1');await page.getByRole('heading',{name:'Unable to verify your check-in'}).waitFor();assert.equal(await page.locator('#hub-root').getByText('Bridge — 2 x 8; rest 60 sec',{exact:true}).count(),0);
  failStatus=false;await page.getByRole('button',{name:'Try again',exact:true}).waitFor({state:'visible'});await page.getByRole('button',{name:'Try again',exact:true}).click();assert.equal(new URL(page.url()).hash,'#/hub/session/day-1');await page.locator('#hub-root').getByText('Bridge — 2 x 8; rest 60 sec',{exact:true}).waitFor();
  state.due=[{...req,id:'next-end',kind:'end',payload:null,revision:0,submitted_at:null}];state.requirements.push(state.due[0]);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#mandatoryCheckinForm').waitFor();assert.match(await page.locator('#hub-root').innerText(),parent?/Weekly training review/:/End-of-week/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/checkins-${audience}-${width}.png`,fullPage:true});
  console.log(`${audience} ${width}px: direct route, failed-save retry, outside detail, amendment, safety, support, failed status and foreground transition passed`);await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
