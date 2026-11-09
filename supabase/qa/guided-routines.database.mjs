// Disposable synthetic PostgreSQL only; never connects to production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE||'/tmp/du-guided-qa/node_modules/@electric-sql/pglite/dist/index.js'));
const script=await readFile('qa/guided-routines.prepare.sql','utf8');
const targets=[['8abd2210-bb04-444f-affe-3281d65033f8','0de17bfe-2126-4f60-9e32-358b799355bd','d0524315-b762-46b5-9a23-310d01fb9d45'],['7ddbf26e-4d2e-4dde-b7a4-a30264aea357','a87e23a6-4958-44e9-b2fc-874fe363e039','4249a539-7a95-425a-9c74-f125ea7ef29d']];
async function fixture(){
 const db=new PGlite();
 await db.exec(`create table athletes(id uuid primary key,programme_id uuid,current_week int,access_status text);
 create table programme_weeks(id uuid primary key,programme_id uuid,week_number int,status text,verification_status text,published_at timestamptz);
 create table training_days(id uuid primary key default gen_random_uuid(),programme_week_id uuid,day_key text,title text,duration text,sort_order int);
 create table session_blocks(id uuid primary key default gen_random_uuid(),training_day_id uuid,block_type text,title text,sort_order int,content jsonb);
 create table programme_versions(id uuid default gen_random_uuid(),programme_week_id uuid,snapshot jsonb,change_note text);
 create table workout_item_completions(id int primary key,payload jsonb);create table feedback(id int primary key,payload jsonb);
 create table exercises(code text,video_id text,video_url text,active bool);
 insert into workout_item_completions values(1,'{"saved":true}');insert into feedback values(1,'{"note":"Keep my history"}');`);
 for(const [a,p,w] of targets){
  await db.query('insert into athletes values($1,$2,9,\'active\')',[a,p]);
  await db.query('insert into programme_weeks values($1,$2,9,\'live\',\'verified\',now())',[w,p]);
  for(const [order,day] of ['Monday','Wednesday','Friday'].entries()){
   const {rows:[d]}=await db.query('insert into training_days(programme_week_id,day_key,title,sort_order) values($1,$2,$2,$3) returning id',[w,day,order]);
   for(const [n,type,title,content] of [[0,'warm-up','Established Standard Warm-Up',{prescriptions:[{exerciseCode:'WU01',dosage:'1 × 8'}]}],[1,'training','Main Workout',{watch:'Stop if painful',prescriptions:[{exerciseCode:'STR02',dosage:'2 × 8',rest:'45–60 seconds'},{exerciseCode:'PLY01',dosage:'2 × 4',cues:'Only if pain-free'}]}]])
    await db.query('insert into session_blocks(training_day_id,sort_order,block_type,title,content) values($1,$2,$3,$4,$5)',[d.id,n,type,title,JSON.stringify(content)]);
  }
 }
 for(const [code,id] of [['WU01','6Dlac5mxD6k'],['WU06','nL-SiujsIMk'],['WU07','7euYeH7erNw'],['WU05','ZchkCbWjOXw'],['WU03','e6BRge-9RdY'],['SPR01','4lQsMyKRRn8'],['PLY03','l6kbuPq2aHU']])await db.query('insert into exercises values($1,$2,$3,true)',[code,id,'https://www.youtube.com/shorts/'+id]);
 const {rows:[{hash}]}=await db.query(`select md5(string_agg(b.content::text,'|' order by d.sort_order,b.sort_order)) hash from session_blocks b join training_days d on d.id=b.training_day_id where d.programme_week_id=$1`,[targets[0][2]]);
 return {db,sql:script.replaceAll('0b65a8ddd00f340f8f9dbbdbbb09d5d5',hash)};
}
async function state(db){return (await db.query(`select jsonb_build_object('days',(select jsonb_agg(to_jsonb(d) order by id) from training_days d),'blocks',(select jsonb_agg(to_jsonb(b) order by id) from session_blocks b),'versions',(select jsonb_agg(to_jsonb(v) order by id) from programme_versions v),'completions',(select jsonb_agg(to_jsonb(c)) from workout_item_completions c),'feedback',(select jsonb_agg(to_jsonb(f)) from feedback f)) value`)).rows[0].value;}
test('data preparation runs and rolls back all changes by default',async()=>{
 const {db,sql}=await fixture();try{const before=await state(db);await db.exec(sql);assert.deepEqual(await state(db),before);}finally{await db.close();}
});
test('candidate creates independent routine IDs, preserves originals, and can restore from its snapshot',async()=>{
 const {db,sql}=await fixture();try{
  const before=await state(db);await db.exec(sql.replace(/ROLLBACK;\s*$/,'COMMIT;'));
  const after=await state(db);assert.equal(after.days.length,before.days.length+4);assert.equal(after.versions.length,2);
  assert.deepEqual(after.completions,before.completions);assert.deepEqual(after.feedback,before.feedback);
  for(const old of before.blocks){const current=after.blocks.find(b=>b.id===old.id);const {preparation,...content}=current.content;assert.deepEqual(content,old.content);}
  const routineBlocks=after.blocks.filter(b=>b.content.routineKind);assert.equal(routineBlocks.length,4);
  for(const kind of ['mobility','warm-up']){const pair=routineBlocks.filter(b=>b.content.routineKind===kind);assert.notEqual(pair[0].training_day_id,pair[1].training_day_id);assert.deepEqual(pair[0].content,pair[1].content);}
  for(const v of after.versions){for(const b of v.snapshot.session_blocks)await db.query('update session_blocks set content=$1 where id=$2',[b.content,b.id]);}
  for(const d of after.days.filter(d=>!before.days.some(old=>old.id===d.id))){await db.query('delete from session_blocks where training_day_id=$1',[d.id]);await db.query('delete from training_days where id=$1',[d.id]);}
  const restored=await state(db);assert.deepEqual(restored.days,before.days);assert.deepEqual(restored.blocks,before.blocks);
 }finally{await db.close();}
});
for(const [label,mutation] of [
 ['content drift',"update session_blocks set content=content||'{\"unexpected\":true}'"],
 ['shared programme',`insert into athletes values(gen_random_uuid(),'${targets[0][1]}',9,'active')`],
 ['library drift',"update exercises set video_id='wrong' where code='WU03'"],
 ['unpublished week',"update programme_weeks set published_at=null"],
])test('preparation aborts atomically on '+label,async()=>{const {db,sql}=await fixture();try{await db.exec(mutation);const before=await state(db);await assert.rejects(()=>db.exec(sql));await db.exec('ROLLBACK');assert.deepEqual(await state(db),before);}finally{await db.close();}});

test('preparation refuses duplicated pogo loading without changing any row',async()=>{
 const {db,sql}=await fixture();try{
  await db.exec(`update session_blocks set content=jsonb_set(content,'{prescriptions,0,exerciseCode}','"PLY03"') where block_type='training'`);
  const hash=(await db.query(`select md5(string_agg(b.content::text,'|' order by d.sort_order,b.sort_order)) hash from session_blocks b join training_days d on d.id=b.training_day_id where d.programme_week_id=$1`,[targets[0][2]])).rows[0].hash;
  const before=await state(db);
  await assert.rejects(()=>db.exec(sql.replaceAll(sql.match(/actual_hash<>'([^']+)'/)[1],hash)),/Duplicate pogo volume/);
  await db.exec('ROLLBACK');assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
