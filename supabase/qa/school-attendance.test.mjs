import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../functions/_shared/school-attendance.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const now=new Date('2026-10-24T18:00:00Z');
function fixture(role='staff',profile='coach'){
 const cohort={id:'school',organization_id:'org',programme_id:'programme',current_week:2,status:'live'};
 const staff={id:'coach',access_status:'active',access_profile:profile};
 const athlete={id:'a1',athlete_type:'school',access_status:'active',cohort_id:'school',organization_id:'org'};
 const code={id:'code',code_type:role==='staff'?'staff':'cohort',cohort_id:'school',staff_id:role==='staff'?'coach':null,athlete_id:role==='athlete'?'a1':null,status:'active'};
 const session={id:'session',cohort_id:'school',access_code_id:'code',role,staff_id:code.staff_id,athlete_id:code.athlete_id,expires_at:'2026-11-01T00:00:00Z'};
 const rows=new Map(),writes=[];
 const repo={findSession:async()=>session,findAccessCodeById:async()=>code,findCohort:async()=>cohort,findSchoolStaff:async()=>staff,findSchoolAthlete:async()=>athlete,isStaffAssigned:async()=>true,
 attendanceProgramme:async()=>({id:'programme',duration_weeks:4}),listSchoolRoster:async()=>[{id:'a1',display_name:'Athlete 01',cohort_id:'school',access_status:'active'},{id:'a2',display_name:'Athlete 02',cohort_id:'school',access_status:'active'}],
 readSchoolAttendance:async(c,p,w)=>[...rows.values()].filter(r=>r.week_number===w),saveSchoolAttendance:async rs=>{writes.push(rs);for(const r of rs)rows.set([r.week_number,r.athlete_id,r.session_number].join('|'),r);}};
 return {args:{token:'long-enough-session-token',repository:repo,cryptoPort:{sha256:async x=>x},now,weekNumber:1},rows,writes,code,session,staff,cohort,repo};
}
const entry={athleteId:'a1',sessionNumber:1,status:'present',sessionDate:'2026-10-19'};
test('attendance service is available',()=>assert.equal(typeof mod.saveSchoolAttendance,'function'));
test('one daily record is reconciled weekly without duplication or changing active week',async()=>{
 const f=fixture();await mod.saveSchoolAttendance({...f.args,entries:[entry]});await mod.saveSchoolAttendance({...f.args,entries:[{...entry,status:'excused'},{athleteId:'a2',sessionNumber:2,status:'present',sessionDate:'2026-10-21'}]});
 assert.equal(f.rows.size,2);assert.equal(f.rows.get('1|a1|1').status,'excused');assert.equal(f.cohort.current_week,2);assert.equal(f.writes[0][0].recorded_by_staff_id,'coach');assert.equal(f.writes[0][0].programme_id,'programme');
});
test('director can read minimal attendance but cannot write',async()=>{
 const f=fixture('staff','sports_director');const read=await mod.readSchoolAttendance(f.args);assert.equal(read.writable,false);assert.equal(read.weekNumber,1);await assert.rejects(mod.saveSchoolAttendance({...f.args,entries:[entry]}),e=>e.status===403);assert.equal(f.writes.length,0);
});
test('athletes, shared staff and unassigned staff cannot access register',async()=>{
 for(const setup of [()=>fixture('athlete'),()=>{const f=fixture();f.code.staff_id=null;f.session.staff_id=null;return f;},()=>{const f=fixture();f.repo.isStaffAssigned=async()=>false;return f;}]){
  const f=setup();await assert.rejects(mod.readSchoolAttendance(f.args));await assert.rejects(mod.saveSchoolAttendance({...f.args,entries:[entry]}));assert.equal(f.writes.length,0);
 }
});
test('cross-school athlete or forged scope is rejected before any batch mutation',async()=>{
 for(const bad of [{...entry,athleteId:'unrelated'},{...entry,cohort_id:'other'},{...entry,programmeId:'other'}]){const f=fixture();await assert.rejects(mod.saveSchoolAttendance({...f.args,entries:[entry,bad]}));assert.equal(f.writes.length,0);}
});
test('invalid week, optional day, future/invalid dates and duplicate keys reject entire batch',async()=>{
 for(const args of [{weekNumber:0},{weekNumber:5},{weekNumber:1.5},{entries:[{...entry,sessionNumber:3}]},{entries:[{...entry,status:'maybe'}]},{entries:[{...entry,sessionDate:'2026-02-30'}]},{entries:[{...entry,sessionDate:'2027-01-01'}]},{entries:[{...entry,sessionDate:null}]},{entries:[entry,entry]}]){const f=fixture();await assert.rejects(mod.saveSchoolAttendance({...f.args,entries:[entry],...args}));assert.equal(f.writes.length,0);}
});
test('unrecorded remains distinct from absence and clearing one slot preserves others',async()=>{
 const f=fixture();await mod.saveSchoolAttendance({...f.args,entries:[entry,{...entry,athleteId:'a2'}]});await mod.saveSchoolAttendance({...f.args,entries:[{...entry,status:'unrecorded',sessionDate:null}]});
 assert.equal(f.rows.get('1|a1|1').status,'unrecorded');assert.equal(f.rows.get('1|a2|1').status,'present');
 const read=await mod.readSchoolAttendance(f.args);assert.equal(read.entries.length,2);assert.equal(read.writable,true);assert.deepEqual(Object.keys(read.roster[0]).sort(),['id','name']);
});
