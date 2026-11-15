const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/du-checkin-qa/node_modules/jsdom/lib/api.js');
const code=fs.readFileSync('hub-delivery/weekly-checkins.js','utf8');
const clear=()=>({enabled:true,due:[],held:false,requirements:[]});
function fixture(audience='private-athlete'){
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.invalid/#/hub/athlete',runScripts:'outside-only'}),w=dom.window;
 w.eval(code);let session={mode:'account',audience},reply=async()=>({checkins:clear()}),calls=0,cleared=0,epoch=0;
 const root=w.document.querySelector('main'),ui=w.DuWeeklyCheckins.create({root,getSession:()=>session,getIdentity:()=>epoch+JSON.stringify(session),post:body=>{assert.equal(body.action,'checkin-state');calls++;return reply();},clearTraining:()=>cleared++,onReady:()=>{},onLogout:()=>{}});
 return {dom,w,root,ui,setReply:fn=>reply=fn,setSession:s=>session=s,resetEpoch:()=>epoch++,get calls(){return calls},get cleared(){return cleared}};
}
for(const audience of ['parent','private-athlete'])test(`${audience}: verified navigation retains the existing page while checking fresh server state`,async()=>{
 const f=fixture(audience);try{
  assert.equal(await f.ui.guard('/athlete'),false);
  f.root.innerHTML='<article id="current">Current programme</article>';const current=f.root.firstChild;
  f.w.location.hash='#/hub/session/day';let resolve;f.setReply(()=>new Promise(r=>resolve=r));
  const pending=f.ui.guard('/session/day');assert.equal(f.root.firstChild,current);assert.doesNotMatch(f.root.textContent,/Checking your weekly/);assert.equal(f.calls,2);
  resolve({checkins:clear()});assert.equal(await pending,false);assert.equal(f.root.firstChild,current);
 }finally{f.dom.window.close()}
});
test('a newly due check-in, safety hold or verification error still replaces training immediately after verification',async()=>{
 for(const kind of ['due','held','error']){
  const f=fixture();try{
   await f.ui.guard('/athlete');f.root.innerHTML='<article id="training">Training</article>';
   f.setReply(async()=>{if(kind==='error')throw Error('offline');return {checkins:{...clear(),held:kind==='held',due:kind==='due'?[{id:'new',kind:'start',week_number:1,period_start:'2026-11-16',revision:0}]:[]}}});
   assert.equal(await f.ui.guard('/athlete'),true);assert.equal(f.cleared,1);assert.equal(f.root.querySelector('#training'),null);
   assert.match(f.root.textContent,kind==='due'?/Start-of-week check-in/:kind==='held'?/Coach Du needs to review this/:/Unable to verify/);
  }finally{f.dom.window.close()}
 }
});
test('switching identity never retains another account page while verifying',async()=>{
 const f=fixture();try{
  await f.ui.guard('/athlete');f.root.innerHTML='<article id="prior">Prior account</article>';f.setSession({mode:'account',audience:'parent'});
  let resolve;f.setReply(()=>new Promise(r=>resolve=r));const pending=f.ui.guard('/athlete');assert.equal(f.root.querySelector('#prior'),null);
  resolve({checkins:clear()});await pending;
 }finally{f.dom.window.close()}
});
test('a failed request from a route already left cannot replace the newer page',async()=>{
 const f=fixture();try{
  await f.ui.guard('/athlete');f.w.location.hash='#/hub/session/day';let reject;f.setReply(()=>new Promise((_,r)=>reject=r));
  const pending=f.ui.guard('/session/day');f.w.location.hash='#/hub/athlete';f.root.innerHTML='<article id="new">Dashboard</article>';
  reject(Error('late failure'));await pending;assert.ok(f.root.querySelector('#new'));assert.equal(f.cleared,0);
 }finally{f.dom.window.close()}
});

test('a new account epoch invalidates quiet display state even for the same audience',async()=>{
 const f=fixture();try{
  await f.ui.guard('/athlete');f.root.innerHTML='<article id="old">Old epoch</article>';f.resetEpoch();
  let resolve;f.setReply(()=>new Promise(r=>resolve=r));const pending=f.ui.guard('/athlete');assert.equal(f.root.querySelector('#old'),null);
  resolve({checkins:clear()});await pending;
 }finally{f.dom.window.close()}
});
