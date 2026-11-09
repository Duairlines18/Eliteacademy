'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {dayDetail,routineCards}=require('./delivery.js');
const mob={id:'mob',routineKind:'mobility',title:'Mobility'};
const warm={id:'warm',routineKind:'warm-up',title:'Volleyball Warm-Up'};
const day={id:'day1',day:'Monday',title:'Strength',preparation:{routineIds:['mob','warm'],replacedSectionOrders:[0]}};
test('Andria gets one presentation card with both original routines',()=>{
 const programme={sessions:[day,mob,warm]};
 const result=dayDetail(programme,'day1');
 assert.equal(result.session.id,'day1');
 assert.equal(result.routines.length,1);
 assert.deepEqual(result.routines[0].sessions,[mob,warm]);
 assert.equal(result.routines[0].title,'My Warm-Up');
});
test('day detail selects only requested training day',()=>{
 const day2={id:'day2',day:'Wednesday',title:'Trunk'};
 const p={sessions:[day,day2,mob,warm]};
 assert.equal(dayDetail(p,'day2').session.id,'day2');
 assert.equal(dayDetail(p,'day2').routines.length,0);
 assert.equal(dayDetail(p,'missing'),null);
});
test('Air Zim appears only when explicitly assigned to that day',()=>{
 const air={id:'air',day:'Air Zim Warm-Up',title:'Air Zim Warm-Up'};
 const d={id:'d',day:'Friday',preparation:{routineIds:['air']}};
 assert.deepEqual(routineCards({sessions:[d,air]},d)[0].sessions,[air]);
 assert.deepEqual(routineCards({sessions:[d,air]}, {id:'injured',day:'Monday'}),[]);
});
test('missing, duplicate and foreign routine IDs do not become cards',()=>{
 const d={id:'d',day:'Monday',preparation:{routineIds:['air']}};
 assert.deepEqual(routineCards({sessions:[d]},d),[]);
 assert.deepEqual(routineCards({sessions:[d,{id:'air'},{id:'air'}]},d),[]);
});
test('inline Air Zim is assigned only from the selected day, without changing its prescription',()=>{
 const air={id:'a',day:'Monday',prescriptions:[{sectionTitle:'Air Zim Warm-Up',exerciseCode:'WU01',dosage:'1 × 8'},{sectionTitle:'Main',exerciseCode:'STR02'}]};
 const p={sessions:[air,{id:'rehab',day:'Tuesday',watch:'No running'}]},before=JSON.stringify(p);
 const cards=routineCards(p,air);
 assert.equal(cards.length,1);assert.equal(cards[0].sectionTitle,'Air Zim Warm-Up');assert.equal(cards[0].sessions[0],air);
 assert.deepEqual(routineCards(p,p.sessions[1]),[]);assert.equal(JSON.stringify(p),before);
});
test('inline Air Zim moves out of main view after keys are allocated',()=>{
 const s={id:'a',prescriptions:[{sectionTitle:'Air Zim Warm-Up'}]},p={sessions:[s]};
 const sections=[{title:'Air Zim Warm-Up',items:[{key:'p:0:0:WU01'}]},{title:'Main',items:[{key:'p:1:1:STR02'}]}];
 assert.deepEqual(require('./delivery.js').trainingSections({...p,separateWarmups:true},s,sections),[sections[1]]);
});
