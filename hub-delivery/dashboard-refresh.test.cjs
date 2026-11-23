const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const presentation=extract('  function workoutPresentationOpen(', '  async function render(');
function context(){const c={CHECKIN_UI:{eligible:()=>false,enabled:false},setInterval:()=>{},session:()=>({mode:'account',audience:'private-athlete'}),sessionStamp:()=> 'A',HUB_STATE:{programme:{week:7}},HUB_CONFIG:{accountFunctions:{'private-athlete':'private'}},EXERCISES:[],DuHubDelivery:{safeVideo:()=>''},loadFullExerciseLibrary:async()=>{},loadWorkoutCompletions:async()=>{},HUB_LAST_LOADED_AT:0,HUB_REVALIDATING:false,document:{hidden:false},root:{querySelector:()=>null},location:{hash:'#/hub/athlete'},Date,console,render:async()=>{}};vm.createContext(c);return c;}
test('pending dashboard refresh cannot replace a workout opened during the request',async()=>{const c=context();let resolve;c.authEdgePost=()=>new Promise(r=>resolve=r);vm.runInContext(presentation+extract('  async function loadAccountHubData(', '  async function loadHubData(')+extract('  async function refreshVisibleProgramme(', "  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);const request=c.run();c.location.hash='#/hub/session/day-1';resolve({programme:{week:8},exercises:[]});await request;assert.equal(c.HUB_STATE.programme.week,7);});
test('dashboard revalidation loads Week 8 and coalesces simultaneous focus events',async()=>{const c=context();let resolve,calls=0;c.authEdgePost=()=>{calls++;return new Promise(r=>resolve=r)};vm.runInContext(presentation+extract('  async function loadAccountHubData(', '  async function loadHubData(')+extract('  async function refreshVisibleProgramme(', "  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);const first=c.run();await c.run();resolve({programme:{week:8},exercises:[]});await first;assert.equal(calls,1);assert.equal(c.HUB_STATE.programme.week,8);await c.run();assert.equal(calls,1);});
test('failed refresh preserves current programme and does not interrupt feedback',async()=>{const c=context();let calls=0;c.authEdgePost=async()=>{calls++;throw Error('offline')};vm.runInContext(presentation+extract('  async function loadAccountHubData(', '  async function loadHubData(')+extract('  async function refreshVisibleProgramme(', "  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);await c.run();assert.equal(c.HUB_STATE.programme.week,7);c.location.hash='#/hub/feedback';await c.run();assert.equal(calls,1);assert.equal(c.HUB_REVALIDATING,false);});
test('eligible foreground checks coalesce without replacing the open workout',async()=>{
 const c=context();let resolve,guards=0,renders=0;
 c.location.hash='#/hub/session/day-1';
 c.CHECKIN_UI={eligible:()=>true,enabled:true,guard:route=>{
  guards++;assert.equal(route,'/session/day-1');
  return new Promise(r=>resolve=r);
 }};
 c.isHubRoute=()=>true;
 c.render=()=>{renders++;};
 vm.runInContext(presentation+extract('  async function refreshVisibleProgramme(',"  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);
 const pending=c.run();
 await c.run();
 assert.equal(guards,1);
 resolve(false);
 await pending;
 assert.equal(renders,0);
 assert.equal(c.HUB_STATE.programme.week,7);
 assert.equal(c.HUB_REVALIDATING,false);
});

test('school coach focus keeps the open slide and resumes refresh after Exit',async()=>{
 const c=context();let open=true,requests=0,renders=0;
 c.session=()=>({role:'staff',token:'synthetic'});
 c.location.hash='#/hub/staff';
 c.root.querySelector=selector=>open&&selector.includes('du-coach-command')?{dataset:{workoutRoute:'#/hub/staff'}}:null;
 c.loadHubData=async()=>{requests++;};
 c.render=async()=>{renders++;};
 vm.runInContext(presentation+extract('  async function refreshVisibleProgramme(', "  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);
 await c.run();
 assert.equal(requests,0);
 assert.equal(renders,0);
 open=false;
 await c.run();
 assert.equal(requests,1);
 assert.equal(renders,1);
});
test('an in-flight refresh cannot remount a presentation opened on the same dashboard route',async()=>{
 const c=context();let open=false,finish,renders=0;
 c.session=()=>({role:'staff',token:'synthetic'});
 c.location.hash='#/hub/staff';
 c.root.querySelector=selector=>open&&selector.includes('du-coach-command')?{dataset:{workoutRoute:'#/hub/staff'}}:null;
 c.loadHubData=async(_session,canApply)=>{
  await new Promise(resolve=>finish=resolve);
  if(canApply())c.HUB_STATE.programme={week:8};
 };
 c.render=async()=>{renders++;};
 vm.runInContext(presentation+extract('  async function refreshVisibleProgramme(', "  document.addEventListener('visibilitychange'")+';globalThis.run=refreshVisibleProgramme',c);
 const refresh=c.run();
 open=true;
 finish();
 await refresh;
 assert.equal(c.HUB_STATE.programme.week,7);
 assert.equal(renders,0);
});
