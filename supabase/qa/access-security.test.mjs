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
