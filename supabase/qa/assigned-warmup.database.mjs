import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE||'/tmp/du-guided-qa/node_modules/@electric-sql/pglite/dist/index.js'));
const migration=await readFile('supabase/migrations/20261123153939_carry_forward_assigned_warmup.sql','utf8');
const prepare=await readFile('supabase/rollout/volleyball-garage-warmup/prepare.sql','utf8');
const athlete='11111111-1111-4111-8111-111111111111';
const programme='22222222-2222-4222-8222-222222222222';
const otherProgramme='33333333-3333-4333-8333-333333333333';
const mappings=[['WU01','6Dlac5mxD6k'],['MOB01','pW9QAqCau3Y'],['ACT01','nD1CM76NlVs'],['ACT06','vAUZlEFjM9U'],['ISO01','tx3FFbtkTnk'],['PLY03','l6kbuPq2aHU'],['PLY10','B0Yd3lnlW2E']];

test('garage warm-up rollout is reversible, keeps original records, and carries forward only at publication',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated;
   create table athletes (id uuid primary key, programme_id uuid, current_week int, parent_user_id uuid, access_status text, display_name text);
   create table programme_weeks (id uuid primary key default gen_random_uuid(), programme_id uuid, week_number int, tier_id uuid, status text, verification_status text, published_at timestamptz);
   create table training_days (id uuid primary key default gen_random_uuid(), programme_week_id uuid references programme_weeks, day_key text, title text, duration text, objective text, sort_order int);
   create table session_blocks (id uuid primary key default gen_random_uuid(), training_day_id uuid references training_days, block_type text, title text, sort_order int, content jsonb, saved_block_id uuid);
   create table exercises (code text, name text, video_id text, video_url text, active boolean, id uuid default gen_random_uuid());
   create table workout_item_completions (id int primary key, completed boolean);
   create table feedback (id int primary key, week_number int);
   insert into workout_item_completions values (1,true);
   insert into feedback values (1,10),(2,11);
   insert into athletes values ('${athlete}','${programme}',11,gen_random_uuid(),'active','Test Athlete');
   insert into programme_weeks(programme_id,week_number,status,verification_status,published_at) values
     ('${programme}',10,'completed','verified',now()),
     ('${programme}',11,'live','verified',now()),
     ('${programme}',12,'draft','needs_verification',null),
     ('${otherProgramme}',12,'draft','needs_verification',null);
   insert into training_days(programme_week_id,day_key,title,sort_order)
     select id,'Day '||i,'Workout '||i,i from programme_weeks, generate_series(1,3) i;
   insert into session_blocks(training_day_id,block_type,title,sort_order,content)
     select id,'warmup','My Du Airlines Warm-Up',1,'{"prescriptions":[{"exerciseCode":"WU01","dosage":"8/side"}]}' from training_days;
   insert into session_blocks(training_day_id,block_type,title,sort_order,content)
     select id,'core','Core',2,'{"prescriptions":[{"exerciseCode":"CORE01","dosage":"2 × 8"}]}' from training_days;
  `);
  for(const [code,id] of mappings)await db.query('insert into exercises (code,name,video_id,video_url,active) values($1,$1,$2,$3,true)',[code,id,'https://www.youtube.com/shorts/'+id]);
  await db.exec(await readFile('supabase/qa/fixtures/audited-session-triggers.sql','utf8'));
  await db.exec(migration);
  const setup=prepare.replace('BEGIN;',`BEGIN; SET LOCAL du.warmup_athlete='${athlete}'; SET LOCAL du.warmup_programme='${programme}';`);
  const rows=sql=>db.query(sql).then(res=>res.rows);
  const original=await rows('select * from session_blocks order by id');
  const days=await rows('select * from training_days order by id');
  await db.exec(setup);
  assert.deepEqual(await rows('select * from training_days order by id'),days);
  await db.exec(setup.replace(/ROLLBACK;\s*$/,'COMMIT;'));
  await db.exec(setup.replace(/ROLLBACK;\s*$/,'COMMIT;'));
  const routineRows=()=>rows(`select w.week_number,d.id,d.title,b.sort_order,b.content from programme_weeks w
    join training_days d on d.programme_week_id=w.id join session_blocks b on b.training_day_id=d.id
    where d.day_key='Libero Garage Warm-Up' order by w.week_number,b.sort_order`);
  const originalRoutine=await routineRows();
  assert.equal(originalRoutine.length,4);
  assert.equal(originalRoutine[0].title,'Test — Libero Garage Warm-Up');
  assert.deepEqual(originalRoutine.flatMap(b=>b.content.prescriptions||[]).map(rx=>rx.exerciseCode),mappings.map(([code])=>code));
  assert.match(originalRoutine[3].content.items[0],/^3-Step Defensive Shuffle — 3–4 rounds/);
  assert.deepEqual(originalRoutine[3].content.video_links,[]);
  await db.exec(`update programme_weeks set status='live',verification_status='verified',published_at=now() where week_number=12`);
  const publishedRoutines=await routineRows();
  assert.equal(publishedRoutines.length,8);
  assert.notEqual(publishedRoutines[4].id,originalRoutine[0].id);
  assert.equal(publishedRoutines[4].content.assignedWarmUpAthleteId,athlete);
  assert.equal(publishedRoutines[4].content.carryForward,undefined);
  await db.exec(`update programme_weeks set published_at=now() where week_number=12`);
  assert.deepEqual(await routineRows(),publishedRoutines);
  const ordinaryBlocks=await rows("select b.* from session_blocks b join training_days d on d.id=b.training_day_id where d.day_key<>'Libero Garage Warm-Up' order by b.id");
  assert.deepEqual(ordinaryBlocks,original);
  assert.deepEqual(await rows('select id,completed from workout_item_completions'),[{id:1,completed:true}]);
  assert.deepEqual(await rows('select id,week_number from feedback order by id'),[{id:1,week_number:10},{id:2,week_number:11}]);
 } finally {await db.close();}
});
