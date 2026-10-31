const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(process.cwd(),req.url==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{for(const [engine,width] of [[chromium,1440],[chromium,390],...(process.env.RUN_WEBKIT?[[webkit,390]]:[])]){
  const browser=await engine.launch({headless:true});try{
   const page=await browser.newPage({viewport:{width,height:844}});let saves=[],fail=true;
   await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};localStorage.setItem('duAirlinesHubSessionV3',JSON.stringify({mode:'account',audience:'parent',role:'athlete'}));});
   await page.route('**/*',async route=>{if(route.request().url().startsWith(base))return route.continue();if(route.request().url().includes('/functions/v1/parent-hub-data')){
    const body=route.request().postDataJSON();if(body.action==='profile')return route.fulfill({json:{parent:{firstName:'Parent',lastName:'Test'},athlete:{fullName:'Athlete Test'},onboardingComplete:false,onboarding:{hubFrequency:'1 day'},accessState:'PENDING_ACTIVATION'}});
    saves.push(body);if(body.action==='save-onboarding'&&fail)return route.fulfill({status:500,json:{error:'Save failed. Try again.'}});
    return route.fulfill({json:{onboardingComplete:body.action==='save-onboarding',accessState:'PENDING_ACTIVATION'}});
   }return route.abort();});
   await page.goto(base+'/#/hub/athlete');await page.getByRole('heading',{name:'Athlete Setup',exact:true}).waitFor();
   if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'parent-setup-'+engine.name()+'-'+width+'.png'),fullPage:true});assert.equal(await page.locator('fieldset').count(),5);assert.equal(await page.locator('input[name=parent_first_name]').count(),0);
   assert.equal(await page.getByLabel('1 day',{exact:true}).isChecked(),true);
   await page.getByLabel('Speed',{exact:true}).check();await page.getByLabel('Strength',{exact:true}).check();await page.getByLabel('Jumping / Explosiveness',{exact:true}).click();assert.equal(await page.locator('[name=development_priorities]:checked').count(),2);
   await page.getByLabel('Home',{exact:true}).check();await page.getByLabel('Bodyweight only',{exact:true}).check();await page.getByLabel('Weights',{exact:true}).check();assert.equal(await page.getByLabel('Bodyweight only',{exact:true}).isChecked(),false);
   await page.getByLabel('Yes — I’ll provide details',{exact:true}).check();await page.getByLabel('Safety details',{exact:true}).fill('Private concern');await page.waitForFunction(()=>document.querySelector('[data-draft-status]')?.textContent.includes('Draft saved'));assert.ok(saves.some(x=>x.action==='save-onboarding-draft'));
   await page.getByRole('button',{name:'Save & Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'Save failed'}).waitFor();assert.equal(await page.getByLabel('Safety details',{exact:true}).inputValue(),'Private concern');
   assert.equal(await page.getByRole('heading',{name:'Athlete Setup',exact:true}).count(),1);
   fail=false;await page.getByLabel('Already discussed with Coach Du',{exact:true}).check();await page.getByRole('button',{name:'Save & Continue',exact:true}).click();await page.getByRole('heading',{name:'You’re all set!',exact:true}).waitFor();
   const final=saves.filter(x=>x.action==='save-onboarding').at(-1);assert.equal(final.profile.form_version,2);assert.equal(final.profile.hub_frequency,'1 day');assert.equal(final.profile.safety_details,undefined);assert.equal(final.profile.access_status,undefined);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log(`${engine.name()} ${width}px compact setup: five questions, draft preload, selection limits, safe payload, failed-save recovery, pending success passed`);
  }finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
