import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolCompletionContext} from '../functions/_shared/school-completion.ts';
test('identified completions use server athlete ID and ignore supplied browser viewer',()=>{
 const identity={session:{role:'athlete'},cohort:{programme_id:'programme',current_week:1},athlete:{id:'first'}};
 assert.deepEqual(schoolCompletionContext(identity,'spoofed-viewer-other-person'),{kind:'athlete',userId:null,athleteId:'first',viewerKey:'athlete_first',programmeId:'programme',weekNumber:1});
 assert.equal(schoolCompletionContext({...identity,athlete:{id:'second'}},'same-browser-key').viewerKey,'athlete_second');
 assert.equal(schoolCompletionContext({...identity,session:{role:'staff'}},'anything').denied,true);
});
test('legacy shared completion still requires well-formed viewer key',()=>{
 const ctx={session:{role:'athlete'},cohort:{programme_id:'p',current_week:1},athlete:null};
 assert.equal(schoolCompletionContext(ctx,'too-short').denied,true);
 assert.equal(schoolCompletionContext(ctx,'synthetic-browser-viewer').viewerKey,'shared_synthetic-browser-viewer');
});
