import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createOnlineSimulation, readOnlineSimulation, saveOnlineSimulation, onlineSimulationRunning } from './online-application-simulation.mjs'

test('online batch checkpoints unique outcomes and stops exactly at the requested limit', async () => {
  const checkpoints = [], session = createOnlineSimulation(2, async value => checkpoints.push(value.processed))
  await session.complete('one'); await session.complete('one')
  await assert.rejects(session.complete('two'), /ONLINE_SIMULATION_COMPLETE/)
  assert.deepEqual(checkpoints, [1, 2]); assert.equal(session.summary().processed, 2)
  for (const value of [0, -1, 1.5, NaN, '2']) assert.throws(() => createOnlineSimulation(value))
})

test('the actual positive branch records a candidate and exits before approve, click or startup hooks', async () => {
  const source = await fs.readFile(new URL('../geek-auto-start-chat-with-boss/index.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('          if (simulation) {', source.indexOf("if (!filterOptions.enabled) await hooks.jobScreened"))
  const end = source.indexOf('          chatRequestGuard.approve(', start)
  assert.ok(start > 0 && end > start)
  const scope = vm.createContext({ simulation: createOnlineSimulation(5), targetJobData: { jobInfo: { encryptId: 'one' } }, blockJobNotSuit: new Set(), sent: 0 })
  vm.runInContext(`async function run() { findInCurrentFilterCondition: for(let i=0;i<1;i++) { ${source.slice(start, end)} sent++ } }`, scope)
  await scope.run()
  assert.equal(scope.sent, 0); assert.equal(scope.simulation.summary().processed, 1)
})

test('the actual negative branch marks the website before saving and completing the simulation', async () => {
  const source = await fs.readFile(new URL('../geek-auto-start-chat-with-boss/index.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('                    if (simulation) {', source.indexOf('const reasons ='))
  const end = source.indexOf('\n                  }', start)
  const calls = []
  const scope = vm.createContext({ simulation: createOnlineSimulation(5), hooks: {}, targetJobData: { jobInfo: { encryptId: 'one' } }, blockJobNotSuit: new Set(), reasons: { active: 'BOSS本周活跃，不符合三日内要求' }, notSuitReasonIdToStrategyMap: { active: 1 }, MarkAsNotSuitReason: { BOSS_INACTIVE: 1 }, ChatStartupFrom: { AutoFromRecommendList: 1 }, JobSource: { recommend: 2 }, computedSourceList: [{ type: 'recommend' }], currentSourceIndex: 0, markOnlineSimulationRejected: async (_, job, detail) => calls.push({ job, detail }) })
  vm.runInContext(`async function run() { continueFind: for(let i=0;i<1;i++) { ${source.slice(start, end)} throw new Error('must skip chat') } }`, scope)
  await scope.run()
  assert.equal(calls.length, 1); assert.equal(calls[0].detail.markReason, 1)
  assert.match(calls[0].detail.extInfo.reason, /三日内/)
  assert.equal(scope.simulation.summary().processed, 1)
})

test('website marking records confirmed success and retains local evidence on failure or changed job', async () => {
  const source = await fs.readFile(new URL('../geek-auto-start-chat-with-boss/index.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('async function markOnlineSimulationRejected(')
  const end = source.indexOf('async function markJobAsNotSuitInRecommendPage', start)
  for (const scenario of ['success', 'missing-button', 'failed', 'changed-job']) {
    const events = [], records = []
    const scope = vm.createContext({
      MarkAsNotSuitOp: { MARK_AS_NOT_SUIT_ON_LOCAL: 2, MARK_AS_NOT_SUIT_ON_BOSS: 1 },
      page: { evaluate: async () => scenario === 'changed-job' ? 'other' : 'one' },
      waitForSageTimeOrJustContinue: async () => events.push('wait'),
      markJobAsNotSuitInRecommendPage: async () => { events.push('website'); if(scenario === 'failed') throw new Error('请求失败'); return scenario === 'missing-button' ? {} : { chosenReasonInUi: { code: 41, text: '职位不合适' } } }
    })
    vm.runInContext(source.slice(start, end), scope)
    await scope.markOnlineSimulationRejected({ jobMarkedAsNotSuit: { promise: async (_, detail) => { events.push('save'); records.push(detail) } } }, { jobInfo: { encryptId: 'one' } }, { markReason: 1, extInfo: { reason: '不是实习', aiScore: 20 } })
    assert.equal(records[0].markOp, scenario === 'success' ? 1 : 2)
    assert.equal(records[0].extInfo.reason, '不是实习'); assert.equal(records[0].extInfo.aiScore, 20)
    if(scenario === 'success') { assert.deepEqual(events, ['wait', 'website', 'save']); assert.equal(records[0].extInfo.chosenReasonInUi.code, 41) }
    else assert.ok(records[0].extInfo.websiteMarkError)
    if(scenario === 'changed-job') assert.deepEqual(events, ['wait', 'save'])
  }
})

test('website marker waits before clicking and requires a successful save response', async () => {
  const source = await fs.readFile(new URL('../geek-auto-start-chat-with-boss/index.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('async function markJobAsNotSuitInRecommendPage (')
  const end = source.indexOf('export function testIfJobTitleOrDescriptionSuit', start)
  for (const code of [0, 1]) {
    const events = []
    const page = {
      $: async () => ({ evaluate: async () => {}, click: async () => events.push('open') }),
      $$: async () => [{ $: async selector => ({ click: async () => events.push(selector.includes('zp-btn-sure') ? 'confirm' : 'choose') }) }],
      waitForResponse: predicate => {
        for(const type of ['reasons', 'save']) {
          if(predicate({ url: () => `https://www.zhipin.com/wapi/zpgeek/negativefeedback/${type}.json` })) {
            events.push('wait-' + type)
            return Promise.resolve({ json: async () => type === 'reasons' ? { zpData: { result: [{ code: 41, text: { content: '职位不合适' } }] } } : { code, message: '保存失败' }, request: () => ({ postData: () => 'code=41' }) })
          }
        }
        throw new Error('unknown request')
      }
    }
    const scope = vm.createContext({ page, sleep: async () => {}, sleepWithRandomDelay: async () => {}, readStorageFile: async () => ({}), writeStorageFile: async () => {}, URLSearchParams, MarkAsNotSuitReason: { JOB_NOT_SUIT: 3 } })
    vm.runInContext(source.slice(start, end), scope)
    if(code === 0) assert.equal((await scope.markJobAsNotSuitInRecommendPage(3)).chosenReasonInUi.code, 41)
    else await assert.rejects(scope.markJobAsNotSuitInRecommendPage(3), /保存失败/)
    assert.deepEqual(events, ['wait-reasons', 'open', 'choose', 'wait-save', 'confirm'])
  }
})

test('online progress is independent of local simulation history', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-online-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'progress.json')
  assert.equal(await readOnlineSimulation(file), null)
  await saveOnlineSimulation({ running: true, ownerPid: process.pid, processed: 1, target: 5 }, file)
  const state = await readOnlineSimulation(file)
  assert.equal(state.processed, 1); assert.equal(onlineSimulationRunning(state), true)
  assert.equal(onlineSimulationRunning({ running: false }), false)
})
