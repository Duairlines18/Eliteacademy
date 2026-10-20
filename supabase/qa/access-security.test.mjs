import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeAccessCode,bootstrapHub} from '../functions/_shared/hub-service.ts';

const now=new Date('2026-10-20T12:00:00Z');
const code={id:'code-a',cohort_id:'school-a',code_type:'staff',status:'active'};
const session={id:'session-a',cohort_id:'school-a',access_code_id:'code-a',role:'staff',expires_at:'2026-10-21T12:00:00Z'};
const cryptoPort={sha256:async x=>'hash:'+x,randomToken:()=> 'synthetic-token-with-length'};
function makeRepo(overrides={}){
 const calls={load:0,create:0};
 return {calls,
 findAccessCode:async()=>code,
 findAccessCodeById:async()=>code,
 findSession:async()=>session,
 findCohort:async id=>({id,status:'live'}),
 createSession:async()=>{calls.create++},
 touchCode:async()=>{},
 touchSession:async()=>{},
 loadCurrentProgramme:async()=>{calls.load++;return null},
 ...overrides};
}
test('unknown access code is rejected before session creation',async()=>{
 const repo=makeRepo({findAccessCode:async()=>null});
 await assert.rejects(exchangeAccessCode({code:'synthetic-access-code',view:'staff',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.create,0);
});
test('staff code cannot be exchanged for athlete role',async()=>{
 const repo=makeRepo();
 await assert.rejects(exchangeAccessCode({code:'synthetic-access-code',view:'athlete',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.create,0);
});
test('suspended cohort cannot issue sessions',async()=>{
 const repo=makeRepo({findCohort:async id=>({id,status:'suspended'})});
 await assert.rejects(exchangeAccessCode({code:'synthetic-access-code',view:'staff',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.create,0);
});
test('unknown session cannot load any programme',async()=>{
 const repo=makeRepo({findSession:async()=>null});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});
test('expired session cannot load any programme',async()=>{
 const repo=makeRepo({findSession:async()=>({...session,expires_at:'2026-10-19T12:00:00Z'})});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});
test('session cohort mismatch cannot load another school',async()=>{
 const repo=makeRepo({findAccessCodeById:async()=>({...code,cohort_id:'school-b'})});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});
test('suspended school cannot load a programme',async()=>{
 const repo=makeRepo({findCohort:async id=>({id,status:'suspended'})});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});

const publishedBundle={
 cohort:{id:'school-a',name:'Synthetic School',current_week:1},
 programme:{id:'programme-a',name:'Synthetic Programme',duration_weeks:1},
 week:{week_number:1,status:'live',verification_status:'verified',published_at:'2026-10-19T12:00:00Z'},
 trainingDays:[{id:'day-a',day_key:'Day 1',title:'Synthetic Session'}],
 blocks:[{training_day_id:'day-a',title:'Movement',content:{items:['Bridge 2 x 8']}}],
 exercises:[]
};
test('valid staff code issues a cohort-scoped session',async()=>{
 const repo=makeRepo();
 const result=await exchangeAccessCode({code:'synthetic-access-code',view:'staff',now,repository:repo,cryptoPort});
 assert.equal(result.role,'staff');
 assert.equal(result.token,'synthetic-token-with-length');
 assert.equal(repo.calls.create,1);
});
test('valid session loads only its assigned published cohort programme',async()=>{
 const requested=[];
 const repo=makeRepo({loadCurrentProgramme:async id=>{requested.push(id);return publishedBundle;}});
 const result=await bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort});
 assert.deepEqual(requested,['school-a']);
 assert.equal(result.role,'staff');
 assert.equal(result.contentStatus,'published');
 assert.equal(result.programme.sessions[0].items[0],'Bridge 2 x 8');
});
test('unpublished assigned week does not leak private workout content',async()=>{
 const repo=makeRepo({loadCurrentProgramme:async()=>({...publishedBundle,week:{...publishedBundle.week,published_at:null}})});
 const result=await bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort});
 assert.equal(result.contentStatus,'preparing');
 assert.doesNotMatch(JSON.stringify(result),/Bridge 2 x 8/);
});

test('expired access code cannot issue a new session',async()=>{
 const repo=makeRepo({findAccessCode:async()=>({...code,expires_at:'2026-10-19T12:00:00Z'})});
 await assert.rejects(exchangeAccessCode({code:'synthetic-access-code',view:'staff',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.create,0);
});
test('revoked session cannot load programme data',async()=>{
 const repo=makeRepo({findSession:async()=>({...session,revoked_at:'2026-10-20T11:00:00Z'})});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});
test('suspended access code invalidates existing sessions',async()=>{
 const repo=makeRepo({findAccessCodeById:async()=>({...code,status:'suspended'})});
 await assert.rejects(bootstrapHub({token:'synthetic-token-with-length',now,repository:repo,cryptoPort}));
 assert.equal(repo.calls.load,0);
});
