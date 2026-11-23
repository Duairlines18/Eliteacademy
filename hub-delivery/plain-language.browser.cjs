'use strict';
// Isolated browser fixtures only: no real accounts or backend writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const {shapeBootstrap}=await import('../supabase/functions/_shared/hub-core.ts');
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(process.cwd(),name)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
 const payload=shapeBootstrap({role:'athlete',cohort:{id:'test',name:'Test School',current_week:2},programme:{id:'test',name:'Test Foundation',duration_weeks:4},week:{week_number:2,status:'live',verification_status:'verified',published_at:'2026-11-09'},trainingDays:[{id:'d1',day_key:'Monday',title:'Monday — Running + Strength'}],blocks:[{training_day_id:'d1',sort_order:1,title:'Main session',content:{watch:'Stop if pain returns.',prescriptions:[{instruction:'4 × 20m at 80%; rest 2 minutes.'},{exerciseCode:'STR01',dosage:'2 × 8/leg',cues:'Only if pain-free. Keep your knees controlled.'},{instruction:'Record any pain after the session.'}]}}],exercises:[{id:'test',code:'STR01',name:'Split Squat',video_url:'https://www.youtube.com/shorts/fq72qz8JHtU',active:true}]});
 let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
 try{
 for(const width of [390,1440])for(const audience of ['parent','private-athlete','school','professional']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({audience,origin})=>{if(location.origin!==origin)return;localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify(audience==='school'?{role:'athlete',token:'fixture'}:{role:'athlete',mode:'account',audience}));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};},{audience,origin:base});
  await page.route('**/*',async route=>{if(route.request().url().startsWith(base))return route.continue();if(route.request().url().includes('/functions/v1/')){const action=route.request().postDataJSON()?.action;return route.fulfill({json:action==='checkin-state'?{checkins:{enabled:false}}:action==='bootstrap'?{...payload,audience:audience==='school'?null:audience,athlete:{displayName:'Test Athlete'},delivery:{model:'private-athlete',copyWorkout:true}}:action==='profile'?{onboardingComplete:true,onboarding:{}}:action==='library'?{exercises:payload.exercises}:{completions:[]}});}return route.abort();});
  await page.goto(base+'/#/hub/session/d1');
  const sheet=page.locator('.hub-athlete-one-sheet');await sheet.waitFor();
  const text=await sheet.innerText();
  ok(text.indexOf('4 × 20m')<text.indexOf('Split Squat'),`${audience}/${width}: running comes first`);
  ok(text.indexOf('Record any pain')>text.indexOf('Split Squat'),`${audience}/${width}: final instruction stays last`);
  const dropdown=sheet.locator('details[data-athlete-inline-demo]').filter({hasText:'Split Squat'});
  const cue=dropdown.locator('.hub-visible-coach-note').filter({hasText:'Only if pain-free'});
  ok(await sheet.locator('.hub-compact-movement > :is(.hub-visible-coach-note,.hub-dose-help,.hub-term-help)').count()===0,`${audience}/${width}: movement guidance stays inside the dropdown`);
  ok(!(await cue.isVisible()),`${audience}/${width}: collapsed row stays compact`);
  await dropdown.locator('summary').click();
  ok(await cue.isVisible(),`${audience}/${width}: assigned condition accessible`);
  await dropdown.getByRole('button',{name:'Play Split Squat demonstration'}).click();
  await dropdown.locator('iframe').waitFor();
  ok((await dropdown.locator('iframe').getAttribute('src')).includes('/embed/fq72qz8JHtU'),`${audience}/${width}: exact inline demo retained`);
  await dropdown.locator('summary').click();
  await dropdown.locator('iframe').waitFor({state:'detached'});
  ok(text.includes('2 × 8/leg')&&!text.includes('8 repetitions on each leg'),`${audience}/${width}: collapsed row shows the prescribed dose`);
  ok(text.includes('2 minutes'),`${audience}/${width}: rest is visible`);
  const effort=sheet.getByText(/percentage shows effort/);
  ok(!(await effort.isVisible()),`${audience}/${width}: collapsed running row keeps effort help inside`);
  const run=sheet.locator('details[data-athlete-inline-demo]').filter({hasText:'4 × 20m'});
  await run.locator('summary').click();
  ok(await effort.isVisible(),`${audience}/${width}: effort guidance remains available`);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${audience}/${width}: no horizontal overflow`);
  if(audience==='school'||audience==='private-athlete'){
   await page.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const presenter=page.getByRole('dialog',{name:'Exercise demos'});
   await presenter.getByRole('button',{name:'Play demo'}).click();
   ok((await presenter.locator('iframe').getAttribute('src')).includes('/embed/fq72qz8JHtU'),`${audience}/${width}: exact demo retained`);
   await presenter.getByRole('button',{name:'Close',exact:true}).click();
  }
  if(audience==='parent'){
   await page.getByRole('button',{name:'Full-screen demos',exact:true}).click();
   const presenter=page.getByRole('dialog',{name:'Exercise demos'});
   await presenter.getByRole('button',{name:'Next',exact:true}).click();
   await presenter.getByRole('heading',{name:'Split Squat'}).waitFor();
   ok((await presenter.innerText()).includes('2 × 8/leg'),`parent/${width}: full-screen dose preserved`);
   ok((await presenter.innerText()).includes('Only if pain-free'),`parent/${width}: full-screen condition visible`);
   await presenter.getByRole('button',{name:'Close',exact:true}).click();
  }
  ok(errors.length===0,`${audience}/${width}: no browser errors: ${errors}`);
  await context.close();
 }
 console.log(`Plain-language browser QA: ${checks} checks passed across parent, private athlete, school and professional at 390/1440px.`);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
