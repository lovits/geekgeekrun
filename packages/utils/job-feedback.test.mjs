import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { saveJobFeedback, readJobFeedback, relatedJobFeedback, applyFeedbackScore } from './job-feedback.mjs'
import { recommendFromFeedback } from './feedback-recommender.mjs'
import { matchJobWithResume, matchingPayload } from './ai-job-match.mjs'
test('feedback is persisted by job ID and supports changing and clearing a mark',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'feedback-test-'));const file=path.join(dir,'feedback.json')
 try{
  await Promise.all([saveJobFeedback({jobId:'a',value:'like',jobName:'Agent实习'},file),saveJobFeedback({jobId:'b',value:'dislike',jobName:'销售实习'},file)])
  assert.equal((await readJobFeedback(file)).length,2)
  await saveJobFeedback({jobId:'a',value:'dislike'},file);assert.equal((await readJobFeedback(file)).find(x=>x.jobId==='a').value,'dislike')
  await saveJobFeedback({jobId:'a',value:'neutral'},file);assert.equal((await readJobFeedback(file)).length,1)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('similarity uses job contents rather than treating the company as a preference',()=>{
 const records=[{jobId:'a',value:'like',company:'Company',jobName:'Python FastAPI Agent',description:'Python FastAPI RAG backend',updatedAt:'2026-11-18'}, {jobId:'b',value:'dislike',company:'Company',jobName:'Sales',description:'Sales telephone',updatedAt:'2026-11-18'}]
 const examples=relatedJobFeedback(records,{jobInfo:{jobName:'Agent intern',postDescription:'Python FastAPI RAG'}})
 assert.equal(examples.length,1);assert.equal(examples[0].jobId,'a')
 const rec=recommendFromFeedback(records,{jobInfo:{jobName:'Agent intern',postDescription:'Python FastAPI RAG'}});const positive=applyFeedbackScore({match:true,score:80},rec);assert.ok(positive.score>80 && positive.score<=90)
 const rejected=applyFeedbackScore({match:false,score:40},rec);assert.equal(rejected.match,false);assert.ok(rejected.score<=49)
})
test('explicit dislike prevents the same job from calling the model',async()=>{
 const result=await matchJobWithResume({enabled:true,resumeText:'Python',preferences:'实习',feedbackRecords:[{jobId:'x',value:'dislike'}]},{jobInfo:{encryptId:'x',postDescription:'Python实习'}},{},()=>{throw Error('must not call')})
 assert.equal(result.match,false);assert.equal(result.score,0)
})
test('feedback can be excluded from the actual model payload',()=>{
 const data=matchingPayload({enabled:true,inputSources:{feedback:false},feedbackRecords:[{jobId:'x',value:'like',jobName:'Python',description:'Python',updatedAt:'2026-11-18'}]},{jobInfo:{postDescription:'Python'}})
 assert.ok(!('feedbackExamples' in data))
})
