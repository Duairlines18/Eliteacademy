const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('./delivery.js'),html=fs.readFileSync('index.html','utf8');
const app=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function renderSession('));
const mobility={id:'mob',day:'Mobility Routine',title:'Mobility',routineKind:'mobility'};
const warmup={id:'warm',day:'Standard Warm-Up',title:'Standard Volleyball Warm-Up',routineKind:'warm-up'};
const day={id:'day',day:'Monday',preparation:{routineIds:['mob','warm'],replacedSectionOrders:[0]}};
test('preparation requires both explicitly assigned routines in the same programme',()=>{
 assert.equal(typeof api.preparationFor,'function');
 assert.deepEqual(api.preparationFor({sessions:[day,mobility,warmup]},day).routines.map(s=>s.id),['mob','warm']);
 for(const sessions of [[day,mobility],[day,{...mobility,routineKind:'warm-up'},warmup],[day,mobility,warmup,{...warmup}]])assert.equal(api.preparationFor({sessions},day).routines.length,0);
 assert.equal(api.preparationFor({sessions:[day,mobility,warmup]},{...day,preparation:{routineIds:['mob','foreign'],replacedSectionOrders:[0]}}).routines.length,0);
});
test('only explicit superseded preparation is hidden, after completion keys are assigned',()=>{
 assert.equal(typeof api.trainingSections,'function');
 const sections=[{order:0,items:[{key:'p:0:0:WU01'}]},{order:1,items:[{key:'p:1:8:STR02'},{key:'p:1:9:PLY01'}]}],p={sessions:[day,mobility,warmup]},before=JSON.stringify(sections);
 const result=api.trainingSections(p,day,sections);
 assert.deepEqual(result,[sections[1]]);assert.equal(result[0].items[0].key,'p:1:8:STR02');assert.equal(JSON.stringify(sections),before);
 assert.deepEqual(api.trainingSections({sessions:[day]},day,sections),sections);
 assert.deepEqual(api.trainingSections(p,{...day,preparation:{routineIds:['mob','warm'],replacedSectionOrders:[1]}},sections),sections,'training order 1 cannot be hidden');
});
test('standalone mobility stays out of the weekly training-day list',()=>{
 assert.deepEqual(api.overview({sessions:[day,mobility,warmup]}).training.map(s=>s.id),['day']);
});
test('single-set between-set rests are hidden without erasing recovery prescriptions',()=>{
 assert.equal(typeof api.displayRest,'function');
 assert.equal(api.displayRest('1 × 8 each ankle','30–60 sec between sets'),'');
 assert.equal(api.displayRest('2 × 10','30–60 sec between sets'),'30–60 sec between sets');
 assert.equal(api.displayRest('1 × 8','60 seconds before next exercise'),'60 seconds before next exercise');
});
test('private athletes reach the same guided renderer as parents, with own session and restrictions',()=>{
 const start=app.indexOf('  function renderWorkoutExperience('),end=app.indexOf('  function nav(',start);
 const ctx={HUB_STATE:{audience:'private-athlete'},programme:()=>({sessions:[]}),session:()=>({role:'athlete'}),normalizeWorkoutSession:s=>({id:s.id}),EXERCISES:[],requiresGroupSelection:()=>false,
 visibleNormalizedSections:()=>[],flattenedWorkoutItems:()=>[{key:'p:1:0:MOB04',sectionTitle:'Core',title:'Breathing'}],isWorkoutComplete:()=>false,
 WORKOUT_MODE:'guided',GUIDED_CURSOR:{},guidedCard:(item,title,index,total,id)=>`Guided ${id} ${item.key}`,
 groupPicker:()=>'',isIdentifiedSchoolAthlete:()=>false,isSchoolReferenceViewer:()=>false,privateSelfServeViewer:()=>true,schoolAthleteDelivery:()=> 'QUICK ONLY'};
 vm.createContext(ctx);vm.runInContext(app.slice(start,end)+';globalThis.render=renderWorkoutExperience;',ctx);
 assert.match(ctx.render({id:'anos-own-day'}),/Guided anos-own-day p:1:0:MOB04/);
});
test('guided preparation loads its matching delivery helper revision',()=>{
 assert.match(html,/<script src="\/hub-delivery\/delivery\.js\?v=20261109-unified"><\/script>/);
});
