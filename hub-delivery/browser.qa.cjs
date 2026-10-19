// Supply a private fixture export; never commit athlete data or credentials.
// This is real browser/clipboard QA with fixture authentication, not a live-login test.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fixtures=JSON.parse(fs.readFileSync(process.env.HUB_QA_FIXTURES,'utf8'));
(async()=>{
 const server=http.createServer((req,res)=>{try{const p=decodeURIComponent(req.url.split('?')[0]),f=path.join(process.cwd(),p==='/'?'index.html':p);res.setHeader('Content-Type',/\.(m?js)$/.test(f)?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const launch=()=>chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu']});
 let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++};const base='http://127.0.0.1:'+server.address().port;
 try{for(const name of ['Andria','Larry','Pride','Okello'])for(const audience of ['parent','private-athlete'])for(const width of [320,390,1280]){
  browser=await launch();
  const original=fixtures.find(f=>f.name===name);assert.ok(original,'Missing fixture '+name);
  const data={...original.data,audience,delivery:{model:audience==='parent'?'parent-managed':'private-athlete',copyWorkout:audience!=='parent'}};
  data.historyWeeks=[{week_number:5,phase:'Published history'}];data.programmeSchedule=[{week_number:data.programme.week+1,phase:'Published next week',status:'live',verification_status:'verified',published_at:'2026-10-19'}];
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/**',route=>{const body=route.request().postDataJSON()||{};let json={};if(body.action==='profile')json={onboardingComplete:true};else if(body.action==='bootstrap')json=data;else if(body.action==='library')json={exercises:data.exercises};else if(body.action==='linked')json={athletes:[]};else if(body.action==='list')json={completions:[],clips:[]};return route.fulfill({json});});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:"window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture-only',user:{email:'qa@example.invalid'}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"}));
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.addInitScript(audience=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({mode:'account',audience,role:'athlete'}));window.DU_TECHNIQUE_REVIEW_ENABLED=false;},audience);
  await page.goto(base+'/#/hub/athlete',{waitUntil:'domcontentloaded'});await page.locator('.hub-week-calendar').waitFor({timeout:15000});
  ok(await page.locator('.hub-week-calendar article').count()===7,'seven calendar days');ok(await page.locator('.hub-week-calendar').count()===1,'one shared overview');
  ok(await page.locator('#hub-root h1').innerText()===name,'athlete identity');ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overview fits '+width);
  if(audience==='private-athlete'){ok(await page.locator('a[href="#/hub/history/5"]').count()===1,'published history navigation retained');ok(await page.locator('a[href="#/hub/programme-week/'+(data.programme.week+1)+'"]').count()===1,'next published week navigation retained');}
  const workout=data.programme.sessions.find(s=>!/[Ww]arm.?[Uu]p/.test(s.day));
  await page.goto(base+'/#/hub/session/'+workout.id,{waitUntil:'domcontentloaded'});await page.locator('.hub-athlete-session-title').waitFor({timeout:15000});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'workout fits '+width);
  if(workout.athleteNote)ok((await page.locator('#hub-root').innerText()).includes(workout.athleteNote),'saved instructions visible');
  if(audience==='parent'){
    ok(await page.locator('[data-athlete-copy]').count()===0,'parent has no copy button');
    await page.locator('[data-workout-mode="guided"]').click();ok(await page.locator('.hub-guided-card').count()===1,'parent guided mode works');
  }else{
    const copy=page.locator('[data-athlete-copy]');ok(await copy.count()===1,'private copy button');
    ok(await copy.evaluate(el=>el.getBoundingClientRect().height>=44),'copy touch target');await copy.click();await page.getByText('Copied!',{exact:true}).waitFor();
    const text=await page.evaluate(()=>navigator.clipboard.readText());ok(text.includes(name)&&text.includes('Week '+data.programme.week)&&text.includes(workout.title),'clipboard identity/week/title');
    for(const instruction of workout.items||[])ok(text.includes(instruction),'clipboard retains original published instruction');
    for(const prescription of workout.prescriptions||[]){if(prescription.dosage)ok(text.includes(prescription.dosage),'clipboard dose');if(prescription.rest)ok(text.includes(prescription.rest),'clipboard rest');}
    if(workout.watch)ok(text.includes(workout.watch),'clipboard safety');if(workout.athleteNote)ok(text.includes(workout.athleteNote),'clipboard saved instructions');
    ok(!/javascript:|undefined/.test(text),'clipboard contains no invalid placeholders');
    if(name==='Larry'&&width===390){await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=()=>false;});await copy.click();ok(await page.locator('.hub-copy-fallback').inputValue()===text,'clipboard denial preserves complete selectable output');}
  }
  ok(errors.length===0,'no runtime errors: '+errors.join('; '));await context.close();await browser.close();console.log(name+' '+audience+' '+width+'px passed');
 }
 for(const role of ['athlete','staff']){
  browser=await launch();const original=fixtures.find(f=>f.name==='Larry'),data=structuredClone(original.data);data.programme.school='Authorized School QA';data.audience=null;const grouped=['Form 2 — Group stride — 2 × 20m','Form 3 — Group stride — 3 × 30m'];data.programme.sessions[0].items.push(...grouped);data.programme.sessions[0].itemSections.push({title:'Group dose test',order:990,items:grouped,videoLinks:[]});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/**',route=>{const body=route.request().postDataJSON()||{};return route.fulfill({json:body.action==='bootstrap'?data:body.action==='library'?{exercises:data.exercises}:body.action==='list'?{completions:[]}:{} });});
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.addInitScript(role=>{localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role,token:'fixture-session-not-production'}));localStorage.setItem('duAirlinesSchoolGroupV1','Form 2');window.DU_TECHNIQUE_REVIEW_ENABLED=false;},role);
  const workout=data.programme.sessions[0];await page.goto(base+'/#/hub/session/'+workout.id,{waitUntil:'domcontentloaded'});await page.locator('[data-athlete-copy]').waitFor();await page.locator('[data-athlete-copy]').click();await page.getByText('Copied!',{exact:true}).waitFor();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());ok(copied.includes('Authorized School QA'),'authorized school identity copied');for(const row of workout.items||[]){if(role==='athlete'&&row.startsWith('Form 3'))continue;ok(copied.includes(row),'authorized school instructions copied');}ok(role==='staff'?copied.includes('Group stride — 3 × 30m'):!copied.includes('Group stride — 3 × 30m'),'school group scope preserved');ok(errors.length===0,'school runtime errors: '+errors.join('; '));
  await context.close();await browser.close();console.log('School '+role+' 390px clipboard passed');
 }
 console.log(checks+' browser checks passed. Authentication/API were fixtures; clipboard was real.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
