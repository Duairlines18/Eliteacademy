// Run against a private JSON export: {athletes,weeks,days,blocks,exercises}.
// Keep athlete exports outside this public repository.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const delivery=createRequire(import.meta.url)('../hub-delivery/delivery.js');
import assert from 'node:assert/strict';
import {applyAccountAdjustments} from '../supabase/functions/_shared/account-adjustments.ts';
import {shapeBootstrap,prepareBundleForDelivery} from '../supabase/functions/_shared/hub-core.ts';
const filename=process.argv[2];
if(!filename)throw new Error('Usage: node qa/check-workout-delivery.mjs /private/path/export.json');
const data=JSON.parse(fs.readFileSync(filename,'utf8'));
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const part=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return html.slice(start,end)};
const ctx={URL,DuHubDelivery:delivery,programme:()=>({week:0}),HUB_STATE:{audience:'private-athlete'},session:()=>({role:'athlete'}),schoolGroup:()=>'',isSchoolReferenceViewer:()=>false,isSharedSchoolViewer:()=>false,isSchoolWarmupSection:s=>/warm[- ]?up/i.test(s.title),hubPhaseRows:()=>'',escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),encodeURIComponent};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('./workout-validation.js',import.meta.url),'utf8'),ctx);
vm.runInContext(part('  function simpleText(','  function visibleNormalizedSections(')+part('  function deliverySections(','  function staffAllGroupsExperience(')+part('  function privateSelfServeViewer(){','  function renderWorkoutExperience(')+';globalThis.api={normalizeWorkoutSession,schoolAthleteDelivery,athleteCopyText};',ctx);
let checkedLinks=0,checkedPrescriptions=0,checkedBlocks=0;
for(const week of data.weeks){
 const athlete=data.athletes.find(a=>a.programme_id===week.programme_id);
 assert.ok(athlete,'Export must include assignment for every checked week');
 const days=data.days.filter(d=>d.programme_week_id===week.id);
 const blocks=data.blocks.filter(b=>days.some(d=>d.id===b.training_day_id));
 assert.ok(days.length>0&&days.length<=7);
 for(const day of days)assert.ok(blocks.some(b=>b.training_day_id===day.id),'Day without content: '+day.id);
 assert.equal(ctx.workoutDeliveryIssues(blocks,data.exercises).join('\n'),'');
 const bundle={role:'athlete',cohort:{id:athlete.id,name:athlete.name,current_week:athlete.current_week},programme:{id:week.programme_id},week,trainingDays:days,blocks,exercises:data.exercises};
 const payload=shapeBootstrap(applyAccountAdjustments(bundle,{}));
 const library=payload.exercises.map(e=>({...e,coachingNote:e.coachingCues,dosage:e.defaultDosage}));
 for(const session of payload.programme.sessions){
  const workout=ctx.api.normalizeWorkoutSession(session,library);
  const sheet=ctx.api.schoolAthleteDelivery(workout.sections,session);
  const copied=ctx.api.athleteCopyText(session,workout.sections);
  assert.ok(sheet&&copied);
  for(const block of blocks.filter(b=>b.training_day_id===session.id)){
   checkedBlocks++;
   const section=workout.sections.find(s=>s.title===block.title.trim()&&s.order===(block.sort_order||0));
   assert.ok(section,'Missing rendered block: '+block.title);
   for(const rx of block.content.prescriptions||[]){
    if(!rx.exerciseCode&&rx.instruction){assert.ok(section.items.some(i=>[i.title,i.dosage,i.rest,i.cue].join(' ').includes(rx.instruction)||copied.includes(rx.instruction)),'Missing running instruction');continue;}
    const item=section.items.find(i=>i.key.startsWith('p:')&&i.code===rx.exerciseCode&&i.dosage===rx.dosage);
    assert.ok(item,'Missing prescription/dose: '+rx.exerciseCode);
    assert.equal(item.rest,rx.rest||'');
    const prescribedExercise=data.exercises.find(e=>e.code===rx.exerciseCode);
    if(prescribedExercise?.active!==false && prescribedExercise?.video_url){
      const expected=prescribedExercise.video_url;
      assert.ok(item.videoUrl===expected||(item.demos||[]).some(d=>d.url===expected),
        'Prescribed exercise demo not rendered: '+rx.exerciseCode+' in '+block.title);
      assert.ok(sheet.includes(ctx.escapeHtml(expected)),
        'Prescribed exercise demo absent from athlete HTML: '+rx.exerciseCode);
      assert.ok(copied.includes(expected),
        'Prescribed exercise demo absent from Copy Workout: '+rx.exerciseCode);
    }
    checkedPrescriptions++;
   }
   for(const link of block.content.video_links||[]){
    const exercise=data.exercises.find(e=>e.active!==false&&e.name===link.exercise);
    assert.ok(exercise,'Unavailable mapped exercise');
    const url=exercise.video_url||'https://www.youtube.com/watch?v='+exercise.video_id;
    const rows=section.items.filter(i=>(i.rawIndex===link.item_index&&i.key.startsWith('i:'))||(i.code===exercise.code&&i.key.startsWith('p:')));
    assert.ok(rows.some(i=>i.videoUrl===url||(i.demos||[]).some(d=>d.url===url)),'Missing rendered demo: '+link.exercise);
    assert.ok(sheet.includes(ctx.escapeHtml(url)),'Demo absent from athlete HTML');checkedLinks++;
   }
   for(const [index,raw] of (block.content.items||[]).entries()){
    const rows=section.items.filter(i=>i.rawIndex===index&&i.key.startsWith('i:'));
    for(const segment of raw.split(';').slice(1).map(s=>s.trim()).filter(Boolean)){
     assert.ok(copied.includes(raw)||rows.some(i=>[i.title,i.dosage,i.rest,i.cue].join(' ').includes(segment)||/^(rest|recovery)\b/i.test(segment)&&i.rest.includes(segment.replace(/^(rest|recovery)\s*[:—-]?\s*/i,''))),'Dropped cue/rest: '+block.title+' | '+raw+' | '+segment);
    }
   }
  }
 }
 const status=shapeBootstrap(prepareBundleForDelivery(bundle)).contentStatus;
 assert.equal(status,['live','completed'].includes(week.status)&&week.verification_status==='verified'&&week.published_at?'published':'preparing');
 if(week.week_number===athlete.current_week)assert.equal(status,'published','Assigned current week must be published');
 console.log('PASS: '+athlete.name+' week '+week.week_number+' ('+week.status+') — '+days.length+' days, '+blocks.length+' blocks');
}
console.log('PASS: '+checkedBlocks+' blocks, '+checkedLinks+' reviewed demos, '+checkedPrescriptions+' structured prescriptions. Render/copy/dose/rest/publication checks passed.');
