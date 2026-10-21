'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const app=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function renderSession('));
function fixture(audience='parent',role='athlete'){
 const start=app.indexOf('  function assignedRoutines('),end=app.indexOf('  function renderSchoolAthleteCompact(',start);
 assert.ok(start>=0&&end>start,'dedicated routine navigation exists');
 const ctx={DuHubDelivery:require('./delivery.js'),HUB_STATE:{audience,contentStatus:'published'},root:{innerHTML:''},
  programme:()=>ctx.p,session:()=>({role}),escapeHtml:s=>String(s??'').replace(/</g,'&lt;'),encodeURIComponent,
  shell:s=>s,pageHead:(label,title,desc,back)=>`<a href="${back}">${label}</a><h1>${title}</h1>${desc}`,
  renderWorkoutExperience:s=>{ctx.rendered=s;return '<button data-workout-mode="guided">Guided Workout</button><a href="https://youtu.be/abcdefghijk">Watch demo</a>';},
  isSchoolReferenceViewer:()=>audience==='school',schoolGroup:()=> 'Form 2',groupPicker:()=>'<select>Form 2</select>',
  assignedAirZim:()=>null,renderNotFound:()=>{ctx.root.innerHTML='Not found';},airZimTool:()=>''};
 ctx.p={sessions:[{id:'warm',day:'Game Warm-Up',title:'Standard Warm-Up',watch:'Keep comfortable',prescriptions:[{exerciseCode:'WU01',dosage:'2 x 8'}]},{id:'d1',day:'Day 1',title:'Core + Mobility'}]};
 vm.createContext(ctx);vm.runInContext(app.slice(start,end)+';globalThis.api={assignedRoutines,trainingSessions,routinesShortcut,renderRoutines,renderRoutine};',ctx);
 return ctx;
}
test('all Hub roles enter a separate routines list containing only assigned routines',()=>{
 for(const [audience,role] of [['parent','athlete'],['private-athlete','athlete'],['school','athlete'],['school','staff'],['professional','athlete']]){
  const c=fixture(audience,role),before=JSON.stringify(c.p);
  assert.match(c.api.routinesShortcut(),/href="#\/hub\/routines"/);
  c.api.renderRoutines();assert.match(c.root.innerHTML,/Standard Warm-Up/);assert.match(c.root.innerHTML,/#\/hub\/session\/warm/);
  assert.doesNotMatch(c.root.innerHTML,/Core \+ Mobility|Day 1|Choose training day/);
  assert.equal(JSON.stringify(c.p),before,'assigned programme is never mutated');
 }
});
test('routine detail preserves the assigned workout renderer and guidance without training-day navigation',()=>{
 for(const [audience,role] of [['parent','athlete'],['private-athlete','athlete'],['school','athlete'],['school','staff'],['professional','athlete']]){
  const c=fixture(audience,role);c.api.renderRoutine(c.p.sessions[0]);
  assert.match(c.root.innerHTML,/← Your Routines/);assert.match(c.root.innerHTML,/#\/hub\/routines/);
  assert.match(c.root.innerHTML,/Keep comfortable|Guided Workout|Watch demo/);
  assert.doesNotMatch(c.root.innerHTML,/Day 1|Choose training day|Core \+ Mobility/);
  assert.equal(c.rendered,c.p.sessions[0],'same session object, exercise IDs and doses reach the existing renderer');
 }
});
test('core routines can be added explicitly without misclassifying a scheduled core workout',()=>{
 const c=fixture();c.p.sessions.push({id:'core',day:'Core Routine',title:'Core Control'});
 assert.equal(c.api.assignedRoutines(c.p).length,2);assert.deepEqual(Array.from(c.api.trainingSessions(c.p),s=>s.id),['d1']);
 c.api.renderRoutines();assert.match(c.root.innerHTML,/Core Control/);assert.doesNotMatch(c.root.innerHTML,/Core \+ Mobility/);
});
test('empty and unpublished programmes expose no stale routine content',()=>{
 const c=fixture();c.HUB_STATE.contentStatus='preparing';c.api.renderRoutines();assert.doesNotMatch(c.root.innerHTML,/Standard Warm-Up|session\/warm/);
 c.HUB_STATE.contentStatus='published';c.p={sessions:[]};c.api.renderRoutines();assert.match(c.root.innerHTML,/coach-approved routines will appear/i);
 c.api.renderRoutine({id:'someone-else',title:'Other athlete private routine'});assert.equal(c.root.innerHTML,'Not found');
});
