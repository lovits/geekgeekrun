import test from 'node:test'
import assert from 'node:assert/strict'
import {buildJobMatchContext} from './job-match-context.mjs'
import {matchJobWithResume} from './ai-job-match.mjs'
test('includes full filter intent and decodes alternative groups without exposing credentials', () => {
 const c=buildJobMatchContext({ expectEmploymentType:1902, fieldsForUseCommonConfig:{jobDetail:true,expectCompanies:true}, staticCombineRecommendJobFilterConditions:[{degree:203}], anyCombineRecommendJobFilter:{scaleList:[305]}, apiKey:'private' },{expectJobNameRegExpStr:'后端',expectJobDescRegExpStr:'接口',expectCompanies:['腾讯']},[],{degreeList:[{code:203,name:'本科'}],scaleList:[{code:305,name:'1000人以上'}]})
 assert.equal(c.regex.postDescription,'接口');assert.deepEqual(c.companies,['腾讯']);assert.equal(c.staticFilterGroups[0].degree,'本科');assert.equal(c.pageFilters.scaleList[0],'1000人以上');assert.ok(!JSON.stringify(c).includes('private'))
})
test('model receives disabled rules as context with enabled switches and returns a score',async()=>{
 const config={enabled:true,resumeText:'Python',preferences:'实习',regexFilters:{postDescription:false},inputSources:{regexRules:true},filterContext:{regex:{postDescription:'接口'}}}
 const result=await matchJobWithResume(config,{jobInfo:{postDescription:'Python接口开发实习'}},{},async(_,messages)=>{
  const data=JSON.parse(messages[1].content);assert.equal(data.filterContext.regex.postDescription,'接口');assert.equal(data.switches.regex.postDescription,false)
  return {model:'test-model',choices:[{message:{content:JSON.stringify({match:true,score:88,criteriaSummary:['Python后端实习'],reason:'接口经验匹配',gaps:[]})}}]}
 })
 assert.equal(result.score,88);assert.equal(result.model,'test-model')
})
test('unselected sources never appear in the prompt payload', async()=>{
 const {matchingPayload}=await import('./ai-job-match.mjs')
 const data=matchingPayload({enabled:true,resumeText:'private resume',preferences:'private preferences',inputSources:{resume:false,preferences:false,regexRules:false,pageFilters:true,companyRules:false},customPrompt:'按职责评分',filterContext:{regex:{jobName:'secret'},companies:['private-company'],employmentType:'实习'}},{jobInfo:{postDescription:'后端实习'}})
 assert.ok(!('resume' in data));assert.ok(!('preferences' in data));assert.ok(!('regex' in data.filterContext));assert.ok(!('companies' in data.filterContext));assert.equal(data.filterContext.employmentType,'实习');assert.equal(data.userPrompt,'按职责评分')
})

test('reports the same free/fixed combination counts as the running filter', () => {
 const free={experienceList:[108,102,101],degreeList:[203,204],scaleList:[304,305,306]}
 const base={combineRecommendJobFilterType:1,anyCombineRecommendJobFilter:free}
 assert.equal(buildJobMatchContext(base).traversalDetails.combinationCount,256)
 assert.equal(buildJobMatchContext({...base,isSkipEmptyConditionForCombineRecommendJobFilter:true}).traversalDetails.combinationCount,255)
 const fixed=buildJobMatchContext({...base,combineRecommendJobFilterType:2,staticCombineRecommendJobFilterConditions:[{degree:203},{degree:203},{degree:204}]})
 assert.equal(fixed.traversalDetails.combinationCount,2)
 assert.equal(fixed.staticFilterGroups.length,2)
 assert.equal(buildJobMatchContext({}).traversalDetails.combinationCount,1)
})
test('provides only the active free/fixed settings when that input is selected',async()=>{
 const {matchingPayload}=await import('./ai-job-match.mjs')
 const context={traversalMode:'固定组合逐组遍历',staticFilterGroups:[{degree:'本科'}],pageFilters:{scaleList:['inactive']}}
 const selected=matchingPayload({enabled:true,inputSources:{pageFilters:true},filterContext:context},{jobInfo:{postDescription:'后端'}})
 assert.deepEqual(selected.filterContext.staticFilterGroups,[{degree:'本科'}])
 assert.ok(!('pageFilters' in selected.filterContext))
 const hidden=matchingPayload({enabled:true,inputSources:{pageFilters:false},filterContext:context},{jobInfo:{postDescription:'后端'}})
 assert.ok(!('pageFilters' in hidden.filterContext));assert.ok(!('staticFilterGroups' in hidden.filterContext))
 const free=matchingPayload({enabled:true,inputSources:{pageFilters:true},filterContext:{...context,traversalMode:'自由组合逐组遍历'}},{jobInfo:{postDescription:'后端'}})
 assert.deepEqual(free.filterContext.pageFilters,context.pageFilters)
 assert.ok(!('staticFilterGroups' in free.filterContext))
})

test('every input-source checkbox controls actual model payload content across all 128 combinations',async()=>{
 const {matchingPayload}=await import('./ai-job-match.mjs')
 const keys=['resume','preferences','employmentAndTraversal','regexRules','pageFilters','companyRules','feedback']
 const context={employmentType:'实习',traversalMode:'自由组合',pageFilters:{degreeList:['本科']},regex:{jobName:'Agent'},companies:['腾讯'],blockedCompaniesRegex:'外包'}
 for(let mask=0;mask<128;mask++) {
  const inputSources=Object.fromEntries(keys.map((key,index)=>[key,Boolean(mask&(1<<index))]))
  const payload=matchingPayload({enabled:true,resumeText:'简历证据',preferences:'用户偏好',learnedPreferences:'明确反馈',feedbackRecords:[],inputSources,filterContext:context},{jobInfo:{postDescription:'Agent研发'}})
  assert.equal('resume' in payload,inputSources.resume)
  assert.equal('preferences' in payload,inputSources.preferences)
  assert.equal('employmentType' in payload.filterContext,inputSources.employmentAndTraversal)
  assert.equal('regex' in payload.filterContext,inputSources.regexRules)
  assert.equal('pageFilters' in payload.filterContext,inputSources.pageFilters)
  assert.equal('companies' in payload.filterContext,inputSources.companyRules)
  assert.equal('blockedCompaniesRegex' in payload.filterContext,inputSources.companyRules)
  assert.equal('learnedPreferences' in payload,inputSources.feedback)
  assert.equal('feedbackExamples' in payload,inputSources.feedback)
 }
})

test('activity requirement follows the saved automatic chat threshold and input checkbox', async () => {
 const {matchingPayload}=await import('./ai-job-match.mjs')
 const context=buildJobMatchContext({markAsNotActiveSelectedTimeRange:9})
 assert.equal(context.activityRequirement,'3日内活跃')
 const candidate={jobInfo:{postDescription:'Agent开发'},bossInfo:{activeTimeDesc:'今日活跃'}}
 const payload=matchingPayload({enabled:true,filterContext:context},candidate)
 assert.equal(payload.filterContext.activityRequirement,'3日内活跃');assert.equal(payload.bossActivity,'今日活跃')
 const disabled=matchingPayload({enabled:true,filterContext:context,inputSources:{activity:false}},candidate)
 assert.equal('bossActivity' in disabled,false);assert.equal('activityCutoff' in disabled.filterContext,false)
})
