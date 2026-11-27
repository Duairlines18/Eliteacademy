'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
 const {shapeParentBootstrap}=await import('../supabase/functions/_shared/parent-core.ts');
 const sql=fs.readFileSync('supabase/rollout/volleyball-garage-warmup/prepare.sql','utf8');
 const phases=['Mobility & Activation','Defensive Position & Control','Reactive Feet & Lateral Control','Libero Defensive Shuffle'];
 const names=['Ankle Rock','90/90 Hip Rotation','Glute Bridge','Lateral Band Walk','Quarter-Squat ISO Hold','Two-Leg Pogos','Lateral Bound + Stick','3-Step Defensive Shuffle'];
 const doses=['1 × 8 each ankle','1 × 5 each side','1 × 10','1 × 8 steps each direction','2 × 15 seconds','2 × 8','1 × 4 each side','3–4 rounds'];
 const mapping=new Map([...sql.matchAll(/\('([A-Z0-9]+)','([A-Za-z0-9_-]{11})'\)/g)].map(([,code,id])=>[code,id]));
 const prescriptions=[...sql.matchAll(/'prescriptions', '(\[[\s\S]*?\])'::jsonb|'(\{\s*"prescriptions":\[[\s\S]*?\]\s*\})'::jsonb/g)]
  .map(([,array,obj])=>array?JSON.parse(array):JSON.parse(obj).prescriptions);
 const writtenLine=sql.match(/'(3-Step Defensive Shuffle — [^']+)'/)[1];
 assert.deepEqual(prescriptions.flat().map(rx=>rx.dosage),doses.slice(0,7));
 const trainingDays=[1,2,3].map(n=>({id:'day-'+n,day_key:'Day '+n,title:'Workout '+n,sort_order:n}));
 trainingDays.push({id:'garage',day_key:'Libero Garage Warm-Up',title:'Test — Libero Garage Warm-Up',sort_order:90,
  duration:'About 8–12 minutes',objective:'Use a mat, mini resistance band and three clear steps each way.\nRest 10–20 seconds between movements.'});
 const blocks=trainingDays.slice(0,3).flatMap(({id})=>[
  {training_day_id:id,block_type:'warmup',sort_order:1,title:'My Du Airlines Warm-Up',content:{prescriptions:[{exerciseCode:'RUN01',dosage:'Progressive 40m'}]}},
  {training_day_id:id,block_type:'exercise',sort_order:2,title:'Strength',content:{prescriptions:[{exerciseCode:'STR02',dosage:'2 × 8'}]}},
 ]);
 blocks.push(...phases.map((title,i)=>({training_day_id:'garage',sort_order:i,block_type:'warmup',title:'Phase '+(i+1)+' — '+title,
  content:i===3?{items:[writtenLine],writtenOnly:true}:{prescriptions:prescriptions[i],...(i?{}:{routineKind:'warm-up',assignedWarmUpProgrammeId:'programme',assignedWarmUpAthleteId:'athlete'})}})));
 const exercises=prescriptions.flat().map(({exerciseCode},i)=>({code:exerciseCode,name:names[i],active:true,video_url:'https://www.youtube.com/shorts/'+mapping.get(exerciseCode)}));
 exercises.push({code:'RUN01',name:'Progressive 40m Build-Up',active:true},{code:'STR02',name:'Step-Up',active:true});
 const payload=shapeParentBootstrap({id:'athlete',display_name:'Test'},{
  cohort:{id:'athlete',name:'Test',current_week:11},programme:{id:'programme',name:'Assigned Volleyball',duration_weeks:14,sport:'Volleyball'},
  week:{week_number:11},trainingDays,blocks,exercises,
 });
 const server=http.createServer((req,res)=>{
  try {let filename=req.url.split('?')[0];if(filename.endsWith('/'))filename+='index.html';
   res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');
   res.end(fs.readFileSync(path.join(process.cwd(),filename)));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:620},hasTouch:true});
   const page=await context.newPage(),completions=new Map(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.addInitScript(()=>{
    localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({role:'athlete',mode:'account',audience:'parent'}));
    window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-parent'}}}),
     onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};
   });
   await page.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(url.startsWith(base))return route.continue();
    if(url.startsWith('https://www.youtube-nocookie.com/embed/'))return route.fulfill({contentType:'text/html',body:'<title>Test video</title>'});
    if(!url.includes('/functions/v1/'))return route.abort();
    const body=request.postDataJSON()||{};
    let data={};
    if(body.action==='profile')data={onboardingComplete:true};
    if(body.action==='bootstrap')data=payload;
    if(body.action==='checkin-state')data={checkins:{enabled:false,requirements:[],due:[]}};
    if(body.action==='list')data={completions:[...completions.values()]};
    if(body.action==='set'){
     assert.equal(request.headers().authorization,'Bearer test-parent');
     assert.equal(body.sessionKey,'garage');
     assert.equal(body.itemKey,'i:3:0:0');
     const row={sessionKey:body.sessionKey,itemKey:body.itemKey,completed:body.completed};
     completions.set(row.itemKey,row);
     data={completion:row};
    }
    return route.fulfill({json:data});
   });
   await page.goto(base+'/#/hub/athlete');
   const main=page.locator('.hub-main');
   await main.getByRole('heading',{name:'Hi, Test'}).waitFor();
   assert.equal(await main.locator('.hub-parent-session-card').count(),3);
   await main.locator('.hub-parent-session-card').first().click();
   const link=main.getByRole('link',{name:'My Warm-Up',exact:true});
   await link.waitFor();
   assert.equal(await main.getByText(/40m|Watch Full Warm-Up/).count(),0);
   assert.equal(await main.getByRole('button',{name:'Complete Step-Up'}).getAttribute('data-item-key'),'p:2:1:STR02');
   await link.click();
   await main.getByRole('heading',{name:'Test — Libero Garage Warm-Up'}).waitFor();
   assert.deepEqual(await main.locator('.hub-athlete-phase h3').allTextContents(),phases.map((phase,i)=>'Phase '+(i+1)+' — '+phase));
   assert.equal(await main.getByText('About 8–12 minutes · 8 movements').count(),1);
   const rows=main.locator('.hub-parent-quick-row');
   assert.equal(await rows.count(),8);
   for(let i=0;i<names.length;i++){
    assert.equal(await rows.nth(i).locator('summary .hub-compact-movement-heading > span').textContent(),names[i]);
    assert.equal(await rows.nth(i).locator('summary strong').textContent(),doses[i]);
   }
   assert.equal(await main.locator('[data-athlete-inline-play]').count(),7);
   assert.equal(await main.getByText(/40m|Watch Full Warm-Up|Coach instructions/).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const shuffle=rows.last(),summary=shuffle.locator('summary');
   await summary.scrollIntoViewIfNeeded();
   const top=await page.evaluate(()=>scrollY);
   await summary.click();
   assert.equal(await shuffle.getByText('Video unavailable.').isVisible(),true);
   assert.equal(await shuffle.getByText(/Shuffle three steps right/).isVisible(),true);
   assert.equal(await shuffle.locator('[data-athlete-inline-play]').count(),0);
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-top)<5,'opening the row preserves scroll');
   await shuffle.getByRole('button',{name:'Complete 3-Step Defensive Shuffle'}).click();
   await main.getByText('1/8 complete',{exact:true}).waitFor();
   assert.equal(await shuffle.locator('details').getAttribute('open'),'');
   assert.equal(await shuffle.getByRole('button',{name:'Complete 3-Step Defensive Shuffle'}).getAttribute('aria-pressed'),'true');
   await summary.click();
   assert.equal(await shuffle.getByText('Video unavailable.').isVisible(),false);
   await main.getByRole('button',{name:'Full-screen demos'}).click();
   const dialog=page.getByRole('dialog',{name:'Exercise demos'});
   await dialog.waitFor();
   for(let i=0;i<names.length;i++){
    assert.equal(await dialog.getByRole('heading',{name:names[i]}).count(),1);
    if(i<7){
     await dialog.getByRole('button',{name:'Play demo'}).click();
     assert.ok((await dialog.locator('iframe').getAttribute('src')).includes('/embed/'+[...mapping.values()][i]));
     await dialog.getByRole('button',{name:'Next'}).click();
    }
   }
   assert.equal(await dialog.getByRole('button',{name:'Play demo'}).count(),0);
   assert.equal(await dialog.getByText(/No demo linked/).isVisible(),true);
   assert.equal(await dialog.getByText(/avoid crossing your feet/).isVisible(),true);
   await dialog.getByRole('button',{name:'Close'}).click();
   await main.getByRole('link',{name:'Return to Today’s Workout →'}).click();
   await link.waitFor();
   await main.getByRole('link',{name:'← Back to Week',exact:true}).click();
   await main.getByRole('link',{name:/Open Your Routines/}).click();
   await main.getByRole('link',{name:/My Warm-Up/}).waitFor();
   assert.equal(await main.getByRole('link',{name:/My Warm-Up/}).count(),1);
   await main.getByRole('link',{name:/My Warm-Up/}).click();
   await main.getByText('1/8 complete',{exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('Assigned warm-up mobile Chromium '+width+'px passed');
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
