// Disposable PostgreSQL only. Never connects to Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
await db.exec(`create table exercises(id text primary key,code text,name text,active boolean,video_url text);
create table session_blocks(id integer generated always as identity primary key,title text,content jsonb);
insert into exercises values ('1','BR','Bridge',true,'https://youtu.be/bridgevid01'),('2','SQ','Squat',true,'https://youtu.be/squatvideo1');`);
await db.exec(read('qa/fixtures/audited-session-triggers.sql'));
const definition=async()=>(await db.query("select pg_get_functiondef('public.sync_session_block_exercise_videos()'::regprocedure) as body")).rows[0].body;
const originalDefinition=await definition();
if(process.env.HUB_QA_VIDEO_BASELINE!=='1')await db.exec(read('rollout/durable-exercise-video-links.sql'));
const save=async content=>(await db.query("insert into session_blocks(title,content) values ('QA movement',$1::jsonb) returning content",[JSON.stringify(content)])).rows[0].content;
const selected=(code='BR')=>({items:['Bridge — 2 x 8'],video_links:[{item_index:0,exercise:'Bridge',exerciseCode:code}]});
try {
 await test('generated legacy demo stores stable exercise code',async()=>assert.equal((await save({items:['Bridge — 2 x 8']})).video_links[0].exerciseCode,'BR'));
 await test('reviewed code survives library rename and refreshes canonical URL',async()=>{
  await db.exec("update exercises set name='Glute Bridge',video_url='https://youtu.be/newbridge01' where code='BR'");
  try {const result=await save(selected());assert.deepEqual(result.video_links,[{item_index:0,exercise:'Glute Bridge',exerciseCode:'BR',video_url:'https://youtu.be/newbridge01',reviewed_item:selected().items[0]}]);}
  finally {await db.exec("update exercises set name='Bridge',video_url='https://youtu.be/bridgevid01' where code='BR'");}
 });
 await test('unknown explicit code cannot fall back to instruction name',async()=>assert.rejects(save(selected('MISSING')),/reviewed demo/i));
 await test('inactive reviewed selection cannot fall back to same-named active demo',async()=>{
  await db.exec("insert into exercises values ('3','OLD','Bridge',false,'https://youtu.be/oldbridge01')");
  try {await assert.rejects(save(selected('OLD')),/reviewed demo/i);}finally {await db.exec("delete from exercises where id='3'");}
 });
 await test('missing demo on reviewed exercise blocks save',async()=>{
  await db.exec("update exercises set video_url='' where code='BR'");
  try {await assert.rejects(save(selected()),/reviewed demo/i);}finally {await db.exec("update exercises set video_url='https://youtu.be/bridgevid01' where code='BR'");}
 });
 await test('mixed-order text rows do not receive positional structured demos',async()=>{
  const result=await save({items:['Rest 60 seconds','Bridge — 2 x 8'],prescriptions:[{exerciseCode:'BR',dosage:'2 x 8'}]});
  assert.deepEqual(result.video_links.map(x=>[x.item_index,x.exerciseCode]),[[1,'BR']]);
 });
 await test('explicit aligned structured rows select codes even after rename',async()=>{
  const result=await save({items:['New movement name — 2 x 8'],prescriptions:[{exerciseCode:'BR',dosage:'2 x 8'}],videoLinksAlignWithPrescriptions:true});
  assert.equal(result.video_links[0].exerciseCode,'BR');
 });
 await test('invalid aligned structured code cannot fall back to text',async()=>assert.rejects(save({items:['Bridge — 2 x 8'],prescriptions:[{exerciseCode:'MISSING',dosage:'2 x 8'}],videoLinksAlignWithPrescriptions:true}),/reviewed demo/i));
 await test('ambiguous same-name legacy demo is not auto-selected',async()=>{
  await db.exec("insert into exercises values ('3','DUP','Bridge',true,'https://youtu.be/otherbridge')");
  try {assert.deepEqual((await save({items:['Bridge — 2 x 8']})).video_links,[]);assert.equal((await save(selected())).video_links[0].exerciseCode,'BR');}
  finally {await db.exec("delete from exercises where id='3'");}
 });
 await test('reviewed mapping with invalid instruction index rejects',async()=>assert.rejects(save({items:['Bridge'],video_links:[{item_index:9,exerciseCode:'BR'}]}),/reviewed demo/i));
 await test('all prescribed text and unrelated metadata remain exact',async()=>{
  const before={...selected(),prescriptions:[{exerciseCode:'BR',dosage:'2 × 8',rest:'65 sec',cue:'Slow down'}],instruction:'Keep literal text',notes:{coach:'Reviewed'}};
  const after=await save(before);delete before.video_links;delete after.video_links;assert.deepEqual(after,before);
 });
 await test('compound legacy row retains distinct movements',async()=>{
  const links=(await save({items:['Bridge — 2 x 8; Squat — 2 x 6']})).video_links;
  assert.deepEqual(links.map(x=>x.exerciseCode).sort(),['BR','SQ']);
 });
 await test('resaving an existing block retains its reviewed code after rename',async()=>{
  const row=(await db.query("insert into session_blocks(title,content) values ('QA movement',$1::jsonb) returning id,content",[JSON.stringify(selected())])).rows[0];
  await db.exec("update exercises set name='Renamed Bridge',video_url='https://youtu.be/refreshed01' where code='BR'");
  try {
   const after=(await db.query('update session_blocks set content=content where id=$1 returning content',[row.id])).rows[0].content;
   assert.equal(after.video_links[0].exerciseCode,'BR');assert.equal(after.video_links[0].exercise,'Renamed Bridge');
   assert.equal(after.video_links[0].video_url,'https://youtu.be/refreshed01');assert.deepEqual(after.items,row.content.items);
  } finally {await db.exec("update exercises set name='Bridge',video_url='https://youtu.be/bridgevid01' where code='BR'");}
 });
 await test('aligned conflicting reviewed code rejects rather than selecting both demos',async()=>assert.rejects(save({...selected('SQ'),prescriptions:[{exerciseCode:'BR',dosage:'2 x 8'}],videoLinksAlignWithPrescriptions:true}),/aligned prescription/i));
 await test('changed instruction cannot silently retain a previously saved demo',async()=>{
  const row=(await db.query("insert into session_blocks(title,content) values ('QA movement',$1::jsonb) returning id,content",[JSON.stringify(selected())])).rows[0];
  for(const items of [['Squat — 2 x 8'],['Bridge — 2 x 8; Squat — 2 x 6']]) {
   await assert.rejects(db.query('update session_blocks set content=$1::jsonb where id=$2',[JSON.stringify({...row.content,items}),row.id]),/instruction.*review|review.*instruction/i);
   assert.deepEqual((await db.query('select content from session_blocks where id=$1',[row.id])).rows[0].content,row.content);
  }
  const edited={...row.content,items:['Squat — 2 x 8'],video_links:[]};
  const result=(await db.query('update session_blocks set content=$1::jsonb where id=$2 returning content',[JSON.stringify(edited),row.id])).rows[0].content;
  assert.equal(result.video_links[0].exerciseCode,'SQ');
 });
 await test('alias cannot choose between duplicate normalized canonical names',async()=>{
  await db.exec("insert into exercises values ('3','SLB','Single-Leg Glute Bridge',true,'https://youtu.be/singleleg01'),('4','DUP','Single Leg Glute Bridge',true,'https://youtu.be/duplicate01')");
  try {assert.deepEqual((await save({items:['Single leg bridge — 2 x 8']})).video_links,[]);}
  finally {await db.exec("delete from exercises where id in ('3','4')");}
 });
 await test('reviewed link cannot reference a nonexistent items array',async()=>assert.rejects(save({instruction:'Rest today',video_links:[{item_index:0,exerciseCode:'MISSING'}]}),/reviewed demo/i));
 await test('renewed same-code review permits a dose edit without changing the movement',async()=>{
  const row=(await db.query("insert into session_blocks(title,content) values ('QA movement',$1::jsonb) returning id,content",[JSON.stringify(selected())])).rows[0];
  const item='Bridge — 3 x 8',next={...row.content,items:[item],video_links:[{...row.content.video_links[0],reviewed_item:item}]};
  const result=(await db.query('update session_blocks set content=$1::jsonb where id=$2 returning content',[JSON.stringify(next),row.id])).rows[0].content;
  assert.equal(result.video_links[0].exerciseCode,'BR');assert.equal(result.video_links[0].reviewed_item,item);
 });
 await test('stale text binding cannot approve a different instruction',async()=>assert.rejects(save({...selected(),video_links:[{item_index:0,exerciseCode:'BR',reviewed_item:'A different line'}]}),/reviewed demo.*instruction/i));
 await test('explicit no-demo review is durable even when a note mentions a known movement',async()=>{
  const item='Rest after Bridge — no demonstration needed',link={item_index:0,no_demo:true,reviewed_item:item};
  const after=await save({items:[item],video_links:[link]});assert.deepEqual(after.video_links,[link]);
 });
 await test('no-demo marker cannot suppress a different instruction',async()=>assert.rejects(save({items:['Rest'],video_links:[{item_index:0,no_demo:true,reviewed_item:'Other note'}]}),/reviewed demo/i));
 await test('restoring captured definition leaves every saved block untouched',async()=>{
  const snapshot=(await db.query('select * from session_blocks order by id')).rows;
  await db.exec(originalDefinition);assert.equal(await definition(),originalDefinition);
  assert.deepEqual((await db.query('select * from session_blocks order by id')).rows,snapshot);
 });
} finally {await db.close();}
