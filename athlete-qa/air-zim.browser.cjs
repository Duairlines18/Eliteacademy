// Rendering QA uses a private, server-shaped production snapshot supplied outside git.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const bundles=JSON.parse(fs.readFileSync(process.env.AIR_ZIM_QA_BUNDLES));
 const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(process.cwd(),name==='/'?'index.html':name);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 const mainPrescription=page=>page.locator('.hub-athlete-phase:not(.hub-athlete-warmup)').evaluateAll(sections=>sections.map(s=>({heading:s.querySelector('.hub-athlete-phase-heading')?.textContent,rows:[...s.querySelectorAll('.hub-athlete-movement')].map(row=>({line:row.querySelector('.hub-athlete-movement-line')?.textContent,rest:[...row.children].filter(x=>x.tagName==='SMALL').map(x=>x.textContent)}))})));
 let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++};
 try{for(const fixture of bundles){for(const width of [390,1440]){
  let activeData=fixture.beforeData||fixture.data;
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();let videoRequest='';const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/**',route=>{const body=route.request().postDataJSON()||{};let data=body.action==='profile'?{onboardingComplete:true}:['bootstrap','programme-week'].includes(body.action)?activeData:body.action==='library'?{exercises:fixture.library||fixture.data.exercises}:{completions:[]};return route.fulfill({json:data})});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:"window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'qa-render-only'}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"}));
  await page.route('https://www.youtube.com/**',route=>{videoRequest=route.request().url();return route.fulfill({contentType:'text/html',body:'<p>Video endpoint intercepted for QA</p>'})});
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.addInitScript(({account})=>{if(location.hostname!=='127.0.0.1')return;localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify(account?{mode:'account',audience:'private-athlete',role:'athlete'}:{role:'athlete',token:'qa-render-only-session'}));localStorage.setItem('duAirlinesSchoolGroupV1','Form 2');window.DU_TECHNIQUE_REVIEW_ENABLED=false;},{account:fixture.data.audience==='private-athlete'});
  const session=fixture.excluded?fixture.data.programme.sessions[0]:fixture.data.programme.sessions.find(s=>s.prescriptions.some(p=>p.sectionTitle==='Air Zim Warm-Up'));
  await page.goto(`http://127.0.0.1:${server.address().port}/#/hub/session/${session.id}`,{waitUntil:'domcontentloaded'});
  await page.locator('.hub-athlete-phase').first().waitFor();
  const mainBefore=await mainPrescription(page);
  activeData=fixture.data;
  await page.goto(`http://127.0.0.1:${server.address().port}/?after=1#/hub/session/${session.id}`,{waitUntil:'domcontentloaded'});
  await page.locator('.hub-athlete-phase').first().waitFor();
  const warm=page.locator('.hub-athlete-warmup').filter({hasText:'Air Zim Warm-Up'});
  if(fixture.excluded){ok(await warm.count()===0,'school prototype excludes complete recipe');ok(!(await page.locator('#hub-root').innerText()).includes('Air Zim'),'school copy contains no recipe');}
  else{await warm.waitFor();
  ok(await warm.locator('summary > span').evaluate(x=>parseFloat(getComputedStyle(x).fontSize))>=14,'warm-up title is readable');
  ok(await warm.count()===1,`${fixture.name}/${width}: one warm-up`);ok(await warm.getAttribute('open')===null,'collapsed initially');
  await warm.locator('summary').first().click();ok(await warm.getAttribute('open')!==null,'expands by click');
  ok(await warm.locator('.hub-athlete-movement').count()===16,'16 ordered exercise entries');
  const actual=await warm.locator('.hub-athlete-movement-line strong').allTextContents();
  const expected=session.prescriptions.filter(p=>p.sectionTitle==='Air Zim Warm-Up').map(p=>p.dosage);assert.deepEqual(actual,expected);checks++;
  ok(await warm.locator('h4').count()===6,'six routine stages');
  const links=await warm.locator('a.hub-athlete-demo').evaluateAll(xs=>xs.map(x=>x.href));
  const ex=new Map(fixture.data.exercises.map(x=>[x.code,x]));assert.deepEqual(links,session.prescriptions.filter(p=>p.sectionTitle==='Air Zim Warm-Up').map(p=>ex.get(p.exerciseCode).videoUrl));checks++;
  ok(await warm.locator('small').allTextContents().then(xs=>xs.filter(x=>x.includes('Walk-back recovery')).length)===7,'striders, five mechanics drills and falling starts retain recovery');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
  const lines=await warm.locator('.hub-athlete-movement-line').evaluateAll(xs=>xs.map(x=>{const e=x.getBoundingClientRect();return e.right<=innerWidth+1&&e.left>=0}));ok(lines.every(Boolean),'all rows fit viewport');
  const body=await page.locator('#hub-root').innerText();
  if(session.watch?.includes('hamstring return'))ok(body.includes('not clearance for maximal sprinting'),'Meezy safeguard visible');
  if(process.env.AIR_ZIM_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.AIR_ZIM_SCREENSHOT_DIR,`warmup-${width}.png`),fullPage:true});
  await warm.locator('a.hub-athlete-demo').first().click();await page.locator('#hubVideoModal').waitFor({state:'visible'});ok(await page.locator('#hubVideoModal iframe').getAttribute('src').then(x=>x.includes('bj8mm2fTEfU')),'correct video opens in modal');await page.keyboard.press('Escape');
  }
  assert.deepEqual(await mainPrescription(page),mainBefore,'all main workout rows and rest remain identical to pre-change rendering');checks++;
  const base=`http://127.0.0.1:${server.address().port}`;
  const tool=page.locator('.hub-assigned-warmup-tool');
  ok(await tool.count()===(fixture.excluded?0:1),'day has one assigned warm-up shortcut only when authorized');
  await page.goto(base+'/#/hub/athlete',{waitUntil:'domcontentloaded'});
  if(!fixture.excluded){
    await page.locator('.hub-parent-session-grid').waitFor();
    const cards=page.locator('.hub-parent-session-grid .hub-parent-session-card');
    ok(await cards.count()===fixture.data.programme.sessions.length,'only actual workouts count as training days');
    ok(!(await cards.allTextContents()).some(x=>/Air Zim|Preview/.test(x)),'Air Zim never occupies a numbered day');
    ok(await cards.first().locator('.hub-parent-session-eyebrow').innerText()==='DAY 1','first actual workout remains Day 1');
    ok(await tool.count()===1,'one reusable tool below day grid');
    ok(await tool.evaluate(e=>e.compareDocumentPosition(document.querySelector('.hub-parent-session-grid'))&Node.DOCUMENT_POSITION_PRECEDING),'tool follows the workout day grid');
    if(fixture.name==='Coach Du QA'){
      ok(await cards.count()===7,'QA preview retains original seven days');
      ok((await cards.first().innerText()).includes('Easy Aerobic Run'),'QA Day 1 is the original aerobic workout');
    }
    if(fixture.name==='Coach Du QA'){
      await page.goto(base+'/#/hub/programme-week/5',{waitUntil:'domcontentloaded'});
      await page.locator('.hub-preview-grid').waitFor();
      ok(await page.locator('.hub-preview-day').count()===7,'published QA week retains seven actual days');
      ok(await tool.count()===1,'published week has one reusable current-programme reference');
      await page.goto(base+'/#/hub/programme-week/5/day/0',{waitUntil:'domcontentloaded'});
      await page.locator('.hub-athlete-warmup').waitFor();
      ok(await tool.count()===1,'published day has reusable warm-up reference');
    }
    for(const day of fixture.data.programme.sessions){
      await page.goto(base+'/#/hub/session/'+day.id,{waitUntil:'domcontentloaded'});
      await page.locator('.hub-athlete-session-title').waitFor();
      ok(await tool.count()===1,'warm-up reference reachable from every day including rest without changing its prescription');
    }
  }
  await page.goto(base+'/#/hub/library',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Explore Exercise Library',exact:true}).waitFor();
  ok(await tool.count()===(fixture.excluded?0:1),'library offers recipe only with assigned server content');
  if(!fixture.excluded)await tool.getByRole('link',{name:'Open warm-up →',exact:true}).click();
  else await page.goto(base+'/#/hub/library/air-zim',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Air Zim Warm-Up',exact:true}).waitFor();
  if(fixture.excluded){
    ok(await page.locator('.hub-athlete-warmup').count()===0,'direct recipe route cannot expose school recipe');
    ok((await page.locator('#hub-root').innerText()).includes('not assigned'),'unassigned route explains access');
  }else{
    const reference=page.locator('.hub-athlete-warmup');
    await reference.first().waitFor();ok(await reference.count()===1,'one complete reusable recipe');await reference.locator('summary').first().click();
    ok(await reference.locator('.hub-athlete-movement').count()===16,'tool preserves all 16 entries');
    const expected=session.prescriptions.filter(p=>p.sectionTitle==='Air Zim Warm-Up');
    assert.deepEqual(await reference.locator('.hub-athlete-movement-line strong').allTextContents(),expected.map(p=>p.dosage));checks++;
    const ex=new Map(fixture.data.exercises.map(x=>[x.code,x]));
    assert.deepEqual(await reference.locator('a.hub-athlete-demo').evaluateAll(xs=>xs.map(x=>x.href)),expected.map(p=>ex.get(p.exerciseCode).videoUrl));checks++;
    ok((await page.locator('#hub-root').innerText()).includes('return-to-running limits take priority'),'reference retains safety priority');
    if(session.watch?.includes('hamstring return'))ok((await page.locator('#hub-root').innerText()).includes('not clearance for maximal sprinting'),'Meezy warning survives standalone tool');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'reusable tool fits viewport');
  }
  await page.goto(`http://127.0.0.1:${server.address().port}/#/hub/warm-up`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Warm-Up & Mobility Exercises',exact:true}).waitFor();
  ok(!(await page.locator('#hub-root').innerText()).includes('COMPLETE WARM-UP'),'legacy recipe route becomes individual exercise category');
  ok(await page.locator('.hub-exercise-card-v3').count()>0,'individual videos retained');
  if(fixture.excluded&&width===390){
   const map={wu:['warm-up','mobility-recovery'],mob:['mobility-recovery'],act:['activation-control','strength'],ank:['ankle-lower-leg'],core:['core'],iso:['strength'],ply:['plyometric-foundation'],post:['sprint-mechanics','warm-up'],run:['acceleration','warm-up'],spr:['sprint-mechanics','warm-up'],str:['strength'],acc:['acceleration']};
   for(const slug of new Set(Object.values(map).flat())){
    await page.goto(`http://127.0.0.1:${server.address().port}/#/hub/library/${slug}`,{waitUntil:'domcontentloaded'});
    const titles={'warm-up':'Warm-Up & Mobility Exercises','mobility-recovery':'Mobility & Recovery','activation-control':'Activation & Hip Control',strength:'Strength','ankle-lower-leg':'Ankle & Lower-Leg Capacity',core:'Core','plyometric-foundation':'Plyometrics & Landing Control','sprint-mechanics':'Sprint Mechanics',acceleration:'Acceleration'};
    await page.getByRole('heading',{name:titles[slug],exact:true}).waitFor();
    const expected=(fixture.library||[]).filter(ex=>(ex.category||[]).some(tag=>(map[tag]||[tag]).includes(slug))).map(ex=>ex.id).sort();
    await page.locator('.hub-exercise-card-v3').first().waitFor();
    const actual=await page.locator('.hub-exercise-card-v3').evaluateAll(xs=>xs.map(x=>x.id.replace(/^exercise-/,'' )).sort());
    assert.deepEqual(actual,expected,`all exercise records remain discoverable in ${slug}`);checks++;
   }
  }
  ok(errors.length===0,`no runtime errors: ${errors}`);
  if(process.env.AIR_ZIM_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.AIR_ZIM_SCREENSHOT_DIR,`library-${width}.png`),fullPage:true});
  await context.close();console.log(`${fixture.name} ${width}px passed`);
 }}console.log(`${checks} responsive rendering checks passed; fixture-based UI tests do not substitute for live authentication tests.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
