'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)].filter(m=>!/\\btype\\s*=\\s*[\"']module[\"']/i.test(m[1])).map(m=>m[2]).filter(x=>x.trim());
assert.ok(scripts.length>=1);
scripts.forEach((script,index)=>assert.doesNotThrow(()=>new vm.Script(script,{filename:'inline-'+index+'.js'})));
const app=scripts.find(x=>x.includes('function schoolAthleteDelivery('));
assert.ok(app,'Hub application script must exist');
const extract=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);};
const source=extract('  function compactAthleteWeek(p,activeId){','  function weekBlock(')
  +extract('  function visibleNormalizedSections(workout){','  function flattenedWorkoutItems(')
  +extract('  function privateSelfServeViewer(){','  function renderWorkoutExperience(')
  +';globalThis.testApi={compactAthleteWeek,visibleNormalizedSections,athleteCopyText,schoolAthleteDelivery,privateSelfServeViewer};';
let selected='Form 2';
const context={
  escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  encodeURIComponent,
  HUB_STATE:{audience:'school'},
  session:()=>({role:'athlete'}),
  schoolGroup:()=>selected,
  isSharedSchoolViewer:()=>true,
  deliverySections:sections=>sections,
  isSchoolWarmupSection:s=>/warm[- ]?up/i.test(s.title),
  hubPhaseRows:()=>'<span>optional reference</span>'
};
vm.createContext(context);vm.runInContext(source,context);const api=context.testApi;
const week=api.compactAthleteWeek({sessions:[
 {id:'one',day:'Day 1',title:'Acceleration',duration:'60m'},
 {id:'two',day:'Day 2',title:'Capacity'},
 {id:'three',day:'Day 3',title:'Strength'},
 {id:'four',day:'Day 4',title:'Optional Recovery'}],weeklyObjective:'Body control'});
assert.equal((week.match(/hub-athlete-day-choice/g)||[]).length,4);
assert.match(week,/Optional/);
assert.match(week,/Weekly focus/);
assert.match(api.compactAthleteWeek({sessions:[{id:'one',day:'Day 1'}]},'one'),/hub-athlete-day-choice selected/);
assert.match(app,/function compactSchoolWeek\(p\)/);
assert.doesNotMatch(week,/CURRENT PROGRAMME|60m/);
const sections=[
 {title:'Standard Warm-Up',order:1,items:[{title:'200m easy jog',dosage:'100m out + 100m back',group:''},{title:'Split Squat',dosage:'2 × 6',group:'Form 2'},{title:'Split Squat',dosage:'3 × 8',group:'Form 3'}]},
 {title:'Main Strength',order:2,items:[{title:'Calf Raise',dosage:'2 × 10',group:'Form 2',videoUrl:'https://www.youtube.com/shorts/test'},{title:'Calf Raise',dosage:'3 × 12',group:'Form 3'},{title:'Bridge',dosage:'2 × 8',group:'Form 2',videoUrl:'javascript:alert(1)'}]}
];
const visible=api.visibleNormalizedSections({sections});
assert.equal(visible[0].items.length,2);
assert.equal(visible[1].items.length,2);
const output=api.schoolAthleteDelivery(visible,{title:'Training'});
assert.match(output,/<details class="hub-athlete-phase hub-athlete-warmup">/);
assert.doesNotMatch(output,/<details class="hub-athlete-phase hub-athlete-warmup" open/);
assert.match(output,/2 × 6/);
assert.doesNotMatch(output,/3 × 8|3 × 12/);
assert.match(output,/▶ Watch demo/);
assert.doesNotMatch(output,/javascript:alert/);
assert.doesNotMatch(output,/<summary>Technique<\/summary>/);
assert.match(output,/data-athlete-copy/);
const copied=api.athleteCopyText({day:'Day 1',title:'Acceleration',duration:'60m',watch:'Stop when quality falls'},visible);
assert.match(copied,/Training group: Form 2/);
assert.match(copied,/2 × 6/);
assert.doesNotMatch(copied,/3 × 8|3 × 12/);
assert.ok(copied.includes('\nMain Strength\n'));
selected='Form 3';
const other=api.visibleNormalizedSections({sections});
assert.equal(other[1].items.length,1);
assert.match(api.athleteCopyText({day:'Day 1',title:'Training'},other),/3 × 12/);
assert.doesNotMatch(api.athleteCopyText({day:'Day 1',title:'Training'},other),/2 × 10/);
assert.match(app,/if\(isSchoolReferenceViewer\(\)\|\|privateSelfServeViewer\(\)\)return schoolAthleteDelivery\(sections,sessionData\)/,'school and private views retain compact sheet');
assert.match(app,/const schoolAthlete=isSchoolReferenceViewer\(\)&&session\(\)\?\.role!=='staff'/);
assert.match(app,/navigator\.clipboard\?\.writeText/);
assert.match(app,/data-athlete-copy-status/);
assert.match(html,/hub-athlete-day-picker/);
assert.match(html,/hub-athlete-warmup/);
assert.match(html,/hub-athlete-demo/);
assert.match(app,/if\(privateSelfServeViewer\(\)\)return renderPrivateAthleteCompact\(\)/);
assert.match(app,/if\(copyButton&&\(isSchoolReferenceViewer\(\)\|\|privateSelfServeViewer\(\)\|\|HUB_STATE\.audience==='parent'\)/);
context.HUB_STATE.audience='private-athlete';
assert.equal(api.privateSelfServeViewer(),true);
const privateWorkout=[{title:'Day 1 Strength',items:[{title:'Split Squat',dosage:'3 × 6',rest:'90s'},{title:'Calf Raise',dosage:'2 × 10'}]}];
const privateSheet=api.schoolAthleteDelivery(privateWorkout,{title:'Day 1'});
assert.match(privateSheet,/data-athlete-copy/);
assert.match(privateSheet,/3 × 6/);
assert.doesNotMatch(privateSheet,/Training group:/);
const privateCopy=api.athleteCopyText({day:'Day 1',title:'Strength',duration:'40 min'},privateWorkout);
assert.match(privateCopy,/Split Squat — 3 × 6 · Rest: 90s/);
assert.doesNotMatch(privateCopy,/Training group:/);
context.HUB_STATE.audience='professional';
assert.equal(api.privateSelfServeViewer(),true);
context.HUB_STATE.audience='parent';
assert.equal(api.privateSelfServeViewer(),false);
console.log('Athlete five-minute sheet QA passed: script syntax, 4-day navigation, Form isolation, warm-up collapsed, dosage, safe demos, copy text, school-only scope and mobile layout.');


// Private-athlete regression: exact embedded exercise codes must resolve to the
// approved video and a clean prescription, without inventing a dosage.
const normalizeSrc=extract('  function normalizedTextItem(', '  function expandTextWorkoutItem(');
const normalizeContext={
  parsedGroup:v=>({text:String(v),group:''}),cleanLegacyExerciseText:v=>String(v).trim(),
  leadingDosage:v=>({dosage:'',text:v}),legacyExerciseMatch:()=>null,
  textPrescription:v=>({title:v,dosage:'',rest:'',type:'text'}),
  coachingParts:()=>({cue:'',avoid:''})
};
vm.createContext(normalizeContext);
vm.runInContext(normalizeSrc+';globalThis.normalize=normalizedTextItem;',normalizeContext);
const verified=[
 {code:'STR02',name:'Step-Up',videoUrl:'https://www.youtube.com/shorts/Tdn9-s7-YPc'},
 {code:'MOB01',name:'90/90 Hip Rotation',videoUrl:'https://www.youtube.com/shorts/pW9QAqCau3Y'},
 {code:'MOB04',name:'Diaphragmatic Breathing',videoUrl:'https://www.youtube.com/shorts/gSrUPWTSU-g'}
];
for(const [raw,name,dose,code] of [
 ['Step-Up (STR02) 2 × 8/leg','Step-Up','2 × 8/leg','STR02'],
 ['90/90 Hip Rotation (MOB01) 2 × 6/side','90/90 Hip Rotation','2 × 6/side','MOB01'],
 ['Diaphragmatic Breathing (MOB04) 2–3 min','Diaphragmatic Breathing','2–3 min','MOB04']
]){
 const item=normalizeContext.normalize(raw,0,0,verified);
 assert.equal(item.title,name);assert.equal(item.dosage,dose);
 assert.equal(item.code,code);assert.match(item.videoUrl,/^https:\/\/www\.youtube\.com\/shorts\//);
 const rendered=api.schoolAthleteDelivery([{title:'Strength',items:[item]}],{title:'Test'});
 assert.match(rendered,/▶ Watch demo/);assert.doesNotMatch(rendered,/\(STR02\)|\(MOB01\)|\(MOB04\)|Dose not specified/);
}
const unknown=normalizeContext.normalize('Unknown exercise (BAD99) 2 × 8',0,0,verified);
assert.equal(unknown.videoUrl,'');
assert.doesNotMatch(api.schoolAthleteDelivery([{title:'Session',items:[unknown]}],{}),/▶ Watch demo/);
assert.match(app,/total>=week&&total>1/,'invalid week totals must not be shown');
assert.match(app,/const displayDose=dosage;/,'no invented dose placeholders');
console.log('Private athlete exact-code video and dose regression QA passed.');

assert.match(app,/function renderParentSimpleDashboard\(/,'parent compact dashboard exists');
assert.match(app,/if\(HUB_STATE\.audience==='parent'\)return renderParentSimpleDashboard\(\)/,'parent does not render old cards, guide or history');
assert.match(app,/function parentTrainingDays\(/,'parent-only day picker exists');
assert.match(app,/function parentSessionLabel\(/,'game warm-up has a parent-specific label resolver');
assert.match(app,/\?'Game Warm-Up'/,'game warm-up remains clearly labeled');
assert.match(app,/parentAthlete\?parentTrainingDays\(p,s\.id\):compactAthleteWeek\(p,s\.id\)/,'parent session navigation uses parent picker');
assert.match(app,/if\(mode==='quick'\)return .*schoolAthleteDelivery\(sections,sessionData\)/,'parent quick view retains compact workout and demos');
assert.match(app,/Guided Workout<\/button>/,'parent guided toggle is present');
assert.match(app,/guidedCard\(items\[cursor\]/,'parent guided mode uses original step-by-step card');
assert.match(app,/data-completion-toggle/,'guided completion control remains present');
assert.match(app,/saveWorkoutCompletion\(sessionKey,itemKey,next\)/,'completion persists through existing backend');
assert.match(app,/data-guided-next/,'guided next navigation remains present');
assert.match(app,/privateSelfServeViewer\(\)\|\|HUB_STATE\.audience==='parent'\)\&\&session\(\)\?\.role!=='staff'/,'parent can copy workout');
assert.match(app,/\(privateSelfServeViewer\(\)\|\|HUB_STATE\.audience==='parent'\)\?\[\]/,'parent copy omits school training group');
console.log('Parent four-day simplicity regression QA passed.');
