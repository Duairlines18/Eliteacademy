const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('./premium-v2.js').identity,html=fs.readFileSync('index.html','utf8');
test('full temporary school names remain distinguishable without changing private greetings',()=>{
 for(let n=1;n<=6;n++){const name='St. George’s Athlete 0'+n;assert.equal(identity({accessMode:'identified-school',athlete:{displayName:name,testing:true}}).headline,'Hi, '+name);}
 assert.equal(identity({audience:'private-athlete',athlete:{fullName:'Example Athlete'}}).headline,'Hi, Example');
});
test('identified-school form choice is per athlete and assigned form cannot be overridden',()=>{
 const s=html.indexOf('  function schoolGroupStorageKey('),e=html.indexOf('  function groupPicker(',s);assert.ok(s>=0&&e>s);
 const values=new Map(),ctx={HUB_STATE:{athlete:{id:'first',formTier:null}},SCHOOL_GROUP_KEY:'group',localStorage:{getItem:k=>values.get(k)||''}};
 vm.createContext(ctx);vm.runInContext(html.slice(s,e)+';globalThis.api={schoolGroup,schoolGroupStorageKey}',ctx);
 values.set(ctx.api.schoolGroupStorageKey(),'Form 2');assert.equal(ctx.api.schoolGroup(),'Form 2');
 ctx.HUB_STATE.athlete={id:'second',formTier:null};assert.equal(ctx.api.schoolGroup(),'');
 ctx.HUB_STATE.athlete.formTier='Form 3';values.set(ctx.api.schoolGroupStorageKey(),'Lower 6');assert.equal(ctx.api.schoolGroup(),'Form 3');
});
test('identified school mode enables persistence while legacy school/staff stay reference-only',()=>{
 assert.match(html,/isSharedSchoolViewer\(\)&&!isIdentifiedSchoolAthlete\(\)/);
 assert.match(html,/action:'logout'/);assert.match(html,/WORKOUT_COMPLETIONS=new Map\(\);Object.keys\(GUIDED_CURSOR\)/);
 assert.match(html,/data-completion-toggle/);
});
test('director oversight explains the four-week skills roadmap without exposing draft workouts',()=>{
 const start=html.indexOf('  function renderDirectorOverview(){'),end=html.indexOf('  function renderStaffDashboard(){',start);
 const ctx={HUB_STATE:{cohort:{name:'Synthetic school'},staff:{displayName:'Test Director'}},programme:()=>({title:'Four-week Plyometric Skills Pilot',totalWeeks:4,week:1,weeklyObjective:'Learn landing control'}),weekLabel:()=> 'Week 1 of 4',trainingSessions:()=>[{title:'Day 1'},{title:'Day 2'},{title:'Optional recovery'}],escapeHtml:s=>String(s),shell:s=>s,pageHead:()=>'',compactSchoolWeek:()=>'',routinesShortcut:()=>'',mountSchoolAttendance(){},root:{}};
 vm.runInNewContext(html.slice(start,end)+';renderDirectorOverview();',ctx);
 for(const text of ['Land','Spring','Project','Own','February','Weeks 2–4 remain unreleased'])assert.ok(ctx.root.innerHTML.includes(text),text);
});

test('school palette applies only to matching school identity and leaves other audiences unthemed',()=>{
 const start=html.indexOf('  // SCHOOL_THEME_LOOKUP_START'),end=html.indexOf('  // SCHOOL_THEME_LOOKUP_END',start);
 assert.ok(start>=0&&end>start);
 const ctx={HUB_STATE:{cohort:{name:'St. George’s — LOCAL TEST FIXTURE'},programme:{school:'Other School'}}};
 vm.createContext(ctx);
 vm.runInContext(html.slice(start,end)+';globalThis.theme=schoolTheme;',ctx);
 assert.equal(ctx.theme()?.accent,'#cf2e2e');
 ctx.HUB_STATE.cohort={name:'St George’s College'};
 assert.equal(ctx.theme()?.deep,'#651c26');
 ctx.HUB_STATE.cohort={name:'Hillcrest College'};
 assert.equal(ctx.theme(),null);
 ctx.HUB_STATE.cohort=null;ctx.HUB_STATE.programme={school:'Private Athlete'};
 assert.equal(ctx.theme(),null);
});

test('school training day keeps saved restrictions and athlete notes visible',()=>{
 const start=html.indexOf('  function renderSession(id){'),end=html.indexOf('\n  function ',start+1);
 const workout={id:'rehab',day:'Day 3',title:'Modified rehabilitation',watch:'No running or jumping.',athleteNote:'Stop if pain increases <today>.'};
 const ctx={programme:()=>({sessions:[workout]}),assignedRoutines:()=>[],renderCoachCommand:()=>false,session:()=>({role:'athlete'}),isSchoolReferenceViewer:()=>true,privateSelfServeViewer:()=>false,HUB_STATE:{audience:'school'},weekLabel:()=> 'Week 1',schoolGroup:()=>'',groupPicker:()=>'',preparationNavigation:()=>'',renderWorkoutExperience:()=>'',shell:s=>s,escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),root:{}};
 vm.runInNewContext(html.slice(start,end)+';renderSession("rehab");',ctx);
 assert.ok(ctx.root.innerHTML.includes('No running or jumping.'),'saved restriction must remain visible in school day');
 assert.ok(ctx.root.innerHTML.includes('Stop if pain increases &lt;today&gt;.'),'athlete note must remain visible and escaped');
 assert.ok(ctx.root.innerHTML.includes('Quiet, controlled landings.'),'existing school guidance retained');
});
