// Explicit opt-in, isolated PostgreSQL integration QA. No network or production credentials.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/qa/database.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const uid=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const athlete='30000000-0000-4000-8000-000000000001', programme='10000000-0000-4000-8000-000000000001', week='50000000-0000-4000-8000-000000000001', block='70000000-0000-4000-8000-000000000001';
const db=new PGlite();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const content=()=>scalar('select content from session_blocks where id=$1',[block]);
const setAuth=async(id,role='authenticated')=>{await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);};
const asUser=async(id,fn)=>{await setAuth(id);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}};
const rpc=async(next,expected,shared=false)=>scalar('select admin_update_workout_block($1,$2,6,$3,$4::jsonb,$5::jsonb,$6)',[athlete,programme,block,JSON.stringify(next),JSON.stringify(expected),shared]);
const rollout=new URL('rollout/admin-workout-instructions.sql',root);
const baseline=process.env.HUB_QA_BASELINE==='1';
await db.exec(read('qa/fixtures/database.sql'));
await db.exec(read('qa/fixtures/audited-hub-policies.sql'));
await db.exec(read('migrations/20261011_admin_update_workout_block.sql'));
await db.exec(read('qa/fixtures/admin-publish-baseline.sql'));
const definitions=()=>db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('admin_update_workout_block','admin_publish_programme_week') order by proname");
const originalDefinitions=(await definitions()).rows;
const privileges=()=>db.query("select r.rolname,has_function_privilege(r.rolname,'public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean)','EXECUTE') as allowed from pg_roles r where rolname in ('anon','authenticated','service_role') order by rolname");
const originalPrivileges=(await privileges()).rows;
if(!baseline&&fs.existsSync(rollout))await db.exec(fs.readFileSync(rollout,'utf8'));
try{
 await test('database integration: exact SQL over synthetic local records',async t=>{
  await t.test('instruction-only prescription updates and restores without losing literal details',async()=>{
   await setAuth(uid(9),'service_role');const before=await content();const next={prescriptions:[{instruction:'3 x 80m @ 65%; rest 3 minutes. Stop if symptoms return.'}]};
   const result=await rpc(next,before);assert.deepEqual(result.content,next);assert.deepEqual(await content(),next);await rpc(before,next);assert.deepEqual(await content(),before);
  });
  await t.test('root instruction updates and restores',async()=>{
   await setAuth(uid(9),'service_role');const before=await content(),next={instruction:'Rest day. Follow the saved coach instructions.'};await rpc(next,before);assert.deepEqual(await content(),next);await rpc(before,next);
  });
  await t.test('empty and incomplete prescriptions reject without changing stored content',async()=>{
   await setAuth(uid(9),'service_role');const before=await content();
   for(const next of [{},{instruction:' '},{prescriptions:[{}]},{prescriptions:[{instruction:42}]},{prescriptions:[{instruction:' '}]},{prescriptions:[{exerciseCode:'BR',instruction:'Do this'}]},{prescriptions:[{exerciseCode:'BR'}]},{prescriptions:[{exerciseCode:'UNKNOWN',dosage:'2 x 8'}]}]){
    await assert.rejects(rpc(next,before));assert.deepEqual(await content(),before);
   }
  });
  await t.test('stale preview rejects and original content remains intact',async()=>{
   await setAuth(uid(9),'service_role');const before=await content();await assert.rejects(rpc({items:['Changed']},{items:['Stale']}),/changed since preview/);assert.deepEqual(await content(),before);
  });
  await t.test('whitespace movement codes cannot turn a prescription into a hidden instruction',async()=>{
   await setAuth(uid(9),'service_role');const before=await content();
   await assert.rejects(rpc({prescriptions:[{exerciseCode:' ',instruction:'Rest today'}]},before));assert.deepEqual(await content(),before);
  });
  await t.test('JavaScript-trim whitespace cannot be accepted as a saved instruction or dose',async()=>{
   await setAuth(uid(9),'service_role');const before=await content();
   for(const blank of ['\n\t','\u00a0\ufeff','\u2003\u2028'])for(const next of [{instruction:blank},{prescriptions:[{instruction:blank}]},{prescriptions:[{exerciseCode:'BR',dosage:blank}]}]){
    await assert.rejects(rpc(next,before));assert.deepEqual(await content(),before);
   }
  });
  await t.test('normal parent cannot call administrative update even with all target IDs',async()=>{
   const before=await content();await asUser(uid(1),async()=>{await assert.rejects(rpc({items:['Changed']},before),/permission denied/);});assert.deepEqual(await content(),before);
  });
  await t.test('shared edits require explicit confirmation and remain reversible',async()=>{
   await db.query("insert into athletes(id,programme_id,access_status) values ('30000000-0000-4000-8000-000000000002',$1,'active')",[programme]);await setAuth(uid(9),'service_role');const before=await content(),next={items:['QA shared change']};
   await assert.rejects(rpc(next,before),/Shared programme edit/);const result=await rpc(next,before,true);assert.equal(result.affected_other_athletes,1);await rpc(before,next,true);await db.exec("delete from athletes where id='30000000-0000-4000-8000-000000000002'");
  });
  await t.test('publication policies execute and parent/athlete get identical published rows',async()=>{
   await db.exec(read('rollout/hub-publication-policies.sql'));
   for(const table of ['programme_weeks','training_days','session_blocks']){
    const parent=await asUser(uid(1),()=>db.query(`select id from ${table} order by id`));const child=await asUser(uid(2),()=>db.query(`select id from ${table} order by id`));assert.deepEqual(parent.rows,child.rows);assert.equal(parent.rows.length,1);
    const stranger=await asUser(uid(8),()=>db.query(`select id from ${table}`));assert.equal(stranger.rows.length,0);
    await setAuth('','anon');await db.exec('set role anon');try{assert.equal((await db.query(`select id from ${table}`)).rows.length,0);}finally{await db.exec('reset role');}
   }
  });
  await t.test('actual week publish SQL exposes QA week to both roles and transaction rollback restores it',async()=>{
   const target='50000000-0000-4000-8000-000000000002';
   await asUser(uid(1),async()=>{await assert.rejects(db.query("select admin_publish_programme_week($1,'athlete',$2)",[target,athlete]),/Admin access required/);});
   await db.exec('begin');try{
    await setAuth(uid(9));await db.exec('set local role authenticated');const result=await scalar("select admin_publish_programme_week($1,'athlete',$2)",[target,athlete]);assert.equal(result.ok,true);await db.exec('reset role');
    for(const id of [uid(1),uid(2)]){const rows=await asUser(id,()=>db.query('select id from programme_weeks where id=$1',[target]));assert.equal(rows.rows.length,1);}
   }finally{await db.exec('rollback');}
   assert.equal(await scalar('select current_week from athletes where id=$1',[athlete]),6);assert.equal(await scalar('select published_at from programme_weeks where id=$1',[target]),null);
  });
  await t.test('week publishing rejects empty or incomplete instructions without publishing',async()=>{
   const target='50000000-0000-4000-8000-000000000002',draftBlock='70000000-0000-4000-8000-000000000002';
   for(const next of [{},{instruction:' '},{prescriptions:[{}]},{prescriptions:[{instruction:' '}]},{prescriptions:[{exerciseCode:'BR'}]}]){
    await db.exec('begin');try{
     await db.query('update session_blocks set content=$1 where id=$2',[JSON.stringify(next),draftBlock]);
     await setAuth(uid(9));await db.exec('set local role authenticated');
     await assert.rejects(db.query("select admin_publish_programme_week($1,'athlete',$2)",[target,athlete]));
    }finally{await db.exec('rollback');}
    assert.equal(await scalar('select published_at from programme_weeks where id=$1',[target]),null);
   }
  });
  await t.test('week publishing accepts literal instruction formats and rollback restores publication',async()=>{
   for(const next of [{instruction:'Recovery: follow the saved coach instructions.'},{prescriptions:[{instruction:'3 x 80m @ 65%; rest 3 minutes.'}]}]){
    await db.exec('begin');try{
     await db.query("update session_blocks set content=$1 where id='70000000-0000-4000-8000-000000000002'",[JSON.stringify(next)]);
     await setAuth(uid(9));await db.exec('set local role authenticated');const result=await scalar("select admin_publish_programme_week('50000000-0000-4000-8000-000000000002','athlete',$1)",[athlete]);assert.equal(result.ok,true);
    }finally{await db.exec('rollback');}
   }
  });
  await t.test('Journey rollout executes with direct-first assignment and excludes unpublished history',async()=>{
   await db.exec(read('rollout/journey-assignment-parity.sql'));
   const p=await scalar("select performance_journey_source('athlete',$1,true)",[athlete]),a=await scalar("select performance_journey_source('athlete',$1,false)",[athlete]);assert.deepEqual(p.programme,a.programme);assert.equal(p.programme.id,programme);assert.equal(p.current_week,6);assert.equal(p.weeks.length,1);
   await db.exec(read('rollout/journey-assignment-parity-rollback.sql'));const old=await scalar("select performance_journey_source('athlete',$1,true)",[athlete]);assert.notEqual(old.programme.id,programme);await db.exec(read('rollout/journey-assignment-parity.sql'));
  });
  await t.test('policy rollback restores audited expressions exactly and hardening can be reapplied',async()=>{
   const before=read('qa/fixtures/audited-hub-policies.sql');await db.exec(read('rollout/hub-publication-policies-rollback.sql'));
   const rolled=(await db.query("select policyname,qual from pg_policies where policyname like 'parent_or_athlete_read_live_%' order by policyname")).rows;
   await db.exec('drop policy parent_or_athlete_read_live_programme_weeks on programme_weeks;drop policy parent_or_athlete_read_live_training_days on training_days;drop policy parent_or_athlete_read_live_session_blocks on session_blocks');
   for(const stmt of before.split(';').filter(x=>x.includes('CREATE POLICY "parent_or_athlete_read_live_')))await db.exec(stmt+';');
   assert.deepEqual((await db.query("select policyname,qual from pg_policies where policyname like 'parent_or_athlete_read_live_%' order by policyname")).rows,rolled);await db.exec(read('rollout/hub-publication-policies.sql'));
  });
  await t.test('validator rollout preserves RPC grants and rollback restores audited definitions',async()=>{
   assert.deepEqual((await privileges()).rows,originalPrivileges);
   await db.exec(read('rollout/admin-workout-instructions-rollback.sql'));
   assert.deepEqual((await definitions()).rows,originalDefinitions);
   assert.deepEqual((await privileges()).rows,originalPrivileges);
   await db.exec(read('rollout/admin-workout-instructions.sql'));
  });
  await t.test('existing canonical demo trigger may update links while every prescribed field survives',async()=>{
   await db.exec('begin');try{
    await db.exec('alter table exercises add column name text;alter table exercises add column video_url text');
    await db.exec(read('qa/fixtures/audited-session-triggers.sql'));
    await db.query('update session_blocks set content=content where id=$1',[block]);
    await setAuth(uid(9),'service_role');const before=await content();
    const next={items:['QA running: 3 x 80m; rest 3 minutes'],prescriptions:[{instruction:'QA running: 3 x 80m; rest 3 minutes'}]};
    const result=await rpc(next,before);assert.deepEqual(result.content,{...next,video_links:[]});assert.deepEqual(await content(),result.content);
    await rpc(before,result.content);assert.deepEqual(await content(),before);
    await db.exec("update exercises set name='Bridge',video_url='https://www.youtube.com/watch?v=abcdefghijk' where code='BR'");
    const movement={items:['Bridge — 2 x 8'],prescriptions:[{exerciseCode:'BR',dosage:'2 x 8',rest:'60 seconds'}]};
    const canonical=await rpc(movement,before);
    assert.deepEqual(canonical.content,{...movement,video_links:[{item_index:0,exercise:'Bridge',video_url:'https://www.youtube.com/watch?v=abcdefghijk'}]});
    await rpc(before,canonical.content);assert.deepEqual(await content(),before);
    await db.query("update session_blocks set title='Air Zim Warm-Up' where id=$1",[block]).then(()=>assert.fail('Protected warm-up was allowed to lose its prescriptions'),error=>assert.match(error.message,/complete exercise prescriptions/));
   }finally{await db.exec('rollback');}
  });
  await t.test('readback still rejects any trigger change outside canonical demo metadata',async()=>{
   await db.exec('begin');try{
    await db.exec("create function qa_mutate_content() returns trigger language plpgsql as $$begin NEW.content=jsonb_set(NEW.content,'{unexpected}','true'::jsonb,true);return NEW;end$$;create trigger qa_mutate_content before update on session_blocks for each row execute function qa_mutate_content()");
    await setAuth(uid(9),'service_role');const before=await content();
    await assert.rejects(rpc({items:['QA note']},before),/read-back verification failed/);
   }finally{await db.exec('rollback');}
  });
 });
}finally{console.log('Engine: '+await scalar('select version()'));await db.close();}
