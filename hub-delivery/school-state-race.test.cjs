const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const defer=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
test('old athlete bootstrap cannot replace a newly selected athlete',async()=>{
 const pending=defer();let current='athlete-A';const c={session:()=>({token:current}),sessionStamp:()=>current,HUB_STATE:{athlete:{id:'B'}},HUB_CONFIG:{dataFunction:'hub-data'},edgePost:()=>pending.promise,loadFullExerciseLibrary:async()=>{},loadWorkoutCompletions:async()=>{},EXERCISES:[],DuHubDelivery:{safeVideo:()=>''},setSession:()=>{},console};
 vm.createContext(c);vm.runInContext(extract('  async function loadHubData(', '  function categoryRoute(')+';globalThis.run=loadHubData',c);
 const run=c.run({token:'athlete-A'});current='athlete-B';pending.resolve({programme:{id:'A'},athlete:{id:'A'},exercises:[]});await run;assert.equal(c.HUB_STATE.athlete.id,'B');
});
test('late completion list and save cannot poison another athletes in-memory progress',async()=>{
 for(const kind of ['list','set']){
  const pending=defer();let current='A';const c={session:()=>({role:'athlete'}),sessionStamp:()=>current,isSharedSchoolViewer:()=>false,isIdentifiedSchoolAthlete:()=>true,completionPost:()=>pending.promise,WORKOUT_COMPLETIONS:new Map(),completionKey:(s,i)=>s+'|'+i,console};
  vm.createContext(c);vm.runInContext(extract('  async function loadWorkoutCompletions(', '  function simpleText(')+';globalThis.run={loadWorkoutCompletions,saveWorkoutCompletion}',c);
  const run=kind==='list'?c.run.loadWorkoutCompletions():c.run.saveWorkoutCompletion('day','item',true);current='B';c.WORKOUT_COMPLETIONS=new Map([['B|own',true]]);
  pending.resolve(kind==='list'?{completions:[{sessionKey:'day',itemKey:'item',completed:true}]}:{completion:{sessionKey:'day',itemKey:'item',completed:true}});await run;
  assert.deepEqual(Array.from(c.WORKOUT_COMPLETIONS.keys()),['B|own']);
 }
});

test('stale unauthorized bootstrap cannot clear the next login',async()=>{
 const pending=defer();let current='A',cleared=false;
 const c={session:()=>({token:current}),sessionStamp:()=>current,HUB_STATE:{athlete:{id:'B'}},HUB_CONFIG:{dataFunction:'hub-data'},edgePost:()=>pending.promise,setSession:()=>{cleared=true;},console};
 vm.createContext(c);vm.runInContext(extract('  async function loadHubData(', '  function categoryRoute(')+';globalThis.run=loadHubData',c);
 const run=c.run({token:'A'});current='B';pending.reject(Object.assign(Error('expired'),{status:401}));await run;assert.equal(cleared,false);assert.equal(c.HUB_STATE.athlete.id,'B');
});
