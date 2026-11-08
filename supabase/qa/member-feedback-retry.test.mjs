import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {saveFeedback} from './member-feedback-release/feedback-service.ts';

const submissionId='member-feedback-idempotency-20261108';
const input={formVersion:'1.0',submissionId,trainingFeel:'Good',completion:'All',
 energy:'Normal',pain:'None',improvements:[],programmeChange:'No',note:'Original'};
const row={id:'feedback-original',athlete_id:null,staff_id:null,professional_member_id:'member-a',
 cohort_id:'cohort-a',week_number:4,feedback_type:'professional_weekly',payload:input,status:'no_change'};
const ctx={feedbackType:'professional_weekly',input,professionalMemberId:'member-a',
 athleteId:null,staffId:null,cohortId:'cohort-a',weekNumber:4};
function repository(match){return{
 calls:{inserts:0,updates:0,contextSearch:0},
 async findFeedbackBySubmissionId(){return match;},
 async findFeedbackForContext(){this.calls.contextSearch++;return null;},
 async updateFeedback(){this.calls.updates++;throw Error('Unexpected overwrite');},
 async insertFeedback(){this.calls.inserts++;return{id:'new-feedback',status:'no_change'};}
};}
test('an exact professional member retry returns original row without mutation',async()=>{
 const repo=repository(row);
 assert.deepEqual(await saveFeedback({...ctx,repository:repo}),{saved:true,id:'feedback-original',status:'no_change',duplicate:true});
 assert.deepEqual(repo.calls,{inserts:0,updates:0,contextSearch:0});
});
for(const [label,change] of [
 ['another member',{professionalMemberId:'member-b'}],
 ['another cohort',{cohortId:'cohort-b'}],
 ['another week',{weekNumber:5}],
 ['another feedback type',{feedbackType:'athlete_weekly'}],
 ['another submitter identity',{athleteId:'athlete-b'}],
]){
 test('reused ID is rejected for '+label,async()=>{
  const repo=repository(row);
  await assert.rejects(saveFeedback({...ctx,...change,repository:repo}),/Invalid feedback information/);
  assert.equal(repo.calls.updates,0);assert.equal(repo.calls.inserts,0);
 });
}
test('reused ID with changed answers rejects rather than acknowledging a different response',async()=>{
 const repo=repository(row);
 await assert.rejects(saveFeedback({...ctx,input:{...input,note:'Changed'},repository:repo}),/Invalid feedback information/);
});
test('new professional feedback still inserts normally',async()=>{
 const repo=repository(null);
 const result=await saveFeedback({...ctx,repository:repo,replaceExisting:false});
 assert.deepEqual(result,{saved:true,id:'new-feedback',status:'no_change'});
 assert.equal(repo.calls.inserts,1);
});
test('repository checks current rows then immutable history, retaining member identity',()=>{
 const src=fs.readFileSync(new URL('./member-feedback-release/supabase-repository.ts',import.meta.url),'utf8');
 const start=src.indexOf('async findFeedbackBySubmissionId('),end=src.indexOf('async findFeedbackForContext(',start);
 const method=src.slice(start,end);
 for(const fragment of ["from('feedback')","professional_member_id","if (current) return current",
 "from('feedback_revision_events')","contains('after_record', { payload: { submissionId } })",
 "historical?.payload?.submissionId === submissionId"])assert.ok(method.includes(fragment),fragment);
});
