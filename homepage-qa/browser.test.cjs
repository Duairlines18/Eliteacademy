'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';const file=path.join(process.cwd(),name);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=process.env.HOMEPAGE_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']}: {})});
 let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
 try{
 const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [375,390,430,768,1440]){
 await page.setViewportSize({width,height:900});errors.length=0;
 await page.goto(base,{waitUntil:'load'});
 ok(await page.locator('#home-view').isVisible(),`${width}: homepage visible`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: no horizontal overflow`);
 ok(await page.locator('#home-view > #performance-hub').count()===1,`${width}: Hub section inside homepage`);
 ok(await page.locator('#home-view > #sports').count()===1,`${width}: pathways inside homepage`);
 ok(await page.locator('#home-view footer').count()===1,`${width}: footer inside homepage`);
 const broken=await page.locator('#home-view a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('#/')&&h.length>1&&!document.getElementById(h.slice(1))));
 ok(!broken.length,`${width}: all homepage section links resolve: ${broken}`);
 const hero=await page.locator('.premium-hero').boundingBox(),title=await page.locator('.premium-hero h1').boundingBox();
 ok(title.y+title.height<=hero.y+hero.height,`${width}: hero heading fits`);
 const more=page.locator('.premium-more');await more.locator('summary').click();ok(await more.getAttribute('open')!==null,`${width}: all seven credentials available`);ok(await page.locator('.premium-more-grid span').count()===4,`${width}: four additional credentials`);
 await page.locator('.premium-path-details summary').click();
 for(const sport of ['soccer','track']){
 await page.locator(`.premium-path-links [data-route="${sport}"]`).click();
 await page.locator(`#${sport}-view`).waitFor({state:'visible'});
 ok(await page.locator(`#${sport}-view`).isVisible(),`${width}: ${sport} route opens`);
 ok(!await page.locator('#home-view').isVisible(),`${width}: homepage hidden on ${sport}`);
 ok(!await page.locator('.premium-hub').isVisible(),`${width}: homepage Hub hidden on ${sport}`);
 await page.goto(base);
 await page.locator('.premium-path-details summary').click();
 }
 for(const [role,route] of Object.entries({athlete:'athlete',coach:'staff',parent:'parent',private:'private-athlete'})){
 await page.locator(`[data-premium-role="${role}"]`).click();
 ok(await page.locator('#premium-role-link').getAttribute('href')===`#/hub/login/${route}`,`${width}: ${role} role link`);
 await page.locator('#premium-role-link').click();
 await page.waitForFunction(()=>!document.getElementById('home-view').checkVisibility());
 ok(await page.locator('#hub-root').isVisible(),`${width}: ${role} login rendered`);
 ok(await page.locator('#hub-root input').count()>0,`${width}: ${role} login inputs present`);
 ok(!await page.locator('.premium-pathways').isVisible(),`${width}: homepage pathways hidden on Hub`);
 await page.goto(base);
 }
 await page.locator('[data-premium-role="athlete"]').focus();await page.keyboard.press('End');ok(await page.locator('[data-premium-role="private"]').getAttribute('aria-selected')==='true',`${width}: keyboard End selects private athlete`);
 await page.keyboard.press('Home');ok(await page.locator('[data-premium-role="athlete"]').getAttribute('aria-selected')==='true',`${width}: keyboard Home selects athlete`);
 for(let i=1;i<=3;i++){
 if(width<=899)await page.locator(`#premium-story-dots button:nth-child(${i})`).click();
 await page.locator(`#premium-story-grid [data-story="story${i}"]`).click();ok(await page.locator(`#story${i}`).isVisible(),`${width}: story ${i} opens`);await page.keyboard.press('Escape');ok(!await page.locator(`#story${i}`).isVisible(),`${width}: story ${i} closes`);
 }
 await page.locator('#openPartnershipForm').click();ok(await page.locator('#partnershipForm').isVisible(),`${width}: original inquiry form opens`);
 ok(await page.locator('#partnershipForm').getAttribute('action')==='https://formsubmit.co/coachdu@duairlineseliteacademy.com',`${width}: original inquiry destination`);
 for(const [route,view] of Object.entries({'club-registration':'club-registration-view','registration-complete':'registration-complete-view','track/register':'track-view','track/evaluation':'track-view','professional-performance':'professional-view'})){
 await page.goto(base+'/#/'+route);await page.locator('#'+view).waitFor({state:'visible'});
 ok(await page.locator('#'+view).isVisible(),`${width}: existing ${route} route renders`);
 ok(!await page.locator('#home-view').isVisible(),`${width}: homepage hidden on ${route}`);
 if(route==='track/register')await page.locator('#track-clinic-form').waitFor({state:'visible'});
 if(route==='track/register')ok(await page.locator('#track-clinic-form').isVisible(),`${width}: track registration form available`);
 if(route==='track/evaluation')await page.locator('#track-form').waitFor({state:'visible'});
 if(route==='track/evaluation')ok(await page.locator('#track-form').isVisible(),`${width}: track evaluation form available`);
 }
 await page.goto(base);
 ok(errors.length===0,`${width}: no uncaught JavaScript errors: ${errors.join('; ')}`);
 if(process.env.HOMEPAGE_SCREENSHOT_DIR){await page.goto(base);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.HOMEPAGE_SCREENSHOT_DIR,`homepage-${width}.png`),fullPage:true});}
 console.log(`${width}px viewport checks passed`);
 }
 console.log(`Homepage browser QA passed: ${checks} assertions across five viewport widths.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
