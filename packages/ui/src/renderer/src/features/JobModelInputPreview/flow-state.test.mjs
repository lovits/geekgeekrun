import test from 'node:test'
import assert from 'node:assert/strict'
import { jobMatchFlow, groupFlowInputs } from './flow-state.mjs'
test('every source switch controls only its corresponding flow node', () => {
  const keys = ['resume','preferences','feedback','employmentAndTraversal','regexRules','pageFilters','companyRules']
  for (let mask=0;mask<128;mask++) {
    const inputSources=Object.fromEntries(keys.map((key,index)=>[key,Boolean(mask&(1<<index))]))
    const flow=jobMatchFlow({selectedFields:['postDescription'],inputSources})
    for (const key of keys) assert.equal(flow.personal.find(item=>item.key===key).enabled,inputSources[key])
    assert.equal(flow.boss.some(item=>item.key==='bossActivity'),false)
    assert.equal(flow.boss.find(item=>item.key==='jobName').enabled,false)
    assert.equal(flow.boss.find(item=>item.key==='postDescription').enabled,true)
    assert.equal(flow.boss.some(item=>item.key==='salary'),false)
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

test('before-stage fields sharing the filter section become one card without dropping their states', () => {
  const flow=jobMatchFlow({selectedFields:['postDescription'],switches:{regex:{jobName:true}}},{pageFilters:{scaleList:[304]}})
  const groups=groupFlowInputs(flow.beforeBoss,'before')
  assert.equal(groups.length,4)
  const filters=groups.find(group=>group.key==='pageFilters')
  assert.equal(filters.label,'职位筛选条件')
  assert.equal(filters.action,'pageFilters')
  assert.deepEqual(filters.items.map(item=>item.key),['city','salary','experience','degree','industry','scale','employmentType'])
  assert.equal(filters.state,'mixed')
  assert.equal(filters.items.find(item=>item.key==='scale').enabled,true)
  assert.equal(filters.items.find(item=>item.key==='degree').enabled,false)
  assert.deepEqual(groups.flatMap(group=>group.items.map(item=>item.key)).sort(),flow.beforeBoss.map(item=>item.key).sort())
})
test('AI range and metadata each have one destination and mixed AI switches remain visible', () => {
  const groups=groupFlowInputs(jobMatchFlow({selectedFields:['postDescription'],inputSources:{activity:true}}).boss,'after')
  assert.equal(groups.length,2)
  assert.equal(groups.find(group=>group.key==='aiScope').state,'mixed')
  assert.equal(groups.find(group=>group.key==='aiScope').action,'switches')
  assert.equal(groups.find(group=>group.key==='metadata').items.length,2)
  assert.equal(groups.find(group=>group.key==='metadata').state,'enabled')
  assert.equal(groups.find(group=>group.key==='metadata').capability,'fixed')
})
test('personal traversal and page filters merge without changing which context is enabled', () => {
  const flow=jobMatchFlow({selectedFields:['postDescription'],inputSources:{employmentAndTraversal:true,pageFilters:false}})
  const group=groupFlowInputs(flow.personal,'personal').find(item=>item.key==='pageFilters')
  assert.equal(group.items.length,2)
  assert.equal(group.state,'mixed')
  assert.equal(group.items.find(item=>item.key==='pageFilters').enabled,false)
  assert.equal(group.items.find(item=>item.key==='employmentAndTraversal').enabled,true)
})

test('company allowlist and blocklist preserve independent program switches', () => {
  for (const companies of [false, true]) for (const blockedCompanies of [false, true]) {
    const flow = jobMatchFlow({ selectedFields: ['postDescription'], switches: { regex: { companies, blockedCompanies } } })
    const group = groupFlowInputs(flow.beforeBoss, 'before').find(item => item.key === 'companyRules')
    assert.equal(group.state, companies && blockedCompanies ? 'enabled' : companies || blockedCompanies ? 'mixed' : 'disabled')
    assert.equal(group.items.find(item => item.key === 'companies').enabled, companies)
    assert.equal(group.items.find(item => item.key === 'blockedCompanies').enabled, blockedCompanies)
  }
})
