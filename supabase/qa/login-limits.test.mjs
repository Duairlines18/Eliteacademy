import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../functions/_shared/login-limits.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('login limiter persists only hashed buckets and denies exhausted or failed counters',async()=>{
 assert.equal(typeof api.allowHubLogin,'function');const seen=[];const cryptoPort={sha256:async x=>'hashed:'+x};
 assert.equal(await api.allowHubLogin({clientKey:'sample-client',cryptoPort,repository:{consumeLoginAttempt:async k=>{seen.push(k);return true;}}}),true);assert.equal(seen[0],'hashed:hub-login:sample-client');
 for(const consumeLoginAttempt of [async()=>false,async()=>{throw Error('offline');}])assert.equal(await api.allowHubLogin({clientKey:'sample-client',cryptoPort,repository:{consumeLoginAttempt}}),false);
});
