import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeBootstrap} from '../functions/_shared/hub-core.ts';
const base={role:'athlete',cohort:{id:'a',current_week:9},programme:{id:'p'},week:{},exercises:[],
 trainingDays:[{id:'day',day_key:'Monday'},{id:'mob',day_key:'Mobility Routine'},{id:'warm',day_key:'Standard Warm-Up'}],
 blocks:[{training_day_id:'day',sort_order:0,title:'Established Standard Warm-Up',content:{prescriptions:[{exerciseCode:'WU01',dosage:'1 × 8'}]}},
 {training_day_id:'day',sort_order:1,content:{preparation:{routineIds:['mob','warm'],replacedSectionOrders:[0]},prescriptions:[{exerciseCode:'STR02',dosage:'2 × 8'}]}},
 {training_day_id:'mob',content:{routineKind:'mobility'}},{training_day_id:'warm',content:{routineKind:'warm-up'}}]};
test('routine metadata is additive and retains all original prescription indexes',()=>{
 const result=shapeBootstrap(base),sessions=result.programme.sessions;
 assert.deepEqual(sessions[0].preparation,{routineIds:['mob','warm'],replacedSectionOrders:[0]});
 assert.equal(sessions[1].routineKind,'mobility');assert.equal(sessions[2].routineKind,'warm-up');
 assert.deepEqual(sessions[0].prescriptions.map(p=>p.exerciseCode),['WU01','STR02']);
});
test('missing, foreign and self-referencing preparation metadata never leaves the bootstrap',()=>{
 for(const ids of [['mob','foreign'],['day','warm'],['mob','mob']]){
  const input=structuredClone(base);input.blocks[1].content.preparation.routineIds=ids;
  assert.equal(shapeBootstrap(input).programme.sessions[0].preparation,undefined);
 }
});
