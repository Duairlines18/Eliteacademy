import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDeliveryTarget} from './resolve-delivery-target.mjs';
const f=()=>({athlete:{id:'a',programme_id:'p',current_week:4,cohort_id:null},
 programme:{id:'p',status:'live'},
 week:{id:'w',programme_id:'p',week_number:4,status:'live',verification_status:'verified',published_at:'2026-10-01'},
 accountType:'private-athlete'});
test('Larry/Ishe/Charles direct programme needs no cohort',()=>{
 const x=resolveDeliveryTarget(f());assert.equal(x.ok,true);assert.equal(x.route,'direct-private');
});
test('different athlete programme fails',()=>{const x=f();x.athlete.programme_id='other';assert.equal(resolveDeliveryTarget(x).ok,false)});
test('wrong week fails',()=>{const x=f();x.week.week_number=5;assert.equal(resolveDeliveryTarget(x).ok,false)});
test('unpublished week fails',()=>{const x=f();x.week.published_at=null;assert.equal(resolveDeliveryTarget(x).ok,false)});
test('inactive programme fails',()=>{const x=f();x.programme.status='archived';assert.equal(resolveDeliveryTarget(x).ok,false)});
test('school cohort route works',()=>{const x=f();x.accountType='school';x.athlete.cohort_id='c';x.cohort={id:'c',programme_id:'p',current_week:4,status:'live'};assert.equal(resolveDeliveryTarget(x).ok,true)});
test('school wrong cohort blocked',()=>{const x=f();x.accountType='school';x.cohort={id:'c',programme_id:'p',current_week:4,status:'live'};assert.equal(resolveDeliveryTarget(x).ok,false)});
