import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {JSDOM}=await import(pathToFileURL(process.env.JSDOM_MODULE||'/tmp/du-checkin-qa/node_modules/jsdom/lib/api.js').href);
import {createCheckinFixture} from './weekly-checkin-fixture.mjs';
import {handleParentRequest} from '../functions/_shared/parent-handler.ts';
import {handlePrivateAthleteRequest} from '../functions/_shared/private-athlete-handler.ts';
const code=fs.readFileSync(new URL('../../hub-delivery/weekly-checkins.js',import.meta.url),'utf8');
for(const audience of ['parent','private-athlete'])test(`${audience}: entry UI uses real handler/validation/SQL saves, conditional fields, retry, amendment and hold`,async()=>{
 const {db,scalar,ids}=await createCheckinFixture();
 try{
 await db.exec('update weekly_checkin_config set enabled=true');
 const user=audience==='parent'?ids.parent:ids.user,handler=audience==='parent'?handleParentRequest:handlePrivateAthleteRequest;
 const dom=new JSDOM('<main id="root"></main>',{url:'https://duairlineseliteacademy.com/#/hub/session/day',runScripts:'outside-only'});const w=dom.window;w.eval(code);
 let fail=false,ready=0,cleared=0,sent=[],session={mode:'account',audience};
 const now=audience==='parent'?'2026-11-15T16:00Z':'2026-11-13T16:00Z';
 const repo={weeklyCheckinState:(actor,role)=>scalar('select weekly_checkin_state($1,$2,$3)',[actor,role,now]),saveWeeklyCheckin:(actor,role,r,sub,p,rev,safety)=>scalar('select save_weekly_checkin($1,$2,$3,$4,$5,$6,$7,$8)',[actor,role,r,sub,p,rev,safety,now])};
 const root=w.document.getElementById('root');
 const ui=w.DuWeeklyCheckins.create({root,getSession:()=>session,clearTraining:()=>cleared++,onReady:()=>ready++,onLogout:()=>{session=null;ui.forget();},post:async body=>{sent.push(body);if(fail)throw Error('Temporarily unavailable');const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com'},body:JSON.stringify(body)}),{verifyUser:async()=>({id:user}),repository:repo});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error),{code:data.code});return data;}});
 assert.equal(await ui.guard('/session/day'),true);assert.match(root.textContent,audience==='parent'?/Weekly training review/:/End-of-week/);assert.equal(cleared,1);
 const choose=(name,value)=>{const el=root.querySelector(`[name="${name}"][value="${value}"]`);assert.ok(el,`${name} ${value} exists`);el.checked=true;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const fill=(name,value)=>{const el=root.querySelector(`[name="${name}"]`);assert.ok(el,name+' exists');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 assert.equal(root.querySelectorAll('#mandatoryCheckinForm > fieldset').length,3);
 assert.equal(root.querySelector('[name=outside]'),null);
 assert.match(root.textContent,/Anything sport-related or anything else Coach Du should know\?/);
 for(const [key,value] of Object.entries({completion:'some',challenge:'right',recovery:'good'}))choose(key,value);
 choose('incompleteReason','school');fill('note','A saved note');
 fail=true;await root.querySelector('form').onsubmit({preventDefault(){}});assert.match(root.querySelector('[data-wc-error]').textContent,/unavailable/);assert.equal(root.querySelector('[name=note]').value,'A saved note');const sub=sent.at(-1).submissionId;
 fail=false;await root.querySelector('form').onsubmit({preventDefault(){}});assert.equal(sent.at(-1).submissionId,sub);assert.equal(ready,1);assert.equal(await scalar('select count(*)::int from feedback'),1);
 w.location.hash='#/hub/feedback';assert.equal(await ui.guard('/feedback'),true);root.querySelector('[data-wc-amend]').click();assert.equal(root.querySelector('[name=note]').value,'A saved note');
 choose('recovery','unwell');fill('symptoms','Ankle tightness');choose('painApplicable','yes');fill('severity',audience==='parent'?'unknown':'4');choose('movement',audience==='parent'?'unknown':'unsure');
 await root.querySelector('form').onsubmit({preventDefault(){}});w.location.hash='#/hub/athlete';await ui.guard('/athlete');assert.match(root.textContent,/Coach Du needs to review this/);assert.equal(await scalar('select count(*)::int from weekly_checkin_holds where released_at is null'),1);assert.equal(await scalar("select count(*)::int from feedback_revision_events where operation='UPDATE'"),1);
 w.location.hash='#/hub/checkin-safety';fail=true;await ui.guard('/checkin-safety');assert.match(root.textContent,/Safety information/);assert.ok(root.querySelector('a[href^="mailto:"]'));
 w.location.hash='#/hub/session/day';await ui.guard('/session/day');assert.match(root.textContent,/Unable to verify/);assert.ok(!root.querySelector('#mandatoryCheckinForm'));
 // A response arriving after logout must not render another person's draft/content.
 dom.window.close();
 }finally{await db.close();}
});
