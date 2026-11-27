'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';const file=path.join(process.cwd(),name);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=process.env.HOMEPAGE_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process']}: {})});
 let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
 try{
 const context=await browser.newContext({reducedMotion:'reduce',hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [375,390,430,768,1440]){
 await page.setViewportSize({width,height:900});errors.length=0;
 await page.goto(base,{waitUntil:'load'});
 await page.waitForFunction(()=>!document.body.classList.contains('route-transitioning')&&getComputedStyle(document.getElementById('home-view')).opacity==='1');
 ok(await page.locator('#home-view').evaluate(e=>getComputedStyle(e).opacity==='1'),`${width}: homepage fully visible after route transition`);
 ok(await page.locator('#home-view').isVisible(),`${width}: homepage visible`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: no horizontal overflow`);
 ok(await page.locator('#home-view > #performance-hub').count()===1,`${width}: Hub section inside homepage`);
 ok(await page.locator('#home-view > #sports').count()===1,`${width}: pathways inside homepage`);
 ok(await page.locator('#home-view footer').count()===1,`${width}: footer inside homepage`);
 const broken=await page.locator('#home-view a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('#/')&&h.length>1&&!document.getElementById(h.slice(1))));
 ok(!broken.length,`${width}: all homepage section links resolve: ${broken}`);
 const hero=await page.locator('.premium-hero').boundingBox(),title=await page.locator('.premium-hero h1').boundingBox();
 ok(title.y+title.height<=hero.y+hero.height,`${width}: hero heading fits`);
 await page.locator('#performance-hub details > summary').click();
 const roleRows=await page.locator('[data-premium-role]').evaluateAll(items=>items.map(e=>Math.round(e.getBoundingClientRect().top)));
 ok(new Set(roleRows).size===(width<=480?2:1),`${width}: Hub roles use approved responsive grid`);
 ok(await page.locator('[data-premium-role]').count()===4,`${width}: four public role tabs`);
 ok(await page.locator('[data-premium-role]').evaluateAll(items=>items.every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.left>=0&&b.right<=innerWidth+1})),`${width}: role tabs fit viewport`);
 ok(await page.getByRole('tab',{name:'School Athlete',exact:true}).count()===1,`${width}: school athlete tab is distinct from private athlete`);
 ok(await page.getByRole('link',{name:'Access School Athlete Hub',exact:true}).isVisible(),`${width}: school athlete link is clear`);
 ok(await page.locator('.premium-story-avatar').count()===3,`${width}: existing athlete photos reused`);
 ok(await page.locator('.premium-story-avatar').evaluateAll(images=>images.every(e=>(e.getAttribute('src')||'').startsWith('data:image/'))),`${width}: every athlete photo has its original source`);
 const more=page.locator('.premium-more');await more.locator('summary').click();ok(await more.getAttribute('open')!==null,`${width}: credentials expanded`);ok(await page.locator('.premium-more-grid > div').count()===4,`${width}: four credential groups`);ok((await page.locator('.premium-more-grid > div > strong').allTextContents()).join('|')==='International championships|National recognition|NCAA & conference honours|University honours & records',`${width}: approved credential headings`);ok(await page.locator('.premium-more-grid li').count()===11,`${width}: eleven approved career achievements without duplicate silver medal`);
 const services=page.locator('#sports details.commercial-service');
 const pillars=['Schools & Clubs','Private Athlete Development','Technical Clinics & Education','Speaking & Leadership','Corporate Partnerships'];
 const subjects=['School & Club Partnership Enquiry','Private Athlete Development Enquiry','Technical Clinic & Education Enquiry','Speaking and Leadership Enquiry','Corporate Partnership Enquiry'];
 ok(await services.count()===5,`${width}: five commercial services`);
 for(let i=0;i<pillars.length;i++){
 const service=services.nth(i),summary=service.locator(':scope > summary');
 ok((await summary.innerText()).includes(pillars[i]),`${width}: service ${pillars[i]}`);
 await summary.click();ok(await service.evaluate(e=>e.open),`${width}: service expands`);
 if(i!==4){
 const photo=service.locator('figure.commercial-photo img');
 ok(await photo.count()===1,`${width}: exactly one service photograph`);
 if(i===0||i===3){const stem=i===0?'technical-clinics-education':'speaking-leadership';ok(await photo.getAttribute('src')===`/assets/services/${stem}-640.webp`,`${width}: approved service image source`);ok((await photo.getAttribute('srcset')).includes(`/assets/services/${stem}-1024.webp 1024w`),`${width}: high-resolution approved service source`);ok((await photo.getAttribute('alt')).includes(i===0?'red blazers':'large audience'),`${width}: approved image description`);}
 await photo.scrollIntoViewIfNeeded();
 await photo.evaluate(async img=>{await img.decode();});
 ok(await photo.evaluate(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0&&img.alt.trim().length>0),`${width}: service photograph decodes and has alt text`);
 ok(await photo.evaluate(img=>{const b=img.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=0&&b.right<=innerWidth+1&&getComputedStyle(img).objectFit===(img.closest('.clinic-photo')?'contain':'cover');}),`${width}: service photograph fits viewport`);
 const panelFit=await service.evaluate(e=>{const f=e.querySelector('.commercial-photo'),c=e.querySelector('.commercial-copy'),b=e.querySelector('.commercial-body'),a=c.querySelector('.btn');const F=f.getBoundingClientRect(),C=c.getBoundingClientRect(),B=b.getBoundingClientRect(),A=a.getBoundingClientRect();return {ratio:F.width/F.height,sideBySide:F.right<=C.left+1&&Math.abs(F.top-C.top)<5,stacked:F.bottom<=C.top+1,contained:F.left>=B.left-1&&C.right<=B.right+1&&A.left>=C.left-1&&A.right<=C.right+1&&e.scrollWidth<=e.clientWidth+2&&c.scrollWidth<=c.clientWidth+2,viewport:document.documentElement.scrollWidth<=innerWidth+1};});
 ok(Math.abs(panelFit.ratio-(i===2?4/3:16/9))<.04,`${width}: photograph keeps approved editorial aspect ratio`);
 ok(await photo.evaluate(img=>img.closest('.clinic-photo')?getComputedStyle(img).objectPosition==='50% 0%':true),`${width}: clinic photograph retains top alignment`);
 ok(width>=900?panelFit.sideBySide:panelFit.stacked,`${width}: correct responsive image-and-copy layout`);
 ok(panelFit.contained&&panelFit.viewport,`${width}: panel copy and CTA fit without clipping or horizontal overflow`);

 }else{ok(await service.locator('figure.commercial-photo').count()===0,`${width}: no corporate group photograph`);const rank=service.locator('#rank-collaboration');ok((await rank.locator('.eyebrow').textContent()).trim()==='Current partnership',`${width}: current partnership label`);ok(await service.locator('.commercial-copy > :first-child').getAttribute('id')==='rank-collaboration',`${width}: Rank books lead the corporate service`);ok(await service.evaluate(e=>{const c=e.querySelector('.commercial-copy'),b=e.querySelector('.commercial-body'),a=c.querySelector('.btn');const C=c.getBoundingClientRect(),B=b.getBoundingClientRect(),A=a.getBoundingClientRect();return C.left>=B.left-1&&C.right<=B.right+1&&A.left>=C.left-1&&A.right<=C.right+1&&e.scrollWidth<=e.clientWidth+2&&c.scrollWidth<=c.clientWidth+2&&document.documentElement.scrollWidth<=innerWidth+1}),`${width}: corporate content and CTA fit viewport`);ok(await rank.isVisible(),`${width}: Rank collaboration visible`);const covers=rank.locator('figure img');ok(await covers.count()===2,`${width}: two book covers`);for(const img of await covers.all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());ok(await img.evaluate(e=>{const b=e.getBoundingClientRect();return e.naturalWidth>0&&e.alt.length>0&&b.left>=0&&b.right<=innerWidth+1}),`${width}: Rank cover loads and fits`);}await rank.locator('details > summary').click();const artwork=rank.locator('details img');await artwork.scrollIntoViewIfNeeded();await artwork.evaluate(e=>e.decode());ok(await artwork.evaluate(e=>{const b=e.getBoundingClientRect();return e.naturalWidth>0&&e.alt.length>0&&b.left>=0&&b.right<=innerWidth+1}),`${width}: Rank campaign artwork loads and fits`);await rank.locator('details > summary').click();ok(!await artwork.isVisible(),`${width}: Rank artwork collapses`);}
 if(process.env.HOMEPAGE_SCREENSHOT_DIR){await page.evaluate(()=>document.fonts.ready);await service.screenshot({path:path.join(process.env.HOMEPAGE_SCREENSHOT_DIR,`service-${i+1}-${width}.png`)});}
 const link=service.locator('a[href^="/enquire/#"]');
 ok(await link.isVisible(),`${width}: enquiry visible`);
 ok(await link.getAttribute('href')==='/enquire/#'+['school','athlete','clinic','speaking','corporate'][i],`${width}: exact guided enquiry destination`);
 if(i===0)ok(await service.locator('a[href="/school-services/"]').isVisible(),`${width}: school services link visible`);
 if(i===3)ok(await service.locator('a[href="/school-booking/"]').isVisible(),`${width}: school engagement booking link visible`);
 await summary.click();ok(!await service.evaluate(e=>e.open),`${width}: service collapses`);
 }
 ok(await page.locator('#home-view .premium-path-links').count()===0,`${width}: obsolete promotion removed`);
 for(const sport of ['soccer','track']){
 await page.goto(base+'/#/'+sport);await page.locator('#'+sport+'-view').waitFor({state:'visible'});
 ok(!await page.locator('#home-view').isVisible(),`${width}: legacy ${sport} direct route works`);
 }
 await page.goto(base);
 for(const [role,route] of Object.entries({athlete:'athlete',coach:'staff',parent:'parent',private:'private-athlete'})){
 await page.locator('#performance-hub details > summary').click();
 await page.locator(`[data-premium-role="${role}"]`).click();
 ok(await page.locator('#premium-role-link').getAttribute('href')===`#/hub/login/${route}`,`${width}: ${role} role link`);
 await page.locator('#premium-role-link').click();
 await page.waitForFunction(()=>!document.getElementById('home-view').checkVisibility());
 ok(await page.locator('#hub-root').isVisible(),`${width}: ${role} login rendered`);
 ok(await page.locator('#hub-root input').count()>0,`${width}: ${role} login inputs present`);
 ok(!await page.locator('.premium-pathways').isVisible(),`${width}: homepage pathways hidden on Hub`);
 await page.goto(base);
 }
 await page.goto(base+'/#/hub/login');
 const roles=page.locator('.hub-role-card');
 await roles.first().waitFor({state:'visible'});
 ok((await roles.locator('strong').allTextContents()).join('|')==='School / Team Athlete|Staff / Coach|Parent Access|Private Athlete',`${width}: Hub chooser shows the four public access paths`);
 await page.goto(base+'/#/hub/login/professional');
 await page.locator('#hubAccountLoginForm input[type="email"]').waitFor({state:'visible'});
 ok(await page.getByRole('heading',{name:'Professional Performance',exact:true}).isVisible(),`${width}: saved professional sign-in link still works`);
 await page.goto(base);
 await page.locator('#performance-hub details > summary').click();
 await page.locator('[data-premium-role="athlete"]').focus();await page.keyboard.press('End');ok(await page.locator('[data-premium-role="private"]').getAttribute('aria-selected')==='true',`${width}: keyboard End selects private athlete`);
 await page.keyboard.press('Home');ok(await page.locator('[data-premium-role="athlete"]').getAttribute('aria-selected')==='true',`${width}: keyboard Home selects athlete`);
 const story=page.locator('.commercial-editorial details').filter({has:page.locator('a.du-story-entry')});
 await story.locator('summary').click();ok(await story.locator('a[href="/my-journey/"]').isVisible(),`${width}: founder biography accessible`);
 await page.locator('#stories > summary').click();
 if(width<=899){
 const track=page.locator('#premium-story-grid');
 await page.evaluate(()=>document.fonts.ready);
 // Set up the vertical viewport before measuring the native horizontal gesture.
 await track.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
 await track.hover({position:{x:40,y:40}});
 const box=await track.boundingBox();const y=Math.max(box.y+20,Math.min(800,box.y+box.height/2));
 const startX=box.x+box.width*.8;
 const hit=await page.evaluate(({x,y})=>{const node=document.elementFromPoint(x,y);return {inside:!!node?.closest('#premium-story-grid'),tag:node?.tagName||'none',id:node?.id||'',className:typeof node?.className==='string'?node.className.slice(0,100):'',x,y,viewport:[innerWidth,innerHeight]};},{x:startX,y});
 ok(hit.inside,`${width}: gesture starts inside story carousel; hit=${JSON.stringify(hit)}`);
 // Playwright wheel input exercises native horizontal scrolling across Chromium versions.
 // Physical touch uses the same CSS overflow/snap surface; it was also checked on the live site.
 await page.mouse.move(startX,y);
 // Native scrolling may begin after compositor hit-testing catches up with scrollIntoView.
 // Send bounded real wheel gestures; never mutate scrollLeft to manufacture a pass.
 for(let attempt=0;attempt<3;attempt++){
 await page.mouse.wheel(box.width*.8,0);
 try{await page.waitForFunction(()=>document.getElementById('premium-story-grid').scrollLeft>50,null,{timeout:4000});break;}catch(error){if(attempt===2)throw error;}
 }
 ok(await track.evaluate(e=>e.scrollLeft)>50,`${width}: horizontal gesture moves athlete stories`);
 }
 for(let i=1;i<=3;i++){
 if(width<=899)await page.locator(`#premium-story-dots button:nth-child(${i})`).click();
 await page.locator('.premium-story-avatar').nth(i-1).scrollIntoViewIfNeeded();
 await page.waitForFunction(n=>document.querySelectorAll('.premium-story-avatar')[n].naturalWidth>0,i-1);
 ok(await page.locator('.premium-story-avatar').nth(i-1).evaluate(e=>e.complete&&e.naturalWidth>0),`${width}: athlete ${i} photo loads`);
 await page.locator(`#premium-story-grid [data-story="story${i}"]`).click();ok(await page.locator(`#story${i}`).isVisible(),`${width}: story ${i} opens`);await page.keyboard.press('Escape');ok(!await page.locator(`#story${i}`).isVisible(),`${width}: story ${i} closes`);
 }
 const finalLink=page.locator('#partnerships a[href^="mailto:"]');
 ok(await finalLink.isVisible(),`${width}: general enquiry visible`);
 const finalMail=new URL(await finalLink.getAttribute('href'));
 ok(finalMail.pathname==='coachdu@duairlineseliteacademy.com'&&finalMail.searchParams.get('subject')==='General Performance Enquiry',`${width}: general enquiry destination`);
 ok(await page.locator('#home-view #partnershipForm').count()===0,`${width}: obsolete enquiry presentation removed`);
 for(const [route,view] of Object.entries({'club-registration':'club-registration-view','registration-complete':'registration-complete-view','track/register':'track-view','track/evaluation':'track-view'})){
 await page.goto(base+'/#/'+route);await page.locator('#'+view).waitFor({state:'visible'});
 ok(await page.locator('#'+view).isVisible(),`${width}: existing ${route} route renders`);
 ok(!await page.locator('#home-view').isVisible(),`${width}: homepage hidden on ${route}`);
 if(route==='track/register')await page.locator('#track-clinic-form').waitFor({state:'visible'});
 if(route==='track/register')ok(await page.locator('#track-clinic-form').isVisible(),`${width}: track registration form available`);
 if(route==='track/evaluation')await page.locator('#track-form').waitFor({state:'visible'});
 if(route==='track/evaluation')ok(await page.locator('#track-form').isVisible(),`${width}: track evaluation form available`);
 }
 for(const route of ['professional-performance','professional-join','professional-hub']){
 await page.goto(base+'/#/'+route);await page.locator('#home-view').waitFor({state:'visible'});
 ok(await page.locator('#professional-view').count()===0,`${width}: retired ${route} page stays removed`);
 ok(await page.locator('#home-view').isVisible(),`${width}: retired ${route} returns home`);
 }
 await page.goto(base);
 ok(errors.length===0,`${width}: no uncaught JavaScript errors: ${errors.join('; ')}`);
 if(process.env.HOMEPAGE_SCREENSHOT_DIR){await page.goto(base);await page.waitForFunction(()=>!document.body.classList.contains('route-transitioning')&&getComputedStyle(document.getElementById('home-view')).opacity==='1');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.HOMEPAGE_SCREENSHOT_DIR,`homepage-${width}.png`),fullPage:true});}
 console.log(`${width}px viewport checks passed`);
 }
 console.log(`Homepage browser QA passed: ${checks} assertions across five viewport widths.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
