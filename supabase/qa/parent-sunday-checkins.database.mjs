import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCheckinFixture} from './weekly-checkin-fixture.mjs';

const answer={formVersion:'2.0',completion:'all',challenge:'right',recovery:'good',note:''};
test('parents have one Sunday report, Monday carry-over and no start or early-open requirement',async()=>{
 const f=await createCheckinFixture();
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null');
  const state=date=>f.state(date,'parent',f.ids.parent);
  const friday=await state('2026-11-13T16:00Z');
  assert.equal(friday.due.length,0);
  assert.equal(friday.requirements.length,1);
  assert.equal(friday.requirements[0].due_date,'2026-11-15');
  const early=await f.scalar('select open_weekly_end_checkin($1,$2,$3)',[f.ids.parent,'parent','2026-11-13T16:00Z']);
  assert.equal(early.due.length,0);
  assert.equal((await state('2026-11-15T05:59Z')).due.length,0);
  const sunday=await state('2026-11-15T06:00Z');
  assert.deepEqual(sunday.due.map(r=>r.kind),['end']);
  assert.equal(sunday.due[0].period_start,'2026-11-09');
  const id=sunday.due[0].id;
  const monday=await state('2026-11-16T16:00Z');
  assert.deepEqual(monday.due.map(r=>r.id),[id]);
  assert.equal(monday.requirements.some(r=>r.kind==='start'),false);
  await f.save(id,answer,'parent-sunday-save-0001',0,false,f.ids.parent,'parent','2026-11-16T16:00Z');
  assert.equal((await state('2026-11-16T16:00Z')).due.length,0);
  assert.equal((await state('2026-11-21T16:00Z')).due.length,0);
  const next=await state('2026-11-22T16:00Z');
  assert.equal(next.due.length,1);
  assert.equal(next.due[0].due_date,'2026-11-22');
  assert.notEqual(next.due[0].id,id);
  assert.equal((await state('2026-11-22T16:00Z')).requirements.length,2);
 }finally{await f.db.close();}
});

test('parent Sunday identity survives assignment changes and missed Sundays persist from enrollment',async()=>{
 const f=await createCheckinFixture();
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null');
  const state=date=>f.state(date,'parent',f.ids.parent);
  const sunday=(await state('2026-11-15T16:00Z')).due[0];
  await f.db.exec('update athletes set current_week=10');
  assert.deepEqual((await state('2026-11-16T16:00Z')).due.map(r=>r.id),[sunday.id]);
  const later=await state('2026-11-29T16:00Z');
  assert.deepEqual(later.due.map(r=>r.due_date),['2026-11-15','2026-11-22','2026-11-29']);
  assert.equal(later.requirements.some(r=>r.kind==='start'),false);
 }finally{await f.db.close();}
});

test('late first parent enrollment creates only the latest Sunday; timezone follows server configuration',async()=>{
 const f=await createCheckinFixture();
 try{
  await f.db.exec("update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null,checkin_timezone='Africa/Harare'");
  const state=date=>f.state(date,'parent',f.ids.parent);
  const before=await state('2026-11-28T21:59Z');
  assert.deepEqual(before.due.map(r=>r.due_date),['2026-11-22']);
  const after=await state('2026-11-28T22:00Z');
  assert.equal(after.today,'2026-11-29');
  assert.deepEqual(after.due.map(r=>r.due_date),['2026-11-22','2026-11-29']);
 }finally{await f.db.close();}
});

test('schedule migration retains legacy feedback and duplicate assignment history without a second parent gate',async()=>{
 const f=await createCheckinFixture({sunday:false});
 try{
  await f.db.exec('update weekly_checkin_config set enabled=true;update athletes set athlete_user_id=null');
  const state=date=>f.state(date,'parent',f.ids.parent);
  const legacy=await state('2026-11-16T16:00Z');
  const end=legacy.requirements.find(r=>r.kind==='end');
  await f.save(end.id,answer,'legacy-parent-save-0001',0,false,f.ids.parent,'parent','2026-11-20T16:00Z');
  await f.db.exec('update athletes set current_week=10');
  await state('2026-11-16T16:00Z');
  const count=await f.scalar('select count(*)::int from weekly_checkin_requirements');
  await f.db.exec(fs.readFileSync(new URL('../migrations/20261113040957_parent_sunday_checkins.sql',import.meta.url),'utf8'));
  assert.equal(await f.scalar('select count(*)::int from feedback'),1);
  assert.equal(await f.scalar('select count(*)::int from weekly_checkin_requirements'),count);
  assert.equal(await f.scalar('select count(*)::int from weekly_checkin_requirements where calendar_weekly'),1);
  assert.equal((await state('2026-11-22T16:00Z')).due.length,0);
 }finally{await f.db.close();}
});
