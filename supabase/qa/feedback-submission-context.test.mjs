import test from 'node:test';
import assert from 'node:assert/strict';
import {saveFeedback} from '../functions/_shared/feedback-service.ts';

const submissionId='feedback-retry-20261108-0001';
const answers={
  formVersion:'1.0',submissionId,trainingFeel:'Good',completion:'All',
  energy:'Normal',pain:'None',improvements:[],programmeChange:'No',note:'',
};
const context={feedbackType:'athlete_weekly',athleteId:'athlete-a',staffId:null,cohortId:'cohort-a',weekNumber:5};
const stored={
  id:'row-1',status:'no_change',athlete_id:'athlete-a',staff_id:null,
  cohort_id:'cohort-a',week_number:5,feedback_type:'athlete_weekly',payload:answers,
};
function repo(duplicate=stored){
  const calls={insert:0,update:0};
  return {calls,async findFeedbackBySubmissionId(){return duplicate;},
    async findFeedbackForContext(){throw Error('retry must not replace a row');},
    async insertFeedback(){calls.insert++;return {id:'new-row',status:'no_change'};},
    async updateFeedback(){calls.update++;throw Error('retry must not update a row');}};
}
test('same owner, week, type and answers is acknowledged exactly once',async()=>{
  const repository=repo();
  const result=await saveFeedback({repository,...context,input:answers});
  assert.deepEqual(result,{saved:true,id:'row-1',status:'no_change',duplicate:true});
  assert.equal(repository.calls.insert,0);assert.equal(repository.calls.update,0);
});
for(const [label,overrides] of [
  ['another athlete',{athleteId:'athlete-b'}],
  ['another cohort',{cohortId:'cohort-b'}],
  ['another week',{weekNumber:6}],
  ['another feedback type',{feedbackType:'athlete_issue'}],
]){
  test('reused submission ID cannot acknowledge '+label,async()=>{
    const repository=repo();
    const input=overrides.feedbackType==='athlete_issue'
      ? {formVersion:'1.0',submissionId,session:'Day 1',reason:'Other',note:''}
      : answers;
    await assert.rejects(saveFeedback({repository,...context,...overrides,input}),/Invalid feedback information/);
    assert.equal(repository.calls.insert,0);assert.equal(repository.calls.update,0);
  });
}
test('same submission ID with changed answers is rejected',async()=>{
  const repository=repo();
  await assert.rejects(saveFeedback({repository,...context,input:{...answers,energy:'Low'}}),/Invalid feedback information/);
  assert.equal(repository.calls.insert,0);assert.equal(repository.calls.update,0);
});
test('fresh submission still inserts normally',async()=>{
  const repository=repo(null);
  const result=await saveFeedback({repository,...context,input:answers,replaceExisting:false});
  assert.deepEqual(result,{saved:true,id:'new-row',status:'no_change'});
  assert.equal(repository.calls.insert,1);
});
