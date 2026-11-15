import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {shapeBootstrap} from '../supabase/functions/_shared/hub-core.ts';
const rows=JSON.parse(fs.readFileSync(process.env.DU_COACHING_CONTENT||new URL('../supabase/rollout/exercise-coaching-standard/content.json',import.meta.url)));
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const delivery=createRequire(import.meta.url)('../hub-delivery/delivery.js');
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={DuHubDelivery:delivery,programme:()=>({week:1}),HUB_STATE:{audience:'parent'},session:()=>({role:'athlete'}),schoolGroup:()=>'',isSchoolReferenceViewer:()=>false,isSharedSchoolViewer:()=>false,isSchoolWarmupSection:s=>/warm[- ]?up/i.test(s.title),hubPhaseRows:()=>'',escapeHtml,encodeURIComponent,isWorkoutComplete:()=>false};
vm.createContext(ctx);
vm.runInContext(extract('  function simpleText(','  function visibleNormalizedSections(')+extract('  function guidedCard(','  function quickView(')+extract('  function deliverySections(','  function staffAllGroupsExperience(')+extract('  function privateSelfServeViewer(){','  function renderWorkoutExperience(')+extract('  function exerciseCard(','  function airZimTool(')+';this.api={coachingParts,normalizeWorkoutSession,guidedCard,schoolAthleteDelivery,athleteCopyText,exerciseCard};',ctx);
test('all 85 entries have coaching guidance or a review warning, purpose, parsed cues and donts',()=>{
 assert.equal(rows.length,85);
 for(const row of rows){
  assert.ok(row.description?.trim(),row.code+': technique missing');assert.ok(row.purpose?.trim(),row.code+': purpose missing');
  const parts=ctx.api.coachingParts(row.coaching_cues);assert.ok(parts.cue,row.code+': cues missing');assert.ok(parts.avoid,row.code+': donts missing');
  assert.doesNotMatch(row.coaching_cues,/land firm|lock (?:your )?(?:knees|ankles)|push through pain/i);
 }
});
test('library, guided parent card, coach movement sheet and copy preserve coaching for every exercise',()=>{
 for(const row of rows){
  const dose=/Hold|ISO/.test(row.name)?'2 × 15 seconds':'2 × 5';
  const payload=shapeBootstrap({role:'athlete',cohort:{id:'test'},programme:{id:'test'},week:{week_number:1},trainingDays:[{id:'test-day'}],blocks:[{training_day_id:'test-day',title:'Test',sort_order:1,content:{prescriptions:[{exerciseCode:row.code,dosage:dose}]}}],exercises:[row]});
  const ex={...payload.exercises[0],coachingNote:payload.exercises[0].coachingCues};
  const item=ctx.api.normalizeWorkoutSession(payload.programme.sessions[0],[ex]).sections[0].items[0];
  assert.equal(item.description,row.description,row.code);assert.ok(item.avoid,row.code+': avoid lost');assert.equal(item.dosage,dose,row.code+': dose changed');
  const card=ctx.api.guidedCard(item,'Test',0,1,'test-day');assert.ok(card.includes(escapeHtml(item.avoid)),row.code+': guided avoid missing');
  const lib=ctx.api.exerciseCard(ex);assert.ok(lib.includes(escapeHtml(item.avoid)),row.code+': library avoid missing');
  const copy=ctx.api.athleteCopyText({},[{title:'Test',items:[item]}]);assert.ok(copy.includes(item.avoid),row.code+': copy avoid missing');
  const sheet=ctx.api.schoolAthleteDelivery([{title:'Test',items:[item]}],{id:'test-day'});assert.ok(sheet.includes(escapeHtml(item.avoid)),row.code+': school sheet avoid missing');
  if(row.video_url)assert.equal(item.videoUrl,row.video_url,row.code+': video changed');
 }
});
test('unverified series retain visible confirmation instructions and original review notes',()=>{
 const codes=['ACT09','ACT10','ACT11','ACT12','CORE12','MOB10','MOB11'];
 for(const code of codes){
  const row=rows.find(e=>e.code===code);assert.match(row.description,/Ask Coach Du to confirm the movement sequence/);assert.match(row.admin_notes,/movement order has not been verified/);
  assert.doesNotMatch(row.description,/\b(?:first do|then perform|step 1)\b/i);
 }
});
test('a custom workout cue keeps its exact wording without hiding the library donts',()=>{
 const ex={code:'STR01',title:'Split Squat',description:'Library technique.',coachingNote:'Cue: Whole foot grounded. Avoid: Letting the knee collapse inward.'};
 const rx={exerciseCode:'STR01',dosage:'2 × 8/leg',rest:'90 seconds',cues:'[Strength] Use light support.'};
 const row=ctx.api.normalizeWorkoutSession({prescriptions:[rx]},[ex]).sections[0].items[0];
 assert.equal(row.cue,'Use light support.');assert.equal(row.phase,'Strength');assert.equal(row.dosage,rx.dosage);assert.equal(row.rest,rx.rest);
 assert.equal(row.avoid,'Letting the knee collapse inward.');
 const specific=ctx.api.normalizeWorkoutSession({prescriptions:[{...rx,cues:'Cue: Shorter range today. Avoid: Added weight.'}]},[ex]).sections[0].items[0];
 assert.equal(specific.cue,'Shorter range today.');assert.equal(specific.avoid,'Added weight.');
});
test('empty, phase-only and Avoid-only workout notes fall back independently',()=>{
 const ex={code:'STR01',title:'Split Squat',coachingNote:'Cue: Whole foot grounded. Avoid: Knee collapse.'};
 const cases=[['', 'Whole foot grounded.','Knee collapse.'],['   ','Whole foot grounded.','Knee collapse.'],['[Strength]   ','Whole foot grounded.','Knee collapse.'],['Avoid: Added weight.','Whole foot grounded.','Added weight.'],['Cue: Short range.\nAvoid: Added weight.','Short range.','Added weight.']];
 for(const [cues,cue,avoid] of cases){
  const row=ctx.api.normalizeWorkoutSession({prescriptions:[{exerciseCode:'STR01',cues,dosage:'2 × 8',rest:'60 seconds'}]},[ex]).sections[0].items[0];
  assert.equal(row.cue,cue,cues);assert.equal(row.avoid,avoid,cues);
 }
});
