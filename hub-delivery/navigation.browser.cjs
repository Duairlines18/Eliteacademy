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
  await context.addInitScript(audience=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({mode:'account',role:'athlete',audience}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}})};},audience);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0,bootstraps=0,due=false;
  await page.route('**/*',async route=>{
   const request=route.request(),url=request.url();if(url.startsWith(base))return route.continue();if(!url.includes('/functions/v1/'))return route.abort();
   const body=request.postDataJSON()||{};let data={};
   if(body.action==='checkin-state'){
    checks++;await new Promise(r=>setTimeout(r,120));data={checkins:{enabled:true,held:false,requirements:[],due:due?[{id:'next',kind:'start',week_number:10,period_start:'2026-11-16',revision:0}]:[]}};
   }
   if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Speed'],trainingEnvironment:'Home',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Approved\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}};
   if(body.action==='bootstrap'){bootstraps++;data={contentStatus:'published',audience,viewer:{firstName:'Synthetic'},athlete:{id:'synthetic',displayName:'Synthetic'},delivery:{model:audience,copyWorkout:true},programme:{id:'synthetic',week:10,totalWeeks:10,title:'Navigation programme',sessions:[{id:'day-1',day:'Monday',title:'Navigation Strength',prescriptions:[{exerciseCode:'STR01',dosage:'2 × 6',rest:'60 sec'}]}]},exercises:[{code:'STR01',title:'Split Squat',description:'Controlled movement.',coachingCues:'Cue: Stay tall. Avoid: Rushing.',active:true}]};}
   if(body.action==='list')data={completions:[]};
   await route.fulfill({json:data});
  });
  await page.goto(base+'/#/hub/athlete');const dashboard=page.locator('a[href="#/hub/session/day-1"]').first();await dashboard.waitFor();
  await page.evaluate(()=>{
   window.__navigationFlashes=[];
   new MutationObserver(()=>{const text=document.querySelector('#hub-root')?.textContent||'';if(/Checking your weekly check-in|Loading your programme|Validating your Hub session/.test(text))window.__navigationFlashes.push(text)}).observe(document.querySelector('#hub-root'),{childList:true,subtree:true});
  });
  const workout=page.locator('[data-workout-mode="guided"]');
  await dashboard.click();await workout.waitFor();
  await page.getByRole('link',{name:'← Back to Week',exact:true}).click();await dashboard.waitFor();
  await page.goBack();await workout.waitFor();await page.goForward();await dashboard.waitFor();
  const before=checks;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForLoadState('networkidle');assert.ok(checks>before,'focus still verifies check-in state');
  assert.equal(bootstraps,1,'fresh programme is retained on focus');
  assert.deepEqual(await page.evaluate(()=>window.__navigationFlashes),[],'navigation never flashes loading/check-in screens');
  due=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#mandatoryCheckinForm').waitFor();
  assert.equal(await workout.count(),0,'new mandatory check-in blocks training');
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`${audience} ${width}px: open, Back to Week, browser Back/Forward and focus have no loading flashes; due check-in remains enforced`);
  await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
