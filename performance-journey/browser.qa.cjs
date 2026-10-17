// Uses actual sanitized journey source JSON supplied outside git. All login/API responses are fixtures.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const sources=JSON.parse(fs.readFileSync(process.env.JOURNEY_QA_SOURCES,'utf8'));
const args=process.env.CHROMIUM_ARGS?JSON.parse(process.env.CHROMIUM_ARGS):['--no-sandbox'];
(async()=>{
 const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(process.cwd(),name==='/'?'index.html':name);res.setHeader('Content-Type',/\.(m?js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const launch=()=>chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args});let checks=0;
 const ok=(v,msg)=>{assert.ok(v,msg);checks++};
 const base='http://127.0.0.1:'+server.address().port;
 try{
 for(const mode of ['private-athlete','parent','school-athlete','staff'])for(const width of [320,390,1280]){
  let source=sources.find(s=>s.name===(mode==='parent'?'Andria':'Pride'))||sources[0];
  if(mode==='school-athlete'||mode==='staff')source={...source,name:'School Performance Cohort',personal_bests:{},evidence:{roster_count:10,respondents:5,shared_submissions:3}};
  browser=await launch();const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  const programme={id:source.programme.id,title:source.programme.name,school:mode.includes('school')||mode==='staff'?source.name:'',sport:source.programme.sport,week:source.current_week,totalWeeks:10,weeklyObjective:source.weeks.at(-1)?.weekly_objective||'',sessions:[{id:'day1',day:'Day 1',title:'Strength & Control',duration:'25 min',prescriptions:[],items:['Follow your assigned training'],playlist:{id:'',url:''}}]};
  const bootstrap={contentStatus:'published',audience:['private-athlete','parent'].includes(mode)?mode:null,viewer:{firstName:source.name},athlete:{displayName:source.name},cohort:{id:'cohort',name:source.name,currentWeek:source.current_week},programme,historyWeeks:[],exercises:[]};
  await page.route('**/functions/v1/**',route=>{const body=route.request().postDataJSON()||{},url=route.request().url();let data={};if(url.endsWith('/performance-journey')){requests.push(body);const current=body.athleteId?sources.find(s=>s.name==='Andria'):source;data={source:current,group:!body.athleteId&&['school-athlete','staff'].includes(mode),parent:mode==='parent',staff:mode==='staff',linked:mode==='parent'?[{id:'11111111-1111-1111-1111-111111111111',name:'Andria'}]:[],roster:mode==='staff'?[{id:'11111111-1111-1111-1111-111111111111',name:'Andria'}]:[],snapshots:[{id:'saved',captured_at:'2026-10-17T12:00:00Z',source:current}]};}else if(body.action==='profile')data={onboardingComplete:true};else if(body.action==='bootstrap')data=bootstrap;else if(body.action==='library')data={exercises:[]};else if(body.action==='linked')data={athletes:[]};else if(body.action==='list')data={completions:[],clips:[]};return route.fulfill({json:data});});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:"window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture-only',user:{email:'qa@example.invalid'}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"}));
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.addInitScript(({mode})=>{const account=['private-athlete','parent'].includes(mode);localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify(account?{mode:'account',audience:mode,role:'athlete'}:{role:mode==='staff'?'staff':'athlete',token:'fixture-session-not-production'}));window.DU_TECHNIQUE_REVIEW_ENABLED=false;},{mode});
  await page.goto(base+'/#/hub/'+(mode==='staff'?'staff':'athlete'),{waitUntil:'domcontentloaded'});
  await page.locator('.duj h2').waitFor();
  ok(await page.locator('.duj').count()===1,'one journey card');
  ok(await page.locator('.duj .duj-step').count()>=2,'illustrated path');
  ok(await page.locator('a[href="#/hub/session/day1"]').count()>0||mode==='staff','training navigation retained');
  ok(await page.locator('.duj').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'card has no horizontal overflow');
  const contrast=await page.locator('.duj').evaluate(root=>{
   const parse=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   return [...root.querySelectorAll('h2,h3,p,strong,summary')].filter(e=>e.getClientRects().length).map(e=>{let p=e,bg;do{bg=getComputedStyle(p).backgroundColor;p=p.parentElement;}while((bg==='rgba(0, 0, 0, 0)'||bg==='transparent')&&p);const a=lum(parse(getComputedStyle(e).color)),b=lum(parse(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  });ok(contrast.every(r=>r>=4.5),'all visible journey text passes 4.5:1 contrast');
  await page.locator('.duj summary').click();ok(await page.locator('.duj .duj-week').count()>0,'source weeks open');
  ok(await page.locator('.duj details').getAttribute('open')!==null,'details expanded');
  await page.selectOption('[data-duj-snapshot]','saved');ok((await page.locator('.duj').innerText()).includes('Historical programme snapshot'),'saved update selectable');
  await page.selectOption('[data-duj-snapshot]','');
  if(mode==='staff'){await page.selectOption('[data-duj-subject]','11111111-1111-1111-1111-111111111111');await page.getByRole('heading',{name:/Andria.*journey/}).waitFor();ok(requests.at(-1).athleteId==='11111111-1111-1111-1111-111111111111','coach athlete selection scoped in request');}
  if(mode==='school-athlete')ok(await page.locator('[data-duj-subject]').count()===0,'shared school athlete has no roster picker');
  await page.goto(base+'/#/hub/journey',{waitUntil:'domcontentloaded'});await page.locator('.duj h2').waitFor();ok(await page.locator('.duj').count()===1,'dedicated journey route');
  ok(errors.length===0,'no runtime errors: '+errors.join('; '));
  if(process.env.JOURNEY_QA_SCREENSHOTS)await page.screenshot({path:path.join(process.env.JOURNEY_QA_SCREENSHOTS,mode+'-'+width+'.png'),fullPage:true});
  await context.close();await browser.close();console.log(mode+' '+width+'px passed');
 }
 // Render every actual private source, including one-week, archived history and reported PB paths.
 browser=await launch();const context=await browser.newContext({viewport:{width:390,height:1000}}),page=await context.newPage();await page.goto(base+'/performance-journey/journey.css');
 for(const src of sources){await page.setContent('<link rel="stylesheet" href="'+base+'/performance-journey/journey.css"><div id="test"></div>');await page.evaluate(async({src,base})=>{const {mount}=await import(base+'/performance-journey/journey-ui.js');mount(document.getElementById('test'),{audience:'private-athlete',request:async()=>({source:src,group:false,snapshots:[]})});},{src,base});await page.locator('.duj h2').waitFor();ok((await page.locator('.duj h2').innerText()).includes(src.name),'actual athlete source renders '+src.name);}
 await context.close();console.log(checks+' browser checks passed. Role/API fixtures are not live login tests.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
