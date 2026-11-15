const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');const from=html.indexOf('  async function enterAccount('),to=html.indexOf('  function sessionSummaryCard(',from),code=html.slice(from,to);
test('Back/Forward hashchange and popstate schedule a single verification for the final route',()=>{
 const events={},timers=new Map(),renders=[];let eligible=true,next=0;
 const ctx={window:{addEventListener:(name,fn)=>events[name]=fn},setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),render:()=>renders.push('render'),refreshVisibleProgramme:()=>renders.push('refresh'),CHECKIN_UI:{eligible:()=>eligible}};
 vm.createContext(ctx);const start=html.indexOf('  let HUB_RENDER_TIMER=');assert.ok(start>0);
 vm.runInContext(html.slice(start,html.indexOf('  initializePasswordRecovery()',start)),ctx);
 const flush=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())};
 events.popstate();events.hashchange();events.popstate();assert.equal(timers.size,1);flush();assert.deepEqual(renders,['render']);
 eligible=false;renders.length=0;events.hashchange();events.popstate();flush();flush();assert.deepEqual(renders,['render','refresh']);
});
test('eligible account login goes to the entry step before programme bootstrap and retains authenticated session',async()=>{let loggedOut=false,loads=0,renders=0,session=null;const ctx={accountProfile:async()=>({onboardingComplete:true}),accountNeedsOnboarding:()=>false,setSession:v=>{session=v;if(v===null)loggedOut=true;},CHECKIN_UI:{eligible:()=>true},loadAccountHubData:async()=>{loads++;throw Object.assign(Error('Check-in due'),{code:'CHECKIN_REQUIRED'})},render:async()=>{renders++},location:{hash:'#/hub/login/private-athlete'},renderAccountAccess:()=>{},renderAccountStatus:()=>{}};vm.createContext(ctx);vm.runInContext(code+';globalThis.enter=enterAccount',ctx);await ctx.enter('private-athlete');assert.equal(loads,0);assert.equal(renders,1);assert.equal(loggedOut,false);assert.equal(session.audience,'private-athlete');assert.equal(ctx.location.hash,'#/hub/athlete');});
