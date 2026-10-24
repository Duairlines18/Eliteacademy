import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('synthetic HTTP integration: six people, identity-owned progress, staff denial and logout',async()=>{
 const server=spawn(process.execPath,['supabase/qa/school-browser-fixture.mjs'],{env:{...process.env,DU_SCHOOL_QA_PORT:'4174'},stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Fixture exited '+code)));});
 const base='http://127.0.0.1:4174';
 const post=async(token,endpoint,body,viewer='synthetic-same-browser')=>{const r=await fetch(base+'/functions/v1/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-du-session':token,'x-du-viewer':viewer},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{
  const tokens=[];
  for(const slot of ['01','02','03','04','05','06','staff','director']){
   const html=await fetch(base+'/qa/'+slot).then(r=>r.text());const m=html.match(/JSON\.stringify\((\{"token"[\s\S]*?\})\)\);const originalFetch/);assert.ok(m,'fixture session initialized');const token=JSON.parse(m[1]).token;tokens.push(token);
   const data=await post(token,'hub-data',{action:'bootstrap'});assert.equal(data.status,200);
   if(slot==='director'){assert.equal(data.body.staff.accessProfile,'sports_director');assert.equal(data.body.completionSummary.length,6);}else if(slot==='staff'){assert.equal(data.body.staff.displayName,'Coach Dube');assert.equal(data.body.roster.length,6);}else assert.equal(data.body.athlete.displayName,'St. George’s Athlete '+slot);
  }
  const set=await post(tokens[0],'workout-completions',{action:'set',sessionKey:'fixture-day-1',itemKey:'p:1:0:SPR01',completed:true,athleteId:'fixture-athlete-2',viewerKey:'spoof-other'});assert.equal(set.status,200);
  const a=await post(tokens[0],'workout-completions',{action:'list'}),b=await post(tokens[1],'workout-completions',{action:'list'});assert.equal(a.body.completions.length,1);assert.equal(b.body.completions.length,0);
  assert.equal((await post(tokens[6],'workout-completions',{action:'set',sessionKey:'fixture-day-1',itemKey:'p:1:0:SPR01',completed:true})).status,403);
  assert.equal((await post('invalid-synthetic-token','hub-data',{action:'bootstrap'})).status,401);
  assert.equal((await post(tokens[0],'hub-data',{action:'logout'})).status,200);
  assert.equal((await post(tokens[0],'hub-data',{action:'bootstrap'})).status,401);
 }finally{server.kill();}
});
