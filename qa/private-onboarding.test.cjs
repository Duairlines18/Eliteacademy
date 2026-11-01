const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function submit(audience,entries){
  const start=html.indexOf('const fd=new FormData(form),profile={};',html.indexOf("if(event.target.id==='hubAccountOnboardingForm')"));
  const end=html.indexOf('await authEdgePost(HUB_CONFIG.accountFunctions[audience]',start);
  const helpers=html.slice(html.indexOf('  function normalizeOnboardingList('),html.indexOf('  function renderAccountOnboarding('));
  return JSON.parse(JSON.stringify(vm.runInNewContext(helpers+'\n'+html.slice(start,end)+'\nprofile;',{
    FormData:class{entries(){return entries;}},form:{},audience
  })));
}
const answers=[['first_name','Test'],['last_name','Athlete'],['sport_pathway','Triple jump'],
  ['private_development_goals','Speed / acceleration'],['private_development_goals','Jumping / power'],
  ['private_training_environment','Track / field'],['private_training_environment','Gym'],
  ['private_equipment','Bodyweight only'],['private_equipment','Medicine ball'],
  ['weekly_availability','3 days'],['private_weekly_schedule','Track twice'],
  ['private_current_considerations','None'],['private_injury_history','None'],
  ['training_experience',''],['private_additional_notes','']];
test('private checkbox goals reach the API as arrays without throwing',()=>{
  const result=submit('private-athlete',answers);
  assert.deepEqual(result.primary_goals,['Speed / acceleration','Jumping / power']);
  assert.deepEqual(result.equipment,['Bodyweight only','Medicine ball']);
  assert.equal(result.training_environment,'Track / field, Gym');
  assert.equal(result.training_experience,'');
  assert.equal(result.schedule_notes,'Current weekly training schedule: Track twice\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None');
  assert.equal(Object.keys(result).some(key=>key.startsWith('private_')),false);
  for(const key of ['access_status','programme_id','paid','payment_status'])assert.equal(key in result,false);
});
test('professional text fields still normalize to arrays, including empty optional fields',()=>{
  assert.deepEqual(submit('professional',[['primary_goals',' Strength, mobility, '],['equipment','Bands, Dumbbells']]),{primary_goals:['Strength','mobility'],equipment:['Bands','Dumbbells']});
  assert.deepEqual(submit('professional',[['primary_goals',''],['equipment','']]),{primary_goals:[],equipment:[]});
});
test('parent multi-select payload retains its existing API contract',()=>{
  const result=submit('parent',[['development_goals','Speed'],['development_goals','Jumping'],['training_environment','Home'],['training_environment','Gym'],['equipment','Bodyweight only'],['considerations','']]);
  assert.deepEqual(result.equipment,['Bodyweight only']);
  assert.equal(result.training_environment,'Home, Gym');
  assert.equal(result.considerations,'Development goals: Speed, Jumping');
});
test('saved list values tolerate text, arrays, empty and malformed optional values',()=>{
  const helpers=html.slice(html.indexOf('  function normalizeOnboardingList('),html.indexOf('  function renderAccountOnboarding('));
  for(const [value,want] of [[' Speed, Jumping, ',['Speed','Jumping']],[[' Speed ',null,42,'Jumping'],['Speed','Jumping']],[null,[]],[{},[]],['',[]]]){
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(helpers+'\nnormalizeOnboardingList(value)',{value}))),want);
  }
});
test('an empty or partial private setup is reopened even when its completion flag is true',()=>{
  const helpers=html.slice(html.indexOf('  function normalizeOnboardingList('),html.indexOf('  function renderAccountOnboarding('));
  const complete={onboardingComplete:true,onboarding:{sportPathway:'Triple jump',primaryGoals:['Jumping / power'],trainingEnvironment:'Track / field',equipment:['Bodyweight only'],weeklyAvailability:'3 days',scheduleNotes:'Current weekly training schedule: Track\nCurrent pain / injury / restriction: None\nPrevious significant injuries: None'}};
  for(const [profile,want] of [[{onboardingComplete:true,onboarding:{}},true],[{...complete,onboarding:{...complete.onboarding,equipment:[]}},true],[complete,false]]){
    assert.equal(vm.runInNewContext(helpers+'\naccountNeedsOnboarding("private-athlete",profile)',{profile}),want);
  }
  assert.equal(vm.runInNewContext(helpers+'\naccountNeedsOnboarding("parent",{onboardingComplete:true})'),false);
});
test('frontend answers pass the real server validator and preserve account entitlement on save',async()=>{
  const {savePrivateAthleteOnboarding}=await import('../supabase/functions/_shared/private-athlete-service.ts');
  let row={athlete_user_id:'owner',access_status:'active',access_reason:'complimentary',payment_status:'not_required',programme_id:'assigned',current_week:1,paid:false};
  const result=await savePrivateAthleteOnboarding({user:{id:'owner'},input:submit('private-athlete',answers),repository:{
    findPrivateAthlete:async id=>{assert.equal(id,'owner');return row;},
    updatePrivateAthleteOnboarding:async(id,fields)=>{assert.equal(id,'owner');row={...row,...fields};return row;}
  }});
  assert.equal(result.accessState,'ACTIVE');
  assert.deepEqual(result.onboarding.primaryGoals,['Speed / acceleration','Jumping / power']);
  assert.equal(row.access_status,'active');assert.equal(row.programme_id,'assigned');assert.equal(row.current_week,1);assert.equal(row.payment_status,'not_required');assert.equal(row.paid,false);
});
test('server rejects attempts to overwrite another athlete or activation through onboarding',async()=>{
  const {validatePrivateAthleteOnboarding}=await import('../supabase/functions/_shared/private-athlete-core.ts');
  for(const extra of [{athlete_id:'another-athlete'},{programme_id:'another-programme'},{access_status:'active'}]){
    assert.throws(()=>validatePrivateAthleteOnboarding({...submit('private-athlete',answers),...extra}),/Invalid private athlete onboarding/);
  }
});
test('overlong combined notes are rejected before the server could truncate required answers',()=>{
  const longAnswers=answers.map(([key,value])=>[key,key==='private_weekly_schedule'?'A'.repeat(1000):value]);
  assert.throws(()=>submit('private-athlete',longAnswers),/1,000 characters/);
});
