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

test('assigned warm-up is scoped to its original parent-managed athlete and programme',()=>{
 const input=structuredClone(base);
 input.assignedWarmUpAthleteId='target';
 input.programme.id='own-programme';
 input.trainingDays.push(
  {id:'garage',day_key:'Libero Garage Warm-Up',title:'Libero Garage Warm-Up',objective:'Bring a resistance band.'},
  {id:'standard',day_key:'Routine',title:'Standard Volleyball Warm-Up'},
 );
 input.blocks.push(
  {training_day_id:'garage',block_type:'warmup',sort_order:0,title:'Phase 1',content:{
   routineKind:'warm-up',assignedWarmUpAthleteId:'target',assignedWarmUpProgrammeId:'own-programme',
   prescriptions:[{exerciseCode:'WU01',dosage:'1 × 8 each ankle'}],
  }},
  {training_day_id:'garage',block_type:'warmup',sort_order:3,title:'Phase 4',content:{
   writtenOnly:true,items:['3-Step Defensive Shuffle — 3–4 rounds'],
   video_links:[{item_index:0,exercise:'Ankle Rock'}],
  }},
 );
 input.exercises=[{code:'WU01',name:'Ankle Rock',video_id:'6Dlac5mxD6k',active:true}];
 input.blocks[0].block_type='warm-up';
 const {sessions}=shapeBootstrap(input).programme;
 const workout=sessions.find(s=>s.id==='day');
 const routine=sessions.find(s=>s.id==='garage');
 assert.deepEqual(workout.assignedWarmUp,{routineId:'garage',replacedSections:[{order:0,title:'Established Standard Warm-Up'}]});
 assert.deepEqual(workout.prescriptions.map(p=>p.exerciseCode),['WU01','STR02']);
 assert.equal(routine.assignedWarmUpOverview,'Bring a resistance band.');
 assert.deepEqual(routine.itemSections[0].videoLinks,[]);
 assert.ok(!sessions.some(s=>s.id==='standard'));

 for(const change of [{assignedWarmUpAthleteId:'other'},{assignedWarmUpAthleteId:undefined},{programme:{id:'another'}}]){
  const other=shapeBootstrap({...input,...change}).programme.sessions;
  assert.ok(!other.some(s=>s.id==='garage'));
  assert.ok(other.some(s=>s.id==='standard'));
  assert.equal(other[0].assignedWarmUp,undefined);
 }
});
