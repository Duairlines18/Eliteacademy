'use strict';
// Synthetic sessions and repository only. No real athlete credentials or writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const {handlePrivateAthleteRequest}=await import('../supabase/functions/_shared/private-athlete-handler.ts');
 const server=http.createServer((req,res)=>{try{let name=req.url.split('?')[0];if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 try{for(const width of [390,1440]){
  let week=7,bootstraps=0,failSave=true;const rows=[];
  const athlete={id:'synthetic-athlete',athlete_user_id:'synthetic-user',programme_id:'assigned',current_week:8,access_status:'active',access_reason:'complimentary',payment_status:'not_required'};
  const repo={findPrivateAthlete:async id=>{assert.equal(id,'synthetic-user');return athlete;},listAssignedPublishedWeeks:async()=>[{week_number:7}],loadAssignedProgrammeWeek:async()=>({cohort:{id:'synthetic-athlete'},programme:{id:'assigned'},week:{week_number:7,status:'completed',verification_status:'verified',published_at:'2026-10-26'},trainingDays:[],blocks:[],exercises:[]}),findFeedbackBySubmissionId:async()=>null,findFeedbackForContext:async()=>null,insertFeedback:async row=>{rows.push(row);return {id:'saved',status:row.status}}};
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500});
  await context.addInitScript(()=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role:'athlete',mode:'account',audience:'private-athlete'}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})}})};const now=Date.now.bind(Date);window.__offset=0;Date.now=()=>now()+window.__offset;});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();if(!url.includes('/functions/v1/'))return route.abort();const body=req.postDataJSON()||{};let data={};
   if(body.action==='checkin-state')return route.fulfill({json:{checkins:{enabled:false}}});
   if(body.action==='profile')data={onboardingComplete:true,onboarding:{sportPathway:'Track',primaryGoals:['Speed / acceleration'],trainingEnvironment:'Track / field',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Track twice\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}};
   if(body.action==='bootstrap'){bootstraps++;data={audience:'private-athlete',contentStatus:'published',athlete:{displayName:'Synthetic Athlete'},viewer:{firstName:'Synthetic'},delivery:{model:'private-athlete',copyWorkout:true},programme:{id:'assigned',title:'Sprint Strength Foundation',week,totalWeeks:10,sessions:[{id:'day-1',day:'Monday',title:'Week '+week+' Strength',itemSections:[{title:'Strength',items:['Bridge — 2 x 8; rest 60 sec']}]}]},historyWeeks:week===8?[{week_number:7}]:[],programmeSchedule:[]};}
   if(body.action==='list')data={completions:[]};
   if(body.action==='save-feedback'){
    if(failSave)return route.fulfill({status:503,json:{error:'Unable to save. Try again.'}});
    const response=await handlePrivateAthleteRequest(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com','content-type':'application/json'},body:JSON.stringify(body)}),{verifyUser:async()=>req.headers().authorization==='Bearer synthetic-token'?{id:'synthetic-user'}:null,repository:repo});return route.fulfill({status:response.status,json:await response.json()});
   }
   return route.fulfill({json:data});
  });
  await page.goto(base+'/#/hub/athlete');await page.locator('a[href="#/hub/session/day-1"]').first().waitFor();assert.match(await page.locator('#hub-root').innerText(),/Week 7/);
  week=8;await page.evaluate(()=>{window.__offset=61000;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>document.querySelector('#hub-root')?.textContent.includes('Week 8 Strength'));
  assert.equal(bootstraps,2);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(bootstraps,2);
  await page.evaluate(()=>location.hash='#/hub/feedback');await page.locator('#feedbackWeek').waitFor();assert.equal(await page.locator('#feedbackWeek').inputValue(),'8');await page.locator('#feedbackWeek').selectOption('7');
  for(const [group,value] of Object.entries({trainingFeel:'Good',completion:'Most',energy:'Normal',pain:'None',improvements:'Strength',programmeChange:'No'}))await page.locator(`[data-choice-group="${group}"]`).getByRole('button',{name:value,exact:true}).click();
  await page.locator('#feedbackNote').fill('Previous-week check-in');await page.locator('#feedbackForm button[type=submit]').click();await page.locator('.hub-feedback-error').waitFor();assert.equal(await page.locator('#feedbackWeek').inputValue(),'7');assert.equal(await page.locator('#feedbackNote').inputValue(),'Previous-week check-in');
  failSave=false;await page.locator('#feedbackForm button[type=submit]').click();await page.locator('.hub-feedback-success').waitFor();assert.equal(rows.length,1);assert.equal(rows[0].week_number,7);assert.equal(rows[0].athlete_id,'synthetic-athlete');assert.equal(athlete.current_week,8);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log(`${width}px: Week 7 → Week 8 focus refresh, throttle, previous-week selection, failed-save retry and real authorized Week 7 save passed`);await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
