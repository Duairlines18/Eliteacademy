import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeAccessCode,bootstrapHub,authorizeSchoolSession,logoutSchoolSession} from '../functions/_shared/hub-service.ts';
const now=new Date('2026-10-24T12:00:00Z');
const cryptoPort={sha256:async x=>'hash:'+x,randomToken:()=> 'synthetic-session-token-at-least-32'};
const cohort={id:'school',organization_id:'org',programme_id:'programme',status:'live',name:'School',current_week:1};
function fixture(n=1,role='athlete'){
 const athlete={id:'athlete-'+n,display_name:'St. George’s Athlete 0'+n,athlete_type:'school',organization_id:'org',cohort_id:'school',programme_id:'programme',access_status:'active',form_tier:null,onboarding_data:{testing_placeholder:true}};
 const staff={id:'coach',display_name:'Coach Dube',access_status:'active'};
 const code={id:'code-'+n,code_type:role==='athlete'?'cohort':'staff',athlete_id:role==='athlete'?athlete.id:null,staff_id:role==='staff'?staff.id:null,cohort_id:'school',status:'active'};
 const session={id:'session-'+n,role,athlete_id:code.athlete_id,staff_id:code.staff_id,cohort_id:'school',access_code_id:code.id,expires_at:'2026-10-25T12:00:00Z'};
 const writes=[];
 const repository={findAccessCode:async()=>code,findAccessCodeById:async()=>code,findCohort:async()=>cohort,findSession:async()=>session,findSchoolAthlete:async()=>athlete,findSchoolStaff:async()=>staff,isStaffAssigned:async()=>true,createSession:async row=>writes.push(row),touchCode:async()=>{},touchSession:async()=>{},revokeSession:async(id,at)=>{session.revoked_at=at;},loadCurrentProgramme:async()=>({cohort,programme:{id:'programme',name:'Test',duration_weeks:4},week:null,trainingDays:[],blocks:[],exercises:[]})};
 return {athlete,staff,code,session,repository,writes};
}
test('six code exchanges and bootstraps retain six different athlete identities',async()=>{
 const seen=new Set();
 for(let n=1;n<=6;n++){const f=fixture(n);await exchangeAccessCode({code:'synthetic-athlete-code',view:'athlete',repository:f.repository,cryptoPort,now});assert.equal(f.writes[0].athlete_id,f.athlete.id);const b=await bootstrapHub({token:'synthetic-session-token',repository:f.repository,cryptoPort,now});assert.equal(b.athlete.displayName,f.athlete.display_name);assert.equal(b.accessMode,'identified-school');assert.equal(b.athlete.formTier,null);seen.add(b.athlete.id);}
 assert.equal(seen.size,6);
});
test('changed identity, school, organization, assignment or paused athlete invalidates session',async()=>{
 for(const mutate of [f=>f.session.athlete_id='another',f=>f.athlete.cohort_id='other',f=>f.athlete.organization_id='other',f=>f.athlete.programme_id='other',f=>f.athlete.access_status='paused',f=>f.athlete.athlete_type='private',f=>f.code.staff_id='unexpected']){
  const f=fixture();mutate(f);await assert.rejects(authorizeSchoolSession({token:'synthetic-session-token',repository:f.repository,cryptoPort,now}));
 }
});
test('named staff requires active profile, matching session and cohort membership',async()=>{
 const f=fixture(1,'staff');await exchangeAccessCode({code:'synthetic-staff-code',view:'staff',repository:f.repository,cryptoPort,now});assert.equal(f.writes[0].staff_id,'coach');
 for(const mutate of [g=>g.staff.access_status='paused',g=>g.session.staff_id='other',g=>g.repository.isStaffAssigned=async()=>false]){const g=fixture(1,'staff');mutate(g);await assert.rejects(authorizeSchoolSession({token:'synthetic-session-token',repository:g.repository,cryptoPort,now}));}
});
test('logout revokes server session and makes reuse fail',async()=>{
 const f=fixture();await logoutSchoolSession({token:'synthetic-session-token',repository:f.repository,cryptoPort,now});assert.equal(f.session.revoked_at,now.toISOString());await assert.rejects(authorizeSchoolSession({token:'synthetic-session-token',repository:f.repository,cryptoPort,now}));
});
test('invalid expiry fails closed on codes and sessions',async()=>{
 for(const target of ['code','session']){const f=fixture();f[target].expires_at='broken';await assert.rejects(authorizeSchoolSession({token:'synthetic-session-token',repository:f.repository,cryptoPort,now}));}
});
test('named staff roster contains only minimal active athletes from their cohort',async()=>{
 const f=fixture(1,'staff');f.repository.listSchoolRoster=async()=>[{id:'own',display_name:'St. George’s Athlete 01',cohort_id:'school',access_status:'active',admin_notes:'private'},{id:'other',cohort_id:'other',access_status:'active'}];
 const data=await bootstrapHub({token:'synthetic-session-token',repository:f.repository,cryptoPort,now});
 assert.deepEqual(data.roster,[{id:'own',display_name:'St. George’s Athlete 01',cohort_id:'school',access_status:'active'}]);
 const a=fixture();const own=await bootstrapHub({token:'synthetic-session-token',repository:a.repository,cryptoPort,now});assert.equal(own.roster,null);
});
test('sports director receives a read-only overview and cannot submit coaching feedback',async()=>{
 const f=fixture(1,'staff');f.staff.access_profile='sports_director';f.repository.listSchoolRoster=async()=>[];f.repository.schoolCompletionSummary=async()=>[];
 const data=await bootstrapHub({token:'synthetic-session-token',repository:f.repository,cryptoPort,now});assert.equal(data.staff.accessProfile,'sports_director');assert.ok(Array.isArray(data.completionSummary));
 const {saveSharedHubFeedback}=await import('../functions/_shared/hub-service.ts');await assert.rejects(saveSharedHubFeedback({token:'synthetic-session-token',repository:f.repository,cryptoPort,now,input:{}}),/read.only/i);
});
