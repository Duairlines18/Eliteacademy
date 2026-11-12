import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrivateAthleteRequest} from '../functions/_shared/private-athlete-handler.ts';
import {handleParentRequest} from '../functions/_shared/parent-handler.ts';
const request=(body)=>new Request('https://example.invalid',{method:'POST',headers:{origin:'https://duairlineseliteacademy.com','content-type':'application/json'},body:JSON.stringify(body)});
for(const [audience,handler] of [['parent',handleParentRequest],['private-athlete',handlePrivateAthleteRequest]]){
 for(const action of audience==='parent'?['bootstrap','history']:['bootstrap','history','programme-week']){
  test(`${audience} ${action}: due check-in blocks direct API access without leaking a programme`,async()=>{
   const repository={weeklyCheckinState:async(user,role)=>{assert.equal(user,'verified-user');assert.equal(role,audience);return {enabled:true,due:[{id:'due'}],requirements:[],held:false}}};
   const response=await handler(request({action,athleteId:'victim'}),{verifyUser:async()=>({id:'verified-user'}),repository,services:new Proxy({},{get(){throw Error('Training service must not run')}})});
   assert.equal(response.status,409);const data=await response.json();assert.equal(data.code,'CHECKIN_REQUIRED');assert.equal(data.programme,undefined);assert.equal(data.checkins.due.length,1);
  });
 }
 test(`${audience}: safety hold remains after forms completed`,async()=>{const response=await handler(request({action:'bootstrap'}),{verifyUser:async()=>({id:'u'}),repository:{weeklyCheckinState:async()=>({enabled:true,due:[],held:true})}});assert.equal(response.status,409);assert.equal((await response.json()).code,'SAFETY_REVIEW_REQUIRED');});
 test(`${audience}: status fetch failure fails closed`,async()=>{const response=await handler(request({action:'bootstrap'}),{verifyUser:async()=>({id:'u'}),repository:{weeklyCheckinState:async()=>{throw Error('database down')}}});assert.equal(response.status,500);assert.equal((await response.json()).programme,undefined);});
 test(`${audience}: dedicated status path remains available while overdue`,async()=>{const response=await handler(request({action:'checkin-state'}),{verifyUser:async()=>({id:'u'}),repository:{weeklyCheckinState:async()=>({enabled:true,due:[{id:'r'}],held:true})}});assert.equal(response.status,200);assert.equal((await response.json()).checkins.held,true);});
 test(`${audience}: cannot save somebody else's requirement`,async()=>{let writes=0;const response=await handler(request({action:'save-checkin',requirementId:'victim',kind:'start',input:{},submissionId:'submission-1234567890',expectedRevision:0}),{verifyUser:async()=>({id:'u'}),repository:{weeklyCheckinState:async()=>({enabled:true,requirements:[{id:'mine'}]}),saveWeeklyCheckin:async()=>{writes++}}});assert.equal(response.status,400);assert.equal(writes,0);});
}
