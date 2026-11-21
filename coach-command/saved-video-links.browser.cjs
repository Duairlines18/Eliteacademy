// Uses a protected bootstrap captured outside git; never stores access tokens.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const data=JSON.parse(fs.readFileSync(process.env.VIDEO_QA_BOOTSTRAP,'utf8'));
 let browser;
 let checks=0;
 try{for(const width of [390,1280]){
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox"]')});
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{background:#090909;margin:12px}</style><div id="test"></div>');
  await page.addScriptTag({path:'hub-delivery/delivery.js'});
  await page.addScriptTag({path:'coach-command/coach-command.js'});
  await page.evaluate(data=>window.DuCoachCommand.mount(document.getElementById('test'),data),data);
  for(const [title,expected] of [['Main Strength',4],['Tissue Strength',4],['Reactive Strength',4]]){
   const day=data.programme.sessions.findIndex(s=>s.itemSections?.some(b=>b.title===title));
   // Day buttons are available on the team overview.
   if(await page.locator('[data-action="back"]').count())await page.locator('[data-action="back"]').click();
   await page.locator('[data-day="'+day+'"]').click();
   const section=page.locator('.workout-section').filter({has:page.getByRole('heading',{name:title,exact:true})});
   const cards=section.locator('.learn-card');assert.equal(await cards.count(),3);checks++;
   for(const card of await cards.all()){
    await card.locator('summary').click();
    const options=card.locator('[data-demo-url]');assert.equal(await options.count(),expected);checks++;
    if(title==='Main Strength'){
     assert.equal(await card.getByRole('button',{name:'Single-Leg Glute Bridge',exact:true}).count(),1);checks++;
     assert.equal(await card.getByRole('button',{name:'Single-Leg Bridge Hold',exact:true}).count(),0);checks++;
    }
    for(const option of await options.all()){
     await option.click();
     const play=card.locator('[data-play-demo]');
     assert.equal(await play.getAttribute('data-play-demo'),await option.getAttribute('data-demo-url'));checks++;
     const chosen=new URL(await option.getAttribute('data-demo-url'));
     const id=chosen.searchParams.get('v')||chosen.pathname.split('/').at(-1);
     await play.click();
     const frame=new URL(await card.locator('iframe').getAttribute('src'));
     assert.equal(frame.pathname,'/embed/'+id);checks++;
    }
    await card.locator('summary').click();
    await card.locator('iframe').waitFor({state:'detached'});
   }
   assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1));checks++;
  }
  assert.equal(await page.locator('.learn-card[open], .ducc iframe').count(),0);checks++;
  assert.deepEqual(errors,[]);checks++;
  if(process.env.VIDEO_QA_SCREENSHOTS)await page.screenshot({path:process.env.VIDEO_QA_SCREENSHOTS+'/saved-videos-'+width+'.png',fullPage:true});
  await browser.close();browser=null;
 }console.log(checks+' browser checks passed: live-source school rows, exact video clicks, mobile/desktop, workout disclosures and overflow.');
 }finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
