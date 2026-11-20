import test from 'node:test'
import assert from 'node:assert/strict'
import { simulationCandidates, simulateApplication, runApplicationSimulation, nextSimulationTarget } from './application-simulation.mjs'

const config = { resumeText: 'Go Agent', preferences: '开发实习', aiFilters: { jobName: true, postDescription: true },
  filterContext: { companies: ['目标公司'], blockedCompaniesRegex: '外包', regex: { jobName: '后端|Agent' }, combinationLogic: 1 } }
const job = { jobId: 'one', company: '目标公司', jobName: 'Go后端实习生', description: 'Go接口开发，面向在读实习生', status: 'pending' }

test('selection excludes contacted jobs, duplicates and missing descriptions and keeps the full JD', () => {
  const row = { encryptJobId: 'one', companyName: '目标公司', jobName: job.jobName, description: job.description }
  assert.equal(simulationCandidates([row, row, { ...row, encryptJobId: 'sent' }, { ...row, encryptJobId: 'empty', description: '' }], ['sent']).length, 1)
  assert.equal(simulationCandidates([row])[0].description, job.description)
  assert.equal(simulationCandidates([row], [], 101).length, 1)
  assert.equal(simulationCandidates([row])[0].snapshot.description, job.description)
  for (const invalid of [0, -1, 1.5, NaN, Infinity, '10']) assert.throws(() => simulationCandidates([row], [], invalid))
})

test('rule exclusions are recorded without calling the model or any outreach function', async () => {
  const noCall = () => { throw Error('must not call') }
  for (const candidate of [{ ...job, company: '其他公司' }, { ...job, company: '目标公司外包' }, { ...job, jobName: '产品实习生' }]) {
    const result = await simulateApplication(candidate, config, {}, noCall)
    assert.equal(result.status, 'reject'); assert.equal(result.aiEvaluated, false)
  }
})

test('model rejection and model failure remain distinct; full title and description are passed unchanged', async () => {
  const result = await simulateApplication(job, config, {}, async (settings, candidate) => {
    assert.deepEqual(settings.aiFilters, { jobName: true, postDescription: true })
    assert.equal(candidate.jobInfo.postDescription, job.description)
    assert.equal(candidate.jobInfo.jobName, job.jobName)
    return { score: 82, match: true, reason: '后端开发符合' }
  })
  assert.equal(result.status, 'recommend')
  assert.equal((await simulateApplication(job, config, {}, async () => ({ score: 40, match: false, reason: '非实习' }))).status, 'reject')
  assert.equal((await simulateApplication(job, config, {}, async () => ({ match: false, reason: '调用失败' }))).status, 'error')
  assert.equal((await simulateApplication(job, { ...config, filterContext: { ...config.filterContext, regex: { jobName: '[' } } }, {}, async () => assert.fail())).status, 'error')
})

test('first 50 and continuation to 100 retain results, checkpoint serially and never repeat completed model calls', async () => {
  const state = { target: 50, jobs: Array.from({ length: 100 }, (_, i) => ({ ...job, jobId: String(i) })) }
  let calls = 0, saving = false, saves = 0
  const save = async snapshot => {
    assert.equal(saving, false); saving = true
    await new Promise(resolve => setImmediate(resolve)); saves++; saving = false
    assert.equal(snapshot.jobs.length, 100)
  }
  const match = async () => { calls++; return { score: 80, match: true, reason: '匹配' } }
  await runApplicationSimulation(state, config, {}, save, match)
  assert.equal(calls, 50); assert.equal(state.jobs[50].status, 'pending'); assert.equal(state.running, false)
  state.target = 100
  await runApplicationSimulation(state, config, {}, save, match)
  assert.equal(calls, 100); assert.equal(state.jobs.filter(j => j.status === 'recommend').length, 100)
  state.jobs[0].status = 'error'
  await runApplicationSimulation(state, config, {}, save, match)
  assert.equal(calls, 101); assert.ok(saves >= 101)
})


test('custom batch sizes advance without repeating completed jobs and resume incomplete batches first', async () => {
  for (const batchSize of [1, 7, 10, 20, 50, 100, 250]) {
    const state = { target: 0, jobs: Array.from({ length: 120 }, (_, i) => ({ ...job, jobId: String(i) })) }
    state.target = nextSimulationTarget(state, batchSize)
    assert.equal(state.target, Math.min(batchSize, 120))
    assert.equal(nextSimulationTarget(state, 9), state.target)
    const noAi = { ...config, aiFilters: { jobName: false, postDescription: false } }
    await runApplicationSimulation(state, noAi, undefined, async () => {}, () => assert.fail('must not call AI'))
    assert.equal(state.jobs.filter(j => j.status === 'recommend').length, state.target)
    assert.ok(state.jobs.every(j => j.score == null))
    assert.equal(nextSimulationTarget(state, batchSize), Math.min(120, state.target + batchSize))
  }
  for (const invalid of [0, -10, 1.5, NaN, Infinity, '10']) assert.throws(() => nextSimulationTarget({ jobs: [] }, invalid))
})

test('simulation preserves the saved AI scope instead of forcing name and description checks', async () => {
  const titleOnly = { ...config, aiFilters: { jobName: true, postDescription: false } }
  await simulateApplication(job, titleOnly, {}, async settings => {
    assert.deepEqual(settings.aiFilters, titleOnly.aiFilters)
    return { match: true, score: 80, reason: '名称匹配' }
  })
})

test('enabled description regex rejects before AI; disabling it preserves AI review', async () => {
  const settings = { ...config, regexFilters: { postDescription: true }, filterContext: { ...config.filterContext, regex: { jobName: '后端', postDescription: 'RAG.*评测' } } }
  let calls = 0
  const model = async () => { calls++; return { match: true, score: 80, reason: '匹配' } }
  const rejected = await simulateApplication(job, settings, {}, model)
  assert.equal(rejected.status, 'reject')
  assert.equal(rejected.aiEvaluated, false)
  assert.equal(calls, 0)
  const accepted = await simulateApplication({ ...job, description: 'RAG 检索与评测服务开发' }, settings, {}, model)
  assert.equal(accepted.status, 'recommend')
  assert.equal(calls, 1)
  await simulateApplication(job, { ...settings, regexFilters: { postDescription: false } }, {}, model)
  assert.equal(calls, 2)
})

test('experience gate checks internship titles too and rejects before AI even in OR mode', async () => {
  const personalExperiencePattern = String.raw`在校|应届|\d+天/周 \d+个月`
  const settings = { ...config, regexFilters: { experienceName: true }, filterContext: { ...config.filterContext, employmentType: '实习', combinationLogic: 2, experienceTitleBypass: String.raw`实习|\bintern(?:ship)?\b`, regex: { jobName: '后端', experienceName: personalExperiencePattern } } }
  let calls = 0
  const model = async () => { calls++; return { score: 80, match: true, reason: '匹配' } }
  const titleOnly = await simulateApplication({ ...job, experience: '经验不限' }, settings, {}, model)
  assert.equal(titleOnly.status, 'reject')
  assert.equal(calls, 0)
  await simulateApplication({ ...job, experience: '在校/应届' }, settings, {}, model)
  assert.equal(calls, 1)
  const refused = await simulateApplication({ ...job, jobName: '后端开发', jobType: 4, experience: '3-5年' }, settings, {}, model)
  assert.equal(refused.status, 'reject')
  assert.match(refused.reason, /工作经验/)
  assert.equal(calls, 1)
  const qualified = await simulateApplication({ ...job, jobName: '后端开发', jobType: 4, description: '开发API', experience: '5天/周 3个月' }, settings, {}, model)
  assert.equal(qualified.status, 'recommend')
  assert.equal(calls, 2)
  const fulltime = await simulateApplication({ ...job, jobType: 0 }, settings, {}, model)
  assert.equal(fulltime.status, 'reject')
  assert.equal(calls, 2)
})
