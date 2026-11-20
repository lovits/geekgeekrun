import test from 'node:test'
import assert from 'node:assert/strict'
import { jobFilterOptions, jobRegexPatterns } from './job-filter-options.mjs'
import { matchJobWithResume } from './ai-job-match.mjs'

test('migrates the prior AI and regex modes without enabling extra checks', () => {
  const ai = jobFilterOptions({ enabled: true })
  assert.equal(ai.regex.jobName, true)
  assert.equal(ai.regex.postDescription, false)
  assert.equal(ai.ai.postDescription, true)
  assert.equal(jobFilterOptions({ enabled: false }).regex.postDescription, true)
})
test('each regex check can be disabled independently while AI remains enabled', () => {
  const config = { enabled: true, regexFilters: { jobName: false, postDescription: true, blockedCompanies: false }, aiFilters: { jobName: true, postDescription: false } }
  assert.deepEqual(jobRegexPatterns({ jobName: '后端', postDescription: '接口', positionName: '研发' }, config), { jobName: '', postDescription: '接口', positionName: '研发' })
  assert.equal(jobFilterOptions(config).regex.blockedCompanies, false)
  assert.equal(jobFilterOptions(config).enabled, true)
})
test('AI title-only mode does not receive or judge the unselected description', async () => {
  let called = false
  const config = { resumeText: 'Python Agent', preferences: '技术实习', aiFilters: { jobName: true, postDescription: false } }
  const result = await matchJobWithResume(config, { jobInfo: { jobName: 'Agent实习', postDescription: 'do not inspect' } }, { provider: 'codex-cli' }, async (_, messages) => {
    called = true
    assert.deepEqual(JSON.parse(messages[1].content).job, { jobName: 'Agent实习' })
    return { choices: [{ message: { content: '{"match":true,"score":85,"criteriaSummary":["技术实习"],"reason":"名称方向匹配","gaps":[]}' } }] }
  })
  assert.ok(called && result.match)
})
test('when both AI fields are disabled no model is called', async () => {
  const result = await matchJobWithResume({ resumeText: 'x', preferences: 'y', aiFilters: { jobName: false, postDescription: false } }, {}, {}, () => { throw Error('must not call') })
  assert.equal(result.match, true)
})

test('the running regex evaluator respects every/any, disabled rules, empty rules and invalid expressions', async () => {
 const { testJobRegex } = await import('./job-filter-options.mjs')
 const job = { jobName:'Go后端实习', positionName:'开发', postDescription:'Python接口研发' }
 const patterns = { jobName:'后端', positionName:'算法', postDescription:'接口' }
 assert.equal(testJobRegex(job,patterns,1),false)
 assert.equal(testJobRegex(job,patterns,2),true)
 assert.equal(testJobRegex(job,jobRegexPatterns(patterns,{regexFilters:{positionName:false}}),1),true)
 assert.equal(testJobRegex(job,{jobName:'',positionName:'',postDescription:''},2),true)
 assert.equal(testJobRegex(job,{jobName:'['},1),false)
 assert.equal(testJobRegex(job,{jobName:'销售',postDescription:'客服'},2),false)
})
test('all combinations of independently enabled regex fields and AI fields honor their own boundaries', async () => {
 const { testJobRegex }=await import('./job-filter-options.mjs')
 const job={jobName:'后端',positionName:'研发',postDescription:'接口'}
 const fields=['jobName','positionName','postDescription']
 for(let mask=0;mask<8;mask++) {
  const regexFilters=Object.fromEntries(fields.map((key,index)=>[key,Boolean(mask&(1<<index))]))
  for(let aiMask=0;aiMask<4;aiMask++) {
   const aiFilters={jobName:Boolean(aiMask&1),postDescription:Boolean(aiMask&2)}
   const config={resumeText:'Agent',preferences:'技术实习',regexFilters,aiFilters,inputSources:{feedback:false}}
   const active=jobRegexPatterns({jobName:'后端',positionName:'算法',postDescription:'接口'},config)
   assert.equal(testJobRegex(job,active,1),!regexFilters.positionName)
   const result=await matchJobWithResume(config,{jobInfo:job},{provider:'codex-cli'},async(_,messages)=>{
    const payload=JSON.parse(messages[1].content)
    assert.deepEqual(Object.keys(payload.job).sort(),Object.keys(aiFilters).filter(key=>aiFilters[key]).sort())
    return {choices:[{message:{content:JSON.stringify({match:true,score:85,criteriaSummary:['匹配'],reason:'技术研发',gaps:[]})}}]}
   })
   assert.equal(result.match,true)
  }
 }
})

test('scoped saves preserve other pages and preview uses the latest saved scopes and sources', async () => {
  const { mergeJobFilterSettings } = await import('./job-filter-options.mjs')
  const { matchingPayload } = await import('./ai-job-match.mjs')
  let config = { resumeText: '真实简历', preferences: '后端实习', aiFilters: { jobName: false, postDescription: true }, regexFilters: { jobName: false, postDescription: true, blockedCompanies: false }, inputSources: { resume: true, companyRules: false, regexRules: false } }
  config = mergeJobFilterSettings(config, { aiFilters: { jobName: true, postDescription: false } })
  assert.equal(config.regexFilters.postDescription, true)
  assert.equal(config.regexFilters.jobName, false)
  config = mergeJobFilterSettings(config, { regexFilters: { postDescription: false, companies: false } })
  assert.deepEqual(config.aiFilters, { jobName: true, postDescription: false })
  config = mergeJobFilterSettings(config, { inputSources: { companyRules: true, regexRules: true, resume: false } })
  const payload = matchingPayload({ ...config, filterContext: { regex: { jobName: '后端' }, companies: ['腾讯'] } }, { jobInfo: { jobName: '后端实习', postDescription: '不应输入' } })
  assert.deepEqual(payload.selectedFields, ['jobName'])
  assert.equal(payload.switches.regex.postDescription, false)
  assert.equal(payload.switches.regex.companies, false)
  assert.equal(payload.inputSources.resume, false)
  assert.equal('resume' in payload, false)
  assert.deepEqual(payload.filterContext.companies, ['腾讯'])
  assert.deepEqual(payload.filterContext.regex, { jobName: '后端' })
  assert.equal(config.preferences, '后端实习')
})

test('experience rules apply to every title independently and stay off by default', async () => {
  const { testJobRegex, jobRegexFailures } = await import('./job-filter-options.mjs')
  const candidate = { jobName: '后端实习生', experienceName: '3-5年' }
  const patterns = { experienceName: '在校|经验不限', jobName: '后端' }
  assert.equal(jobFilterOptions({}).regex.experienceName, false)
  assert.equal(testJobRegex(candidate, patterns, 2), false)
  assert.equal(testJobRegex({ ...candidate, experienceName: '在校/应届' }, patterns, 1), true)
  assert.match(jobRegexFailures(candidate, patterns, 2)[0], /工作经验/)
  assert.equal(testJobRegex(candidate, jobRegexPatterns(patterns, { regexFilters: { experienceName: false } }), 1), true)
  const defaults = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../geek-auto-start-chat-with-boss/default-config-file/common-job-condition-config.json', import.meta.url), 'utf8'))
  assert.equal(defaults.expectWorkExpRegExpStr, '')
  assert.equal(Object.hasOwn(defaults, 'workExpTitleBypassRegExpStr'), false)
})
