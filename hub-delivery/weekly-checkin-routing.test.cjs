const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');const from=html.indexOf('  async function enterAccount('),to=html.indexOf('  function sessionSummaryCard(',from),code=html.slice(from,to);
test('eligible route changes schedule one check-in verification without a second foreground refresh',()=>{
 const events={},timers=[],renders=[];let eligible=true;
 const ctx={window:{addEventListener:(name,fn)=>events[name]=fn},setTimeout:(fn,delay)=>timers.push({fn,delay}),render:()=>renders.push('render'),refreshVisibleProgramme:()=>renders.push('refresh'),CHECKIN_UI:{eligible:()=>eligible}};
 vm.createContext(ctx);const start=html.indexOf("  window.addEventListener('hashchange',()=>{setTimeout(render,50)");
 vm.runInContext(html.slice(start,html.indexOf("  window.addEventListener('popstate'",start)),ctx);
 events.hashchange();for(const timer of timers.splice(0))timer.fn();assert.deepEqual(renders,['render']);
 eligible=false;renders.length=0;events.hashchange();for(const timer of timers.splice(0))timer.fn();assert.deepEqual(renders,['render','refresh']);
});
test('eligible account login goes to the entry step before programme bootstrap and retains authenticated session',async()=>{let loggedOut=false,loads=0,renders=0,session=null;const ctx={accountProfile:async()=>({onboardingComplete:true}),accountNeedsOnboarding:()=>false,setSession:v=>{session=v;if(v===null)loggedOut=true;},CHECKIN_UI:{eligible:()=>true},loadAccountHubData:async()=>{loads++;throw Object.assign(Error('Check-in due'),{code:'CHECKIN_REQUIRED'})},render:async()=>{renders++},location:{hash:'#/hub/login/private-athlete'},renderAccountAccess:()=>{},renderAccountStatus:()=>{}};vm.createContext(ctx);vm.runInContext(code+';globalThis.enter=enterAccount',ctx);await ctx.enter('private-athlete');assert.equal(loads,0);assert.equal(renders,1);assert.equal(loggedOut,false);assert.equal(session.audience,'private-athlete');assert.equal(ctx.location.hash,'#/hub/athlete');});

test('exercise completion requires a parent declaration before opening an early review',async()=>{
 const start=html.indexOf('    const completionButton=event.target.closest('),end=html.indexOf('    const schoolGroupButton=',start);
 const completionCode=html.slice(start,end);
 for(const audience of ['parent','private-athlete']){
  const calls=[],button={dataset:{sessionKey:'day-1',itemKey:'bridge',completed:'false'},textContent:'Complete'},workout={id:'day-1'};
  const ctx={event:{target:{closest:()=>button}},location:{hash:'#/hub/session/day-1'},saveWorkoutCompletion:async()=>({saved:true}),programme:()=>({sessions:[workout]}),normalizeWorkoutSession:()=>({}),visibleNormalizedSections:()=>[],flattenedWorkoutItems:()=>[{key:'bridge'}],EXERCISES:{},GUIDED_CURSOR:{},renderSession:()=>{},CHECKIN_UI:{enabled:true},DuHubDelivery:{overview:()=>({training:[workout]})},isWorkoutComplete:()=>true,authEdgePost:async(_,body)=>calls.push(body.action),HUB_CONFIG:{accountFunctions:{[audience]:'endpoint'}},session:()=>({audience}),render:()=>{},console,setTimeout};
  vm.createContext(ctx);vm.runInContext('(function(){'+completionCode+'})()',ctx);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,audience==='parent'?[]:['open-end-checkin']);
 }
});
