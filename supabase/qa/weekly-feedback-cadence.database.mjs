import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckinFixture} from './weekly-checkin-fixture.mjs';

test('private cadence: Monday readiness and Friday review, one of each per calendar week',async()=>{
 const f=await createCheckinFixture({cadence:true});
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true');
  const friday=await f.state('2026-11-13T16:00:00Z');
  assert.deepEqual(friday.due.map(r=>r.kind),['end']);
  assert.equal(friday.due[0].due_date,'2026-11-13');
  const monday=await f.state('2026-11-16T16:00:00Z');
  assert.deepEqual(monday.due.map(r=>r.kind).sort(),['end','start']);
  assert.equal(monday.requirements.filter(r=>r.period_start==='2026-11-16').length,2);
  assert.equal(monday.requirements.find(r=>r.period_start==='2026-11-16'&&r.kind==='end').due_date,'2026-11-20');
  const repeat=await f.state('2026-11-16T17:00:00Z');
  assert.equal(repeat.requirements.length,monday.requirements.length);
  const next=await f.state('2026-11-23T16:00:00Z');
  assert.equal(next.requirements.filter(r=>r.period_start==='2026-11-23').length,2);
 }finally{await f.db.close();}
});

test('parent cadence: one Friday review, early completion declaration, no duplicates or retroactive backlog',async()=>{
 const f=await createCheckinFixture({cadence:true});
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null');
  const state=d=>f.state(d,'parent',f.ids.parent);
  const thursday=await state('2026-11-12T16:00:00Z');
  assert.equal(thursday.requirements.length,0);
  const friday=await state('2026-11-13T16:00:00Z');
  assert.equal(friday.requirements.length,1);
  assert.equal(friday.due.length,1);
  assert.equal(friday.due[0].due_date,'2026-11-13');
  assert.equal(friday.due[0].calendar_weekly,true);
  await f.save(friday.due[0].id,{formVersion:'2.0',completion:'all',challenge:'right',recovery:'good',note:''},'cadence-parent-save-0001',0,false,f.ids.parent,'parent','2026-11-13T16:00:00Z');
  const monday=await state('2026-11-16T16:00:00Z');
  assert.equal(monday.requirements.length,2);
  assert.equal(monday.due.length,0);
  const early=await f.scalar('select public.open_weekly_end_checkin($1,$2,$3)',[f.ids.parent,'parent','2026-11-16T16:00:00Z']);
  assert.equal(early.due.length,1);
  assert.equal(early.due[0].period_start,'2026-11-16');
  assert.equal(early.due[0].due_date,'2026-11-16');
  assert.equal((await state('2026-11-16T17:00:00Z')).requirements.length,2);
  await assert.rejects(f.save(early.due[0].id,{formVersion:'2.0',completion:'all',challenge:'right',recovery:'good',note:''},'cadence-cross-user-001',0,false,f.ids.other,'parent','2026-11-16T16:00:00Z'),/access/i);
 }finally{await f.db.close();}
});

test('calendar cadence does not rewrite submitted parent history',async()=>{
 const f=await createCheckinFixture({cadence:true});
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null');
  const first=await f.state('2026-11-13T16:00:00Z','parent',f.ids.parent);
  await f.save(first.due[0].id,{formVersion:'2.0',completion:'some',challenge:'right',recovery:'good',incompleteReason:'schedule',note:''},'cadence-parent-save-0002',0,false,f.ids.parent,'parent','2026-11-13T16:00:00Z');
  const again=await f.state('2026-11-15T16:00:00Z','parent',f.ids.parent);
  assert.equal(again.due.length,0);
  assert.equal(again.requirements[0].submitted_at!==null,true);
 }finally{await f.db.close();}
});
