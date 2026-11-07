// Real PostgreSQL semantics over disposable synthetic data. Never connects to production.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const athlete='30000000-0000-4000-8000-000000000001',programme='10000000-0000-4000-8000-000000000001';
const week='50000000-0000-4000-8000-000000000001',draft='50000000-0000-4000-8000-000000000002';
const day='60000000-0000-4000-8000-000000000001',block='70000000-0000-4000-8000-000000000001';
const admin='40000000-0000-4000-8000-000000000009',parent='40000000-0000-4000-8000-000000000001';
const db=new PGlite();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const auth=async(id,role='authenticated')=>db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);
const count=()=>scalar('select count(*)::int from delivery_audit_events');
const latest=()=>scalar('select to_jsonb(e) from delivery_audit_events e order by sequence_id desc limit 1');
const stored=()=>scalar('select content from session_blocks where id=$1',[block]);
const update=async(next,expected,shared=false)=>scalar('select admin_update_workout_block($1,$2,6,$3,$4::jsonb,$5::jsonb,$6)',[athlete,programme,block,JSON.stringify(next),JSON.stringify(expected),shared]);
const isolated=async fn=>{await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}};
const denied=async(fn,pattern)=>{await db.exec('savepoint expected_failure');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}};
const asRole=async(role,id,fn)=>{await auth(id,role);await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role');}};
await db.exec(read('fixtures/database.sql'));
await db.exec(read('fixtures/audited-hub-policies.sql'));
await db.exec(read('../migrations/20261011_admin_update_workout_block.sql'));
await db.exec(read('fixtures/admin-publish-baseline.sql'));
await db.exec(read('../rollout/admin-workout-instructions.sql'));
// Canonical demo enrichment is the existing BEFORE trigger, not a test double.
await db.exec('alter table exercises add column name text;alter table exercises add column video_url text;');
await db.exec(read('fixtures/audited-session-triggers.sql'));
await db.exec("update exercises set name='Bridge',video_url='https://www.youtube.com/watch?v=abcdefghijk' where code='BR';update session_blocks set content=content");
const migration=fs.readdirSync(new URL('../migrations/',import.meta.url)).find(p=>p.endsWith('_delivery_audit_history.sql'));
const definitions=async()=> (await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('admin_publish_programme_week','admin_update_workout_block') order by proname")).rows;
const beforeDefinitions=await definitions();
if(migration)await db.exec(read('../migrations/'+migration));
try{
 await test('delivery history database integration',async t=>{
  await t.test('history is installed without inventing previous publication receipts',async()=>{
   assert.ok(await scalar("select to_regclass('public.delivery_audit_events') is not null"),'durable delivery audit table is missing');assert.equal(await count(),0);
  });
  if(!migration)return;
  await t.test('admin publish stores a full receipt atomically and exposes exact QA week to parent and athlete',()=>isolated(async()=>{
   await asRole('authenticated',admin,()=>scalar("select admin_publish_programme_week($1,'athlete',$2)",[draft,athlete]));
   const e=await latest();assert.equal(e.subject_id,draft);assert.equal(e.actor_user_id,admin);assert.equal(e.actor_role,'authenticated');assert.equal(e.operation,'UPDATE');
   assert.equal(e.before_snapshot.week.status,'draft');assert.equal(e.after_snapshot.week.status,'live');assert.equal(e.after_snapshot.week.week_number,7);
   assert.equal(e.after_snapshot.days.length,1);assert.equal(e.after_snapshot.days[0].blocks.length,1);
   assert.ok(e.after_snapshot.assignment_context.some(a=>a.athlete_id===athlete&&a.direct_current_week===7));
   for(const id of [parent,'40000000-0000-4000-8000-000000000002']){
    const rows=await asRole('authenticated',id,()=>db.query('select id from programme_weeks where id=$1',[draft]));assert.equal(rows.rows.length,1);
   }
  }));
  await t.test('existing publishing RPC definitions are unchanged by audit installation',async()=>{assert.deepEqual(await definitions(),beforeDefinitions);});
  await t.test('cohort publication retains its exact school assignment and full week',()=>isolated(async()=>{
   const w='50000000-0000-4000-8000-000000000009',d='60000000-0000-4000-8000-000000000009',c='20000000-0000-4000-8000-000000000001';
   await db.query("insert into programme_weeks(id,programme_id,week_number,status,verification_status) values($1,'10000000-0000-4000-8000-000000000002',2,'draft','needs_verification')",[w]);
   await db.query("insert into training_days(id,programme_week_id,title) values($1,$2,'QA school day')",[d,w]);
   await db.query("insert into session_blocks(id,training_day_id,title,content) values('70000000-0000-4000-8000-000000000009',$1,'QA school block','{\"items\":[\"Recovery\"]}')",[d]);
   await asRole('authenticated',admin,()=>scalar("select admin_publish_programme_week($1,'cohort',$2)",[w,c]));
   const e=await latest();assert.equal(e.programme_week_id,w);assert.equal(e.after_snapshot.days[0].blocks[0].title,'QA school block');assert.equal(e.after_snapshot.cohort_context.find(x=>x.id===c).current_week,2);
   assert.equal(await scalar('select current_week from cohorts where id=$1',[c]),2);
   assert.equal(await scalar('select current_week from athletes where id=$1',[athlete]),6,'cohort publish cannot advance a directly assigned private athlete');
  }));
  await t.test('protected edit preserves exact before content and canonical saved demo in its after snapshot',()=>isolated(async()=>{
   await auth('','service_role');const before=await stored();const next={items:['Bridge — 2 x 8'],prescriptions:[{exerciseCode:'BR',dosage:'2 x 8',rest:'60 seconds'}]};
   const r=await update(next,before),e=await latest();assert.deepEqual(e.before_snapshot.days[0].blocks[0].content,before);assert.deepEqual(e.after_snapshot.days[0].blocks[0].content,r.content);
   assert.equal(e.after_snapshot.days[0].blocks[0].content.video_links[0].video_url,'https://www.youtube.com/watch?v=abcdefghijk');
   assert.ok(e.after_snapshot.exercise_library.some(x=>x.code==='BR'&&x.video_url==='https://www.youtube.com/watch?v=abcdefghijk'));
   assert.equal(e.actor_user_id,null);assert.equal(e.actor_role,'service_role');assert.equal(e.subject_id,block);
  }));
  await t.test('draft-only and unchanged updates produce no false receipts',()=>isolated(async()=>{
   const n=await count();await db.exec("update session_blocks set title=title where id='"+block+"';update programme_weeks set status=status where id='"+week+"';update session_blocks set title='Draft changed' where id='70000000-0000-4000-8000-000000000002'");assert.equal(await count(),n);
  }));
  await t.test('stale preview, wrong target, shared edit and non-admin publish leave content/history unchanged',()=>isolated(async()=>{
   await auth('','service_role');const before=await stored(),n=await count();
   await denied(()=>update({items:['Changed']},{items:['Stale']}),/changed since preview/);
   await denied(()=>scalar('select admin_update_workout_block($1,$2,6,$3,$4::jsonb,$5::jsonb,false)',[athlete,'10000000-0000-4000-8000-000000000002',block,JSON.stringify(before),JSON.stringify(before)]));
   await db.exec("insert into athletes(id,programme_id,access_status) values('30000000-0000-4000-8000-000000000002','"+programme+"','active')");
   await denied(()=>update({items:['Changed']},before),/Shared programme/);
   await asRole('authenticated',parent,()=>denied(()=>scalar("select admin_publish_programme_week($1,'athlete',$2)",[draft,athlete]),/Admin access/));
   assert.deepEqual(await stored(),before);assert.equal(await count(),n);
  }));
  await t.test('explicit shared edits retain candidate assignments and can be restored through the protected RPC',()=>isolated(async()=>{
   await db.exec("insert into athletes(id,programme_id,current_week,access_status) values('30000000-0000-4000-8000-000000000002','"+programme+"',6,'active')");
   await auth('','service_role');const before=await stored(),next={items:['Recovery']};
   const r=await update(next,before,true);let e=await latest();assert.equal(e.after_snapshot.assignment_context.filter(a=>a.direct_programme_id===programme).length,2);
   await update(before,r.content,true);e=await latest();assert.deepEqual(await stored(),e.after_snapshot.days[0].blocks[0].content);assert.deepEqual(await stored(),before);
  }));
  await t.test('published block insertion and deletion reconstruct both full week states',()=>isolated(async()=>{
   const id='70000000-0000-4000-8000-000000000009';await db.query('insert into session_blocks(id,training_day_id,title,content) values($1,$2,$3,$4)',[id,day,'Added','{"items":["Recovery"]}']);
   let e=await latest();assert.equal(e.before_snapshot.days[0].blocks.length,1);assert.equal(e.after_snapshot.days[0].blocks.length,2);
   await db.query('delete from session_blocks where id=$1',[id]);e=await latest();assert.equal(e.before_snapshot.days[0].blocks.length,2);assert.equal(e.after_snapshot.days[0].blocks.length,1);
  }));
  await t.test('moving a block between published weeks records both sides without changing the old saved events',()=>isolated(async()=>{
   const otherDay='60000000-0000-4000-8000-000000000005';await db.query('update session_blocks set training_day_id=$1 where id=$2',[otherDay,block]);
   const es=(await db.query('select * from delivery_audit_events order by sequence_id')).rows;assert.equal(es.length,2);
   const old=es.find(e=>e.programme_week_id===week),next=es.find(e=>e.programme_week_id==='50000000-0000-4000-8000-000000000005');
   assert.equal(old.before_snapshot.days[0].blocks.length,1);assert.equal(old.after_snapshot.days[0].blocks.length,0);
   assert.equal(next.before_snapshot.days[0].blocks.length,1);assert.equal(next.after_snapshot.days[0].blocks.length,2);
  }));
  await t.test('bulk writes capture the whole statement before-image, without mixing old and new rows',()=>isolated(async()=>{
   const a='70000000-0000-4000-8000-000000000008',b='70000000-0000-4000-8000-000000000009';
   await db.query('insert into session_blocks(id,training_day_id,title,content) values($1,$3,$4,$5),($2,$3,$4,$5)',[a,b,day,'Bulk','{"items":["Recovery"]}']);
   const e=await latest();assert.equal(e.before_snapshot.days[0].blocks.length,1);assert.equal(e.after_snapshot.days[0].blocks.length,3);assert.equal(await count(),1);
   await db.query("update session_blocks set title='Bulk changed' where training_day_id=$1",[day]);
   const changed=await latest();assert.equal(changed.before_snapshot.days[0].blocks.filter(x=>x.title==='Bulk changed').length,0);assert.equal(changed.after_snapshot.days[0].blocks.filter(x=>x.title==='Bulk changed').length,3);
   assert.equal(changed.subject_ids.length,3);
  }));
  await t.test('block identity changes retain both old and new IDs and the exact before image',()=>isolated(async()=>{
   const next='70000000-0000-4000-8000-000000000009';await db.query("update session_blocks set id=$1,title='Changed identity' where id=$2",[next,block]);
   const e=await latest();assert.ok(e);assert.ok(e.subject_ids.includes(block));assert.ok(e.subject_ids.includes(next));assert.equal(e.before_snapshot.days[0].blocks[0].id,block);assert.equal(e.after_snapshot.days[0].blocks[0].id,next);
  }));
  await t.test('reparenting a published week preserves the old programme and assignment context',()=>isolated(async()=>{
   const next='10000000-0000-4000-8000-000000000002';await db.query('update programme_weeks set programme_id=$1 where id=$2',[next,week]);
   const e=await latest();assert.equal(e.before_snapshot.week.programme_id,programme);assert.equal(e.before_snapshot.programme.id,programme);assert.equal(e.after_snapshot.programme.id,next);
   assert.ok(e.before_snapshot.assignment_context.some(x=>x.direct_programme_id===programme));assert.equal(e.before_snapshot.cohort_context.length,0);
  }));
  await t.test('mixed upsert into published blocks rejects atomically instead of recording false before images',()=>isolated(async()=>{
   const before=await stored(),n=await count();
   await denied(()=>db.query("insert into session_blocks(id,training_day_id,title,content) values($1,$3,'Upsert changed',$4),($2,$3,'Upsert new',$4) on conflict(id) do update set title=excluded.title",[block,'70000000-0000-4000-8000-000000000009',day,JSON.stringify(before)]),/Published workout insert conflict/);
   assert.deepEqual(await stored(),before);assert.equal(await count(),n);assert.equal(await scalar('select count(*)::int from session_blocks where training_day_id=$1',[day]),1);
  }));
  await t.test('draft upserts stay compatible and insert scope cannot leak into a subsequent normal edit',()=>isolated(async()=>{
   const id='70000000-0000-4000-8000-000000000002',d='60000000-0000-4000-8000-000000000002';
   await db.query("insert into session_blocks(id,training_day_id,title,content) values($1,$2,'Draft upsert','{\"items\":[\"Recovery\"]}') on conflict(id) do update set title=excluded.title",[id,d]);
   assert.equal(await count(),0);await db.query("update session_blocks set title='Normal published edit' where id=$1",[block]);assert.equal(await count(),1);
  }));
  await t.test('published insert with DO NOTHING retains unchanged conflicts and audits successful inserts only',()=>isolated(async()=>{
   const before=await stored();await db.query("insert into session_blocks(id,training_day_id,title,content) values($1,$3,'Ignored',$4),($2,$3,'New',$4) on conflict(id) do nothing",[block,'70000000-0000-4000-8000-000000000009',day,JSON.stringify(before)]);
   const e=await latest();assert.deepEqual(await stored(),before);assert.equal(e.before_snapshot.days[0].blocks.length,1);assert.equal(e.after_snapshot.days[0].blocks.length,2);assert.equal(e.subject_ids.length,1);
  }));
  await t.test('archiving and subsequent edits retain the original published state',()=>isolated(async()=>{
   await db.query("update programme_weeks set status='archived' where id=$1",[week]);let e=await latest();assert.equal(e.before_snapshot.week.status,'live');assert.equal(e.after_snapshot.week.status,'archived');
   await db.query("update session_blocks set title='Archived correction' where id=$1",[block]);e=await latest();assert.equal(e.before_snapshot.days[0].blocks[0].title,'QA block');assert.equal(e.after_snapshot.days[0].blocks[0].title,'Archived correction');
  }));
  await t.test('clearing a publication timestamp cannot silently disable subsequent history',()=>isolated(async()=>{
   await db.query("update programme_weeks set status='draft',published_at=null where id=$1",[week]);
   await db.query("update session_blocks set title='After unpublish' where id=$1",[block]);assert.equal(await count(),2);
  }));
  await t.test('parents cannot read receipts; admin can read but no app role can forge or alter history',()=>isolated(async()=>{
   await db.query("update session_blocks set title='QA changed' where id=$1",[block]);
   assert.equal((await asRole('authenticated',parent,()=>db.query('select * from delivery_audit_events'))).rows.length,0);
   assert.equal((await asRole('authenticated',admin,()=>db.query('select * from delivery_audit_events'))).rows.length,1);
   for(const [role,id] of [['authenticated',admin],['authenticated',parent],['service_role','']])await asRole(role,id,async()=>{
    for(const sql of ["update delivery_audit_events set actor_role='fake'",'delete from delivery_audit_events',"insert into delivery_audit_events(source_table,operation,subject_id,programme_week_id,actor_role) values('session_blocks','UPDATE',gen_random_uuid(),gen_random_uuid(),'fake')"])
     await denied(()=>db.exec(sql),/permission denied|immutable/i);
    await denied(()=>scalar('select delivery_audit_private.snapshot_week($1)',[week]),/permission denied/);
   });
  }));
  await t.test('transaction rollback removes a successful mutation and its receipt together',async()=>{
   const before=await stored(),n=await count();await isolated(async()=>{await db.query("update session_blocks set title='Temporary' where id=$1",[block]);assert.equal(await count(),n+1);});assert.deepEqual(await stored(),before);assert.equal(await count(),n);
  });
  await t.test('audit failure cannot leave an unrecorded successful workout edit',()=>isolated(async()=>{
   await db.exec("create function delivery_audit_private.qa_fail() returns trigger language plpgsql as $$begin raise exception 'QA audit unavailable';end$$;create trigger qa_fail before insert on delivery_audit_events for each row execute function delivery_audit_private.qa_fail()");
   const before=await stored();await denied(()=>db.query("update session_blocks set content='{\"items\":[\"Changed\"]}' where id=$1",[block]),/QA audit unavailable/);assert.deepEqual(await stored(),before);
  }));
 });
}finally{await db.close();}
