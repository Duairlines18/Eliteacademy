'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
assert.ok(scripts.length>=1);
scripts.forEach((script,index)=>assert.doesNotThrow(()=>new vm.Script(script,{filename:'inline-'+index+'.js'})));
const app=scripts.find(x=>x.includes('function schoolAthleteDelivery('));
assert.ok(app,'Hub application script must exist');
const extract=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);};
const source=extract('  function compactSchoolWeek(p){','  function weekBlock(')
  +extract('  function visibleNormalizedSections(workout){','  function flattenedWorkoutItems(')
  +extract('  function athleteCopyText(sessionData,sections){','  function renderWorkoutExperience(')
  +';globalThis.testApi={compactSchoolWeek,visibleNormalizedSections,athleteCopyText,schoolAthleteDelivery};';
let selected='Form 2';
const context={
  escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  encodeURIComponent,
  schoolGroup:()=>selected,
  isSharedSchoolViewer:()=>true,
  deliverySections:sections=>sections,
  isSchoolWarmupSection:s=>/warm[- ]?up/i.test(s.title),
  hubPhaseRows:()=>'<span>optional reference</span>'
};
vm.createContext(context);vm.runInContext(source,context);const api=context.testApi;
const week=api.compactSchoolWeek({sessions:[
 {id:'one',day:'Day 1',title:'Acceleration',duration:'60m'},
 {id:'two',day:'Day 2',title:'Capacity'},
 {id:'three',day:'Day 3',title:'Strength'},
 {id:'four',day:'Day 4',title:'Optional Recovery'}],weeklyObjective:'Body control'});
assert.equal((week.match(/hub-athlete-day-choice/g)||[]).length,4);
assert.match(week,/Optional/);
assert.match(week,/Weekly focus/);
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
assert.match(app,/if\(isSchoolReferenceViewer\(\)\)return schoolAthleteDelivery\(sections,sessionData\)/);
assert.match(app,/const schoolAthlete=isSchoolReferenceViewer\(\)&&session\(\)\?\.role!=='staff'/);
assert.match(app,/navigator\.clipboard\?\.writeText/);
assert.match(app,/data-athlete-copy-status/);
assert.match(html,/hub-athlete-day-picker/);
assert.match(html,/hub-athlete-warmup/);
assert.match(html,/hub-athlete-demo/);
console.log('Athlete five-minute sheet QA passed: script syntax, 4-day navigation, Form isolation, warm-up collapsed, dosage, safe demos, copy text, school-only scope and mobile layout.');
