import test from 'node:test';
import assert from 'node:assert/strict';
import {validateParentOnboarding} from '../functions/_shared/parent-core.ts';
import {saveParentOnboarding} from '../functions/_shared/parent-service.ts';
import {handleParentRequest} from '../functions/_shared/parent-handler.ts';
const valid={form_version:2,development_priorities:['Speed','Jumping / Explosiveness'],hub_frequency:'1 day',training_locations:['Home'],equipment:['Bodyweight only'],safety_status:'already_discussed'};
test('compact setup validates all five answers without accepting identity or entitlement writes',()=>{
 const row=validateParentOnboarding(valid);assert.equal(row.onboarding_complete,true);assert.equal(row.onboarding_data.hubFrequency,'1 day');assert.equal(row.onboarding_data.safetyStatus,'already_discussed');assert.equal(row.full_name,undefined);
 for(const key of ['parent_user_id','programme_id','access_status','payment_status','parent_email','onboarding_complete'])assert.throws(()=>validateParentOnboarding({...valid,[key]:'spoof'}));
});
test('requires choices, maximum two distinct priorities, valid enums and noncontradictory equipment',()=>{
 for(const patch of [{development_priorities:[]},{development_priorities:['Speed','Strength','Mobility / Resilience']},{development_priorities:['Speed','Speed']},{hub_frequency:'7 days'},{training_locations:[]},{equipment:['Bodyweight only','Weights']},{safety_status:'yes',safety_details:''},{safety_status:'no',safety_details:'private detail'},{equipment:['Unknown']}])assert.throws(()=>validateParentOnboarding({...valid,...patch}));
 assert.equal(validateParentOnboarding({...valid,safety_status:'yes',safety_details:'Knee concern'}).onboarding_data.safetyDetails,'Knee concern');
});
test('draft accepts partial answers without marking complete and rejects malformed present answers',()=>{
 const row=validateParentOnboarding({form_version:2,hub_frequency:'2 days'},true);assert.equal(row.onboarding_complete,false);assert.equal(row.onboarding_data.hubFrequency,'2 days');
 assert.throws(()=>validateParentOnboarding({form_version:2,hub_frequency:'bad'},true));
});
test('legacy completed payload remains accepted for a rolling release',()=>{
 const row=validateParentOnboarding({parent_first_name:'Parent',parent_last_name:'Test',athlete_first_name:'Athlete',athlete_last_name:'Test',age_band:'13',sport_pathway:'Soccer',training_environment:'Home',equipment:['Bands'],weekly_availability:'2 days',considerations:'Prior context'});
 assert.equal(row.onboarding_complete,true);assert.equal(row.onboarding_data.considerations,'Prior context');
});
test('service returns only confirmed persisted state and uses authenticated parent identifier',async()=>{
 let saved; const athlete={id:'a',onboarding_complete:false,access_status:'pending',onboarding_data:{considerations:'Prior concern'}};
 const repository={findParentAthlete:async()=>athlete,updateParentOnboarding:async(id,row)=>{saved={id,row};return {...athlete,onboarding_complete:row.onboarding_complete,onboarding_data:{...athlete.onboarding_data,...row.onboarding_data}};}};
 const profile=await saveParentOnboarding({user:{id:'parent'},input:valid,repository});assert.equal(saved.id,'parent');assert.equal(profile.onboardingComplete,true);assert.equal(profile.onboarding.considerations,'Prior concern');assert.equal(profile.accessState,'PENDING_ACTIVATION');
 repository.updateParentOnboarding=async()=>{throw Error('database unavailable')};await assert.rejects(()=>saveParentOnboarding({user:{id:'parent'},input:valid,repository}),/database unavailable/);
});
test('authenticated draft handler saves incomplete state and returns no programme',async()=>{
 let row; const repository={findParentAthlete:async()=>({id:'a'}),updateParentOnboarding:async(id,fields)=>{row=fields;return {onboarding_complete:false,onboarding_data:fields.onboarding_data}}};
 const response=await handleParentRequest(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com','content-type':'application/json'},body:JSON.stringify({action:'save-onboarding-draft',profile:{form_version:2,hub_frequency:'1 day'}})}),{verifyUser:async()=>({id:'parent'}),repository});
 assert.equal(response.status,200);assert.equal(row.onboarding_complete,false);assert.equal((await response.json()).programme,undefined);
});
