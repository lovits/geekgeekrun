import test from 'node:test'
import assert from 'node:assert/strict'
import { jobMatchFlow } from './flow-state.mjs'
test('every source switch controls only its corresponding flow node', () => {
  const keys = ['resume','preferences','feedback','employmentAndTraversal','regexRules','pageFilters','companyRules','activity']
  for (let mask=0;mask<256;mask++) {
    const inputSources=Object.fromEntries(keys.map((key,index)=>[key,Boolean(mask&(1<<index))]))
    const flow=jobMatchFlow({selectedFields:['postDescription'],inputSources})
    for (const key of keys) assert.equal(flow.personal.find(item=>item.key===key).enabled,inputSources[key])
    assert.equal(flow.boss.find(item=>item.key==='bossActivity').enabled,inputSources.activity)
    assert.equal(flow.boss.find(item=>item.key==='jobName').enabled,false)
    assert.equal(flow.boss.find(item=>item.key==='postDescription').enabled,true)
    assert.equal(flow.boss.find(item=>item.key==='salary').enabled,false)
  }
})
test('disabled AI sends no inputs; company/city, facts, prompt and system are automatic when AI is active', () => {
  const off=jobMatchFlow({selectedFields:[],inputSources:{resume:true}})
  assert.ok([...off.personal,...off.boss].every(item=>!item.enabled))
  assert.equal(off.personal.find(item=>item.key==='resume').selected,true)
  const on=jobMatchFlow({selectedFields:['jobName'],inputSources:{}})
  assert.equal(on.boss.find(item=>item.key==='jobName').enabled,true)
  for (const key of ['companyCity','facts']) assert.equal(on.boss.find(item=>item.key===key).enabled,true)
  for (const key of ['prompt','system','date','switches']) assert.equal(on.personal.find(item=>item.key===key).enabled,true)
})

test('program-stage switches stay independent from AI fields and input-source switches', () => {
  const context={pageFilters:{cityList:['上海'],salaryList:[404],experienceList:[108],degreeList:[203],industryList:[100020],scaleList:[304,305,306]},employmentType:'实习',activityCutoff:8}
  const flow=jobMatchFlow({selectedFields:['postDescription'],inputSources:{pageFilters:false},switches:{regex:{jobName:true,postDescription:false}}},context)
  assert.equal(flow.beforeBoss.find(item=>item.key==='jobName').enabled,true)
  assert.equal(flow.boss.find(item=>item.key==='jobName').enabled,false)
  assert.equal(flow.beforeBoss.find(item=>item.key==='postDescription').enabled,false)
  assert.equal(flow.boss.find(item=>item.key==='postDescription').enabled,true)
  for (const key of ['city','salary','experience','degree','industry','scale','employmentType','bossActivity']) assert.equal(flow.beforeBoss.find(item=>item.key===key).enabled,true)
  assert.equal(flow.personal.find(item=>item.key==='pageFilters').enabled,false)
  const off=jobMatchFlow({selectedFields:[],switches:{regex:{jobName:true}}},context)
  assert.equal(off.beforeBoss.find(item=>item.key==='jobName').enabled,true)
  assert.ok(off.boss.every(item=>!item.enabled))
})
