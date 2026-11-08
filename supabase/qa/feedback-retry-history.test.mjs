import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {saveFeedback} from '../functions/_shared/feedback-service.ts';

const submissionId='historical-feedback-retry-20261108';
const answers={formVersion:'1.0',submissionId,trainingFeel:'Good',completion:'All',energy:'Normal',pain:'None',improvements:[],programmeChange:'No',note:'Original'};
const saved={id:'feedback-row-1',athlete_id:'athlete-1',staff_id:null,cohort_id:null,week_number:4,feedback_type:'athlete_weekly',status:'no_change',payload:answers};
const params={athleteId:'athlete-1',staffId:null,cohortId:null,weekNumber:4,feedbackType:'athlete_weekly',input:answers};
function repository(history){
 const calls={insert:0,update:0};
 return {calls,async findFeedbackBySubmissionId(){return history;},async findFeedbackForContext(){throw Error('historic retry must not search replacement target');},
 async updateFeedback(){calls.update++;throw Error('historic retry must not overwrite newer answers');},
 async insertFeedback(){calls.insert++;throw Error('historic retry must not create a new row');}};
}
test('retransmission of a replaced weekly answer acknowledges its recorded revision without overwriting current answer',async()=>{
 const r=repository(saved);
 const outcome=await saveFeedback({...params,repository:r});
 assert.deepEqual(outcome,{saved:true,id:saved.id,status:'no_change',duplicate:true});
 assert.equal(r.calls.update,0);assert.equal(r.calls.insert,0);
});
test('old submission ID cannot acknowledge another athlete even if it exists in revision history',async()=>{
 const r=repository(saved);
 await assert.rejects(saveFeedback({...params,athleteId:'athlete-2',repository:r}),/Invalid feedback information/);
 assert.equal(r.calls.update,0);
});
test('old submission ID cannot acknowledge changed answers',async()=>{
 const r=repository(saved);
 await assert.rejects(saveFeedback({...params,input:{...answers,note:'Changed'},repository:r}),/Invalid feedback information/);
});
test('repository searches current submissions before retained revisions with exact submissionId query',()=>{
 const source=fs.readFileSync(new URL('../functions/_shared/supabase-repository.ts',import.meta.url),'utf8');
 const method=source.slice(source.indexOf('async findFeedbackBySubmissionId('),source.indexOf('async findFeedbackForContext(',source.indexOf('async findFeedbackBySubmissionId(')));
 assert.ok(method.includes("this.client.from('feedback')"));
 assert.ok(method.includes("if (current) return current"));
 assert.ok(method.includes("this.client.from('feedback_revision_events')"));
 assert.ok(method.includes(".contains('after_record', {payload:{submissionId}})"));
 assert.ok(method.includes("historical.payload?.submissionId === submissionId"));
});
