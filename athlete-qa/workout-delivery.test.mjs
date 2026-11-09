import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const delivery=createRequire(import.meta.url)('../hub-delivery/delivery.js');
import {shapeBootstrap} from '../supabase/functions/_shared/hub-core.ts';
import {SupabaseHubRepository} from '../supabase/functions/_shared/supabase-repository.ts';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const ctx={DuHubDelivery:delivery,programme:()=>({week:6}),HUB_STATE:{audience:'private-athlete'},session:()=>({role:'athlete'}),schoolGroup:()=>'',isSchoolReferenceViewer:()=>false,isSharedSchoolViewer:()=>false,isSchoolWarmupSection:s=>/warm[- ]?up/i.test(s.title),hubPhaseRows:()=>'',escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),encodeURIComponent};
vm.createContext(ctx);
ctx.isWorkoutComplete=()=>false;
vm.runInContext(extract('  function simpleText(','  function visibleNormalizedSections(')+extract('  function guidedCard(','  function quickView(')+extract('  function deliverySections(','  function staffAllGroupsExperience(')+extract('  function privateSelfServeViewer(){','  function renderWorkoutExperience(')+';globalThis.api={normalizeWorkoutSession,schoolAthleteDelivery,athleteCopyText,guidedCard};',ctx);
const library=[['SPR01','Wall March'],['SPR02','Wall Switch'],['STR01','Calf Raise'],['CORE01','Hollow Hold'],['CORE02','Dead Bug']].map(([code,name],i)=>({code,name,active:true,video_id:'demo_video'+i,video_url:'https://www.youtube.com/watch?v=demo_video'+i}));
const clientLibrary=library.map(e=>({...e,title:e.name,videoUrl:e.video_url,videoId:e.video_id}));
const normalize=(items,extra={})=>ctx.api.normalizeWorkoutSession({itemSections:[{title:'Strength',order:1,items,...extra}]},clientLibrary);
test('structured running, strength and final instructions keep their approved interleaved order',()=>{
 const input={role:'athlete',cohort:{id:'c'},programme:{id:'p'},week:{week_number:2},trainingDays:[{id:'d'}],blocks:[{training_day_id:'d',title:'Main session',sort_order:1,content:{prescriptions:[{instruction:'4 × 20m at 80%; rest 2 minutes.'},{exerciseCode:'STR01',dosage:'2 × 8/leg'},{instruction:'Walk back and check how you feel.'},{exerciseCode:'CORE02',dosage:'2 × 6/side'},{instruction:'Record any pain after the session.'}]}}],exercises:library};
 const payload=shapeBootstrap(input),w=ctx.api.normalizeWorkoutSession(payload.programme.sessions[0],payload.exercises);
 assert.deepEqual(Array.from(w.sections[0].items,i=>i.code||i.title),['4 × 20m at 80%','STR01','Walk back and check how you feel.','CORE02','Record any pain after the session.']);
});
test('safety and positioning conditions are visible without opening technique tips',()=>{
 const w=ctx.api.normalizeWorkoutSession({prescriptions:[{sectionTitle:'Core',sectionOrder:1,exerciseCode:'CORE02',dosage:'2 × 6/side',cues:'Only if pain-free. Keep legs supported.'}]},clientLibrary);
 const output=ctx.api.schoolAthleteDelivery(w.sections,{});
 assert.match(output,/Only if pain-free/);
 const visible=output.replace(/<details\b[\s\S]*?<\/details>/g,'');
 assert.match(visible,/Only if pain-free/);assert.match(visible,/Keep legs supported/);
});
test('workout sheet explains a dose without changing its prescribed numbers or inventing rest',()=>{
 const w=ctx.api.normalizeWorkoutSession({prescriptions:[{sectionTitle:'Strength',sectionOrder:1,exerciseCode:'STR01',dosage:'2 × 8/leg',rest:''}]},clientLibrary);
 const output=ctx.api.schoolAthleteDelivery(w.sections,{});
 assert.match(output,/2 × 8\/leg/);assert.match(output,/8 repetitions on each leg/);assert.match(output,/2 times/);
 assert.doesNotMatch(output,/Rest: 60|Rest: 90/);
});
test('repository loads canonical demos for text blocks without a duplicate exerciseCodes list',async()=>{
 const tables={cohorts:[{id:'c',programme_id:'p',current_week:6,status:'live'}],programmes:[{id:'p'}],programme_weeks:[{id:'w',programme_id:'p',week_number:6,status:'live',verification_status:'verified',published_at:'2026-10-18',tier_id:null}],training_days:[{id:'d',programme_week_id:'w'}],session_blocks:[{id:'b',training_day_id:'d',content:{items:['Wall March 2 × 10'],video_links:[{item_index:0,exercise:'Wall March'}]}}],exercises:library};
 const db={from(table){let rows=[...(tables[table]||[])];const q={select(){return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},is(k,v){rows=rows.filter(r=>(r[k]??null)===v);return q},not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q},order(){return q},maybeSingle(){return Promise.resolve({data:rows[0]||null,error:null})},then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject)}};return q}};
 const bundle=await new SupabaseHubRepository(db).loadCurrentProgramme('c');
 assert.equal(bundle.exercises.length,1);assert.equal(bundle.exercises[0].code,'SPR01');
});
test('dose, coaching cues and rest remain one movement in display and copied workout',()=>{
 const w=normalize(['Calf Raise — 3 × 12; two feet; lower for 3 seconds; rest 45–60 seconds.']);
 assert.equal(w.sections[0].items.length,1);
 const row=w.sections[0].items[0];
 assert.equal(row.title,'Calf Raise');assert.equal(row.dosage,'3 × 12');assert.match(row.rest,/45–60/);assert.match(row.cue,/lower for 3 seconds/);
 const rendered=ctx.api.schoolAthleteDelivery(w.sections,{});
 assert.equal((rendered.match(/class="hub-athlete-movement"/g)||[]).length,1);
 const copied=ctx.api.athleteCopyText({},w.sections);assert.match(copied,/lower for 3 seconds/);assert.match(copied,/45–60/);
});
test('legacy trailing dosage resolves an exact movement and demo without inventing a dose',()=>{
 const row=normalize(['Wall March 2 × 10/leg']).sections[0].items[0];
 assert.equal(row.code,'SPR01');assert.equal(row.dosage,'2 × 10/leg');assert.equal(row.videoUrl,library[0].video_url);
});
test('school rows with several prescribed movements still split and keep group scope',()=>{
 const rows=normalize(['Form 2 — 2 × 10 Wall March; 2 × 5 Wall Switch; rest 60 seconds']).sections[0].items;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.group==='Form 2'));
 assert.equal(rows[1].code,'SPR02');assert.match(rows[1].rest,/60/);
});
test('reviewed demos stay on their original instruction, including alternatives',()=>{
 const w=normalize(['Hollow Hold 2 × 15 seconds; substitute Dead Bug if position fails','Coach check-in'],{videoLinks:[{itemIndex:0,title:'Dead Bug',url:library[4].video_url},{itemIndex:0,title:'Hollow Hold',url:library[3].video_url}]});
 const rendered=ctx.api.schoolAthleteDelivery(w.sections,{});
 assert.ok(rendered.includes(library[3].video_url));assert.ok(rendered.includes(library[4].video_url));
 assert.equal(w.sections[0].items.length,2);assert.equal(w.sections[0].items[1].videoUrl,'');
 assert.equal(w.sections[0].items[0].videoUrl,library[3].video_url,'Guided view must open the prescribed movement, not its alternative');
});
test('bootstrap carries reviewed text-only demos from current active library, never stored stale URLs',()=>{
 const input={role:'athlete',cohort:{id:'c',current_week:6},programme:{id:'p'},week:{week_number:6},trainingDays:[{id:'d'}],blocks:[{training_day_id:'d',title:'Drills',content:{items:['Wall March 2 × 10/leg'],video_links:[{item_index:0,exercise:'Wall March',video_url:'https://untrusted.invalid/stale'}]}}],exercises:library};
 const p=shapeBootstrap(input);
 assert.equal(p.programme.sessions[0].itemSections[0].videoLinks.length,1);
 assert.equal(p.programme.sessions[0].itemSections[0].videoLinks[0].url,library[0].video_url);
 assert.ok(p.exercises.some(e=>e.code==='SPR01'));
 const inactive=shapeBootstrap({...input,exercises:library.map(e=>({...e,active:false}))});
 assert.equal(inactive.programme.sessions[0].itemSections[0].videoLinks.length,0);
});
test('reviewed non-video URLs never reenter normalized Guided or staff rows',()=>{const w=normalize(['Wall March 2 × 10'],{videoLinks:[{itemIndex:0,title:'Wall March',url:'https://youtube.com/playlist?list=bad'}]});assert.equal(w.sections[0].items[0].videoUrl,'');assert.equal(w.sections[0].items[0].demos.length,0);});
test('Guided running rows retain prescribed pain cues and rest',()=>{const w=normalize(['3 x 80m; stop if pain returns; rest 3 min']);const item=w.sections[0].items[0];const result=ctx.api.guidedCard(item,'Running',0,1,'day');assert.match(result,/stop if pain returns/);assert.match(result,/3 min/);});
test('raw clipboard fallback cannot reintroduce another school groups dose',()=>{ctx.isSharedSchoolViewer=()=>true;ctx.schoolGroup=()=> 'Form 2';const items=['Form 2 — Calf Raise — 2 × 8','Form 3 — Calf Raise — 3 × 12'];const w=normalize(items);const scoped=w.sections.map(s=>({...s,items:s.items.filter(i=>i.group==='Form 2')}));const copied=ctx.api.athleteCopyText({items},scoped);assert.match(copied,/2 × 8/);assert.doesNotMatch(copied,/3 × 12|Form 3/);ctx.isSharedSchoolViewer=()=>false;ctx.schoolGroup=()=>'';});
