'use strict';
// Synthetic accounts only; no production requests, credentials or writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=req.url.split('?')[0];if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{for(const audience of ['parent','private-athlete'])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500});
  await context.addInitScript(({audience,base})=>{
   if(location.origin!==base)return;
   localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({mode:'account',role:'athlete',audience}));
   window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}})};
  },{audience,base});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0,bootstraps=0,visits=0,due=false;
  const exercise={code:'STR01',title:'Split Squat',videoId:'abcdefghijk',description:'Controlled movement.',coachingCues:'Cue: Stay tall. Avoid: Rushing.',active:true};
  const day={id:'day-1',day:'Monday',title:'Navigation Strength',prescriptions:Array.from({length:20},()=>({exerciseCode:exercise.code,dosage:'2 × 6',rest:'60 sec'}))};
  let releaseHistory;
  const historyResponse=new Promise(resolve=>releaseHistory=resolve);
  await page.route('**/*',async route=>{
   const request=route.request(),url=request.url();if(url.startsWith(base))return route.continue();if(url.startsWith('https://www.youtube-nocookie.com/embed/'))return route.fulfill({contentType:'text/html',body:'<title>Synthetic exercise demo</title>'});
   if(!url.includes('/functions/v1/'))return route.abort();
   const body=request.postDataJSON()||{};let data={};
   if(body.action==='checkin-state'){
    checks++;await new Promise(r=>setTimeout(r,120));data={checkins:{enabled:true,held:false,requirements:[],due:due?[{id:'next',kind:'start',week_number:10,period_start:'2026-11-16',revision:0}]:[]}};
   }
   if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Speed'],trainingEnvironment:'Home',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Approved\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}};
   if(body.action==='bootstrap'){bootstraps++;data={contentStatus:'published',audience,viewer:{firstName:'Synthetic'},athlete:{id:'synthetic',displayName:'Synthetic'},delivery:{model:audience,copyWorkout:true},programme:{id:'synthetic',week:10,totalWeeks:10,title:'Navigation programme',sessions:[day]},exercises:[exercise]};}
   if(body.action==='set')data={completion:{sessionKey:body.sessionKey,itemKey:body.itemKey,completed:body.completed}};
   if(body.action==='history'){await historyResponse;data={programme:{week:9,sessions:[{...day,title:'Synthetic history'}]},exercises:[exercise]};}
   if(body.action==='record-visit'){
    visits++;
    assert.equal(request.headers().authorization,'Bearer synthetic');
    if(visits===1)return route.abort('internetdisconnected');
    data={recorded:true};
   }
   if(body.action==='list')data={completions:[]};
   await route.fulfill({json:data});
  });
  const isVisit = request => request.method()==='POST' && request.postDataJSON()?.action==='record-visit';
  const failedVisit = page.waitForEvent('requestfailed', {predicate:isVisit});
  await page.goto(base+'/#/hub/athlete');const dashboard=page.locator('a[href="#/hub/session/day-1"]').first();await dashboard.waitFor();
  await failedVisit;
  assert.equal(visits,1,'restored session records on opening the programme');
  const retriedVisit = page.waitForResponse(response=>isVisit(response.request()) && response.ok());
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await retriedVisit;
  assert.equal(visits,2,'offline visit is retried when connectivity returns');
  await page.evaluate(()=>{
   window.__navigationFlashes=[];
   new MutationObserver(()=>{const text=document.querySelector('#hub-root')?.textContent||'';if(/Checking your weekly check-in|Loading your programme|Validating your Hub session/.test(text))window.__navigationFlashes.push(text)}).observe(document.querySelector('#hub-root'),{childList:true,subtree:true});
  });
  const workout=page.locator('[data-private-present]');
  await dashboard.click();await workout.waitFor();
  const details=page.locator('[data-athlete-inline-demo]').nth(12);
  await details.locator('summary').click();
  await details.getByRole('button',{name:'Play Split Squat demonstration'}).click();
  const frame=details.locator('iframe');
  await frame.waitFor();
  const scroll=()=>page.evaluate(()=>window.scrollY);
  const position=await scroll();
  assert.ok(position>0,'later movement requires scrolling');
  const previouslyChecked=checks;
  await page.evaluate(()=>{
   window.dispatchEvent(new Event('focus'));
   window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForLoadState('networkidle');
  assert.ok(checks>previouslyChecked,'open workout still verifies check-in state on focus');
  assert.equal(await frame.count(),1,'focus and same-route history events retain the playing demo');
  assert.ok(Math.abs(await scroll()-position)<=2,'focus retains the page scroll offset');
  await details.locator('summary').click();
  await frame.waitFor({state:'detached'});
  await details.locator('summary').click();
  if(audience==='parent'){
   const complete=details.locator('..').locator('[data-completion-toggle]');
   await complete.scrollIntoViewIfNeeded();
   const beforeSave=await scroll();
   await complete.click();
   await page.waitForFunction(()=>document.activeElement?.dataset.completed==='true');
   assert.equal(await details.evaluate(el=>el.open),true,'completion retains the open dropdown');
   assert.ok(Math.abs(await scroll()-beforeSave)<=2,'completion retains scroll');
  }
  const workoutPosition=await scroll();
  await page.evaluate(()=>location.hash='#/hub/athlete');
  await dashboard.waitFor();
  await page.goBack();await workout.waitFor();
  assert.equal(await details.evaluate(el=>el.open),true,'browser Back restores the open dropdown');
  await page.waitForFunction(top=>Math.abs(window.scrollY-top)<=2,workoutPosition,{timeout:2000}).catch(async error=>{
   throw new Error(`Browser Back scroll expected ${workoutPosition}, observed ${await scroll()}`,{cause:error});
  });
  await page.goForward();await dashboard.waitFor();
  await dashboard.click();await workout.waitFor();
  await page.getByRole('link',{name:'← Back to Week',exact:true}).click();await dashboard.waitFor();

  const historyRequest=page.waitForRequest(request=>request.method()==='POST'&&request.postDataJSON()?.action==='history');
  await page.evaluate(()=>location.hash='#/hub/history/9');
  await historyRequest;
  await page.evaluate(()=>location.hash='#/hub/session/day-1');
  await workout.waitFor();
  releaseHistory();
  await page.waitForLoadState('networkidle');
  assert.equal(await workout.count(),1,'late historical data cannot replace the current workout');
  await page.evaluate(()=>location.hash='#/hub/history/9');
  const historical=page.locator('.hub-history-session');
  await historical.waitFor();
  assert.equal(await historical.locator('[data-athlete-inline-demo]').count(),20,'history uses compact disclosure rows');
  assert.equal(await historical.locator('[data-completion-toggle]').count(),0,'history stays read-only');
  await page.evaluate(()=>location.hash='#/hub/athlete');await dashboard.waitFor();
  await page.waitForLoadState('networkidle');
  const before=checks;
  const focusCheck=page.waitForResponse(response=>response.request().method()==='POST'&&response.request().postDataJSON()?.action==='checkin-state');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await focusCheck;
  assert.ok(checks>before,'focus still verifies check-in state');
  assert.equal(visits,2,'focus and workout navigation do not send duplicate visits');
  assert.equal(bootstraps,1,'fresh programme is retained on focus');
  assert.deepEqual(await page.evaluate(()=>window.__navigationFlashes),[],'navigation never flashes loading/check-in screens');
  due=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#mandatoryCheckinForm').waitFor();
  assert.equal(await workout.count(),0,'new mandatory check-in blocks training');
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`${audience} ${width}px: open, Back to Week, browser Back/Forward and focus have no loading flashes; due check-in remains enforced`);
  await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
