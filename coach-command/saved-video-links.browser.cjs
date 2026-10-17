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
  await page.addScriptTag({path:'coach-command/coach-command.js'});
  await page.evaluate(data=>window.DuCoachCommand.mount(document.getElementById('test'),data),data);
  for(const [title,expected] of [['Tissue Strength',4],['Reactive Strength',4]]){
   const day=data.programme.sessions.findIndex(s=>s.itemSections?.some(b=>b.title===title));
   // Day buttons are available on the team overview.
   if(await page.locator('[data-action="back"]').count())await page.locator('[data-action="back"]').click();
   await page.locator('[data-day="'+day+'"]').click();
   const section=page.locator('.section').filter({has:page.getByRole('heading',{name:title,exact:true})});
   const rows=section.locator('.exercise');assert.equal(await rows.count(),3);checks++;
   for(let i=0;i<3;i++){
    assert.equal(await rows.nth(i).locator('[data-video]').count(),expected);checks++;
    for(const button of await rows.nth(i).locator('[data-video]').all()){
     const target=await button.getAttribute('data-video');
     await button.click();assert.equal(await page.locator('.video iframe').getAttribute('src'),target);checks++;
     await page.locator('[data-action="close-video"]').click();
    }
   }
   assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1));checks++;
  }
  await page.locator('[data-action="videos"]').click();assert.equal(await page.locator('.demo-links').count(),0);checks++;
  await page.locator('[data-action="videos"]').click();assert.ok(await page.locator('.demo-links').count()>0);checks++;
  assert.deepEqual(errors,[]);checks++;
  if(process.env.VIDEO_QA_SCREENSHOTS)await page.screenshot({path:process.env.VIDEO_QA_SCREENSHOTS+'/saved-videos-'+width+'.png',fullPage:true});
  await browser.close();browser=null;
 }console.log(checks+' browser checks passed: live-source school rows, exact video clicks, mobile/desktop, toggle and overflow.');
 }finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
