// Disposable PostgreSQL; no production connection, credentials or athlete records.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE||'/tmp/du-checkin-qa/node_modules/@electric-sql/pglite/dist/index.js'));
const root=new URL('../rollout/exercise-coaching-standard/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const changes=JSON.parse(read('changes.json')),content=JSON.parse(read('content.json'));
const apply=read('apply.sql'),rollback=read('rollback.sql');
const tables=['programmes','programme_weeks','training_days','session_blocks','saved_blocks','saved_block_items','athlete_overrides','cohort_overrides','athletes','cohorts','professional_members','programme_versions','feedback','workout_item_completions'];
const coaching=['description','purpose','coaching_cues','admin_notes'];
async function fixture(){
 const db=new PGlite();
 await db.exec(`create table exercises(id uuid primary key default gen_random_uuid(),code text unique,name text,video_id text,video_url text,description text,purpose text,coaching_cues text,admin_notes text,category_slug text,categories text[],default_dosage text,display_order int,active boolean,created_at timestamptz default now(),updated_at timestamptz default now());`);
 for(const [i,c] of changes.entries())await db.query('insert into exercises(code,name,video_id,video_url,description,purpose,coaching_cues,admin_notes,category_slug,categories,default_dosage,display_order,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,$11,true)',[c.code,c.name,c.video_id,c.video_url,...coaching.map(k=>c.before[k]),'synthetic-category',['synthetic-category'],i]);
 for(const table of tables){
  await db.exec(`create table ${table}(id text primary key,payload jsonb);`);
  await db.query(`insert into ${table} values('synthetic-a',$1),('synthetic-b',$2)`,[JSON.stringify({owner:'synthetic-a',programme:'programme-a',prescriptions:[{exerciseCode:'STR01',dosage:'2 × 8/leg',rest:'90 seconds',cues:'Light support.'}],video_links:[{exercise:'Split Squat',youtube:'unchanged-demo'}]}),JSON.stringify({owner:'synthetic-b',programme:'programme-b',history:'retain'})]);
 }
 return db;
}
async function state(db){
 const out={exercises:(await db.query('select * from exercises order by code')).rows};
 for(const t of tables)out[t]=(await db.query(`select * from ${t} order by id`)).rows;
 return out;
}
test('review JSON and both SQL payloads agree exactly',()=>{
 assert.equal(new Set(changes.map(c=>c.code)).size,85);
 for(const c of changes){const row=content.find(e=>e.code===c.code);assert.ok(row,c.code);for(const k of ['name','video_id','video_url'])assert.equal(row[k],c[k]);for(const k of coaching)assert.equal(row[k],c.after[k]);}
 for(const [sql,reverse] of [[apply,false],[rollback,true]]){
  const embedded=JSON.parse(sql.match(/\$changes\$([\s\S]*?)\$changes\$::jsonb/)[1]);
  assert.deepEqual(embedded,reverse?changes.map(c=>({...c,before:c.after,after:c.before})):changes);
 }
});
test('apply, retry, rollback and rollback retry preserve all mappings, prescriptions, assignments and history',async()=>{
 const db=await fixture();try{
  const before=await state(db);await db.exec(apply);const after=await state(db);
  for(const table of tables)assert.deepEqual(after[table],before[table],table);
  for(const [i,row] of after.exercises.entries()){
   const c=changes.find(c=>c.code===row.code);for(const k of coaching)assert.equal(row[k],c.after[k],row.code+': '+k);
   for(const k of Object.keys(row).filter(k=>!coaching.includes(k)&&k!=='updated_at'))assert.deepEqual(row[k],before.exercises[i][k],row.code+': '+k);
  }
  await db.exec(apply);assert.deepEqual(await state(db),after);
  await db.exec(rollback);const restored=await state(db);
  for(const row of restored.exercises)delete row.updated_at;for(const row of before.exercises)delete row.updated_at;
  assert.deepEqual(restored,before);await db.exec(rollback);
 }finally{await db.close();}
});
test('transaction rehearsal leaves the complete database unchanged',async()=>{
 const db=await fixture();try{const before=await state(db);await db.exec('begin;'+apply+'rollback;');assert.deepEqual(await state(db),before);}finally{await db.close();}
});
for(const [column,value] of [['description','New coach edit'],['name','Renamed'],['video_id','new-demo-id'],['video_url','https://example.com/new']])test('stale '+column+' aborts the entire apply without earlier-row changes',async()=>{
 const db=await fixture();try{await db.query(`update exercises set ${column}=$1 where code=$2`,[value,changes.at(-1).code]);const before=await state(db);await assert.rejects(db.exec(apply),/changed|Concurrent/);assert.deepEqual(await state(db),before);}finally{await db.close();}
});
test('rollback refuses to overwrite subsequent coaching edits',async()=>{
 const db=await fixture();try{await db.exec(apply);await db.query('update exercises set coaching_cues=$1 where code=$2',['Later approved edit',changes.at(-1).code]);const before=await state(db);await assert.rejects(db.exec(rollback),/Concurrent/);assert.deepEqual(await state(db),before);}finally{await db.close();}
});
for(const target of ['exercises','session_blocks','athletes'])test('unexpected trigger side effects on '+target+' abort atomically',async()=>{
 const db=await fixture();try{
  const mutation=target==='exercises'?"NEW.video_id := 'unexpected';":`UPDATE ${target} SET payload='{"unexpected":true}';`;
  await db.exec(`create function unexpected_side_effect() returns trigger language plpgsql as $$begin ${mutation} return NEW; end$$; create trigger side_effect before update on exercises for each row execute function unexpected_side_effect();`);
  const before=await state(db);await assert.rejects(db.exec(apply),/Protected|programme/);assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
test('production-equivalent exercise RLS permits admin only and remains unchanged by rollout',async()=>{
 const db=await fixture();try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table admin_profiles(user_id uuid);insert into admin_profiles values('00000000-0000-4000-8000-000000000001');
   grant usage on schema auth to authenticated,anon;grant select on admin_profiles to authenticated;grant select,insert,update,delete on exercises to authenticated,anon;alter table exercises enable row level security;
   create policy admin_all_exercises on exercises for all to authenticated using(exists(select 1 from admin_profiles a where a.user_id=auth.uid())) with check(exists(select 1 from admin_profiles a where a.user_id=auth.uid()));`);
  const policies=await db.query("select * from pg_policies where tablename='exercises'");
  await db.exec(apply);
  for(const uid of ['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']){
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');
   assert.equal((await db.query('select * from exercises')).rows.length,0);
   assert.equal((await db.query("update exercises set description='unauthorized' returning code")).rows.length,0);
   await assert.rejects(db.query("insert into exercises(code) values('UNAUTHORIZED')"),/row-level security/);await db.exec('reset role');
  }
  await db.exec('set role anon');assert.equal((await db.query('select * from exercises')).rows.length,0);await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-4000-8000-000000000001']);await db.exec('set role authenticated');assert.equal((await db.query('select * from exercises')).rows.length,85);await db.exec('reset role');
  assert.deepEqual(await db.query("select * from pg_policies where tablename='exercises'"),policies);
 }finally{await db.close();}
});
