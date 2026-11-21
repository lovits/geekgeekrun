import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { readConfigFile, storageFilePath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { simulationCandidates, runApplicationSimulation, nextSimulationTarget } from '@geekgeekrun/utils/application-simulation.mjs'
import { jobFilterOptions } from '@geekgeekrun/utils/job-filter-options.mjs'
import { buildJobMatchContext } from '@geekgeekrun/utils/job-match-context.mjs'
import { readJobFeedback } from '@geekgeekrun/utils/job-feedback.mjs'
import { getSimulationJobs, getSimulationCompanyFacts } from '../flow/OPEN_SETTING_WINDOW/utils/db'
import filterCatalog from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
import { applicationRunFile, readApplicationRunRecords, mergeApplicationRecords } from '@geekgeekrun/utils/application-run-records.mjs'
import { applicationRecordDay } from '@geekgeekrun/utils/application-outcome.mjs'
import { readOnlineSimulation, saveOnlineSimulation, onlineSimulationWorker, onlineSimulationRunning } from '@geekgeekrun/utils/online-application-simulation.mjs'
import { runCommon } from './run-common'
import { sendToDaemon } from '../flow/OPEN_SETTING_WINDOW/connect-to-daemon'

const file = path.join(storageFilePath, 'job-application-simulation.json')
let task: Promise<unknown> | null = null
let runtimeStamp = '', runtimeRecords: any[] = []
let dailyRuntimeRecords: any[] = []

export async function readDisplayedSimulation() {
  const state = await readSimulation()
  const online = await readOnlineSimulation()
  if (online?.running && !onlineSimulationRunning(online)) {
    online.running = false; online.runError ||= '在线模拟进程已停止，可重新开始'
  }
  try {
    const stat = await fs.stat(applicationRunFile), stamp = `${stat.mtimeMs}:${stat.size}`
    if (stamp !== runtimeStamp) {
      runtimeRecords = await readApplicationRunRecords()
      dailyRuntimeRecords = await readApplicationRunRecords(applicationRunFile, { groupByDay: true })
      runtimeStamp = stamp
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    runtimeRecords = []; dailyRuntimeRecords = []; runtimeStamp = ''
  }
  const pendingLocalRecords = await fs.readdir(path.join(storageFilePath, 'pending-local-rejections')).then(names => names.filter(name => name.endsWith('.json')).length).catch(error => { if (error.code === 'ENOENT') return 0; throw error })
  if (!state && !runtimeRecords.length && !online && !pendingLocalRecords) return null
  const localJobs = state?.jobs?.slice(0, state.target) || []
  const recordedDays = new Set(dailyRuntimeRecords.map(job => `${applicationRecordDay(job)}:${job.jobId}`))
  const dailyJobs = [...dailyRuntimeRecords, ...localJobs.filter(job => !recordedDays.has(`${applicationRecordDay(job)}:${job.jobId}`))]
  const { data: companyFacts } = await getSimulationCompanyFacts()
  const factsByJob = new Map<string, Record<string, any>>(companyFacts.map(row => [row.jobId, row]))
  const withCompanyFacts = (jobs: any[]) => jobs.map(job => ({ ...factsByJob.get(job.jobId), ...job }))
  return { ...(state || { jobs: [], target: 0 }), pendingLocalRecords, running: Boolean(state?.running || online?.running), online, displayJobs: withCompanyFacts(mergeApplicationRecords(localJobs, runtimeRecords)), dailyJobs: withCompanyFacts(dailyJobs) }
}

async function readSimulation() {
  try {
    const state = JSON.parse(await fs.readFile(file, 'utf8'))
    if (state.running) {
      try { process.kill(state.ownerPid, 0) }
      catch { state.running = false }
    }
    return state
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error('模拟记录读取失败，请保留文件后检查')
  }
}

async function saveSimulation(state) {
  await fs.writeFile(file + '.tmp', JSON.stringify(state, null, 2), { mode: 0o600 })
  await fs.rename(file + '.tmp', file)
}

export function registerApplicationSimulation() {
  ipcMain.handle('get-application-simulation', readDisplayedSimulation)
  ipcMain.handle('start-application-simulation', async (_, { batchSize, mode = 'local' } = {}) => {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('每批数量必须为正整数')
    if (!['local', 'online'].includes(mode)) throw new Error('模拟方式无效')
    const previous = await readSimulation()
    const online = await readOnlineSimulation()
    if (task || previous?.running || onlineSimulationRunning(online)) throw new Error('模拟正在运行，请等待当前批次完成')
    const boss = readConfigFile('boss.json'), common = readConfigFile('common-job-condition-config.json')
    const targets = readConfigFile('target-company-list.json'), ai = readConfigFile('job-ai-match.json')
    const models = readConfigFile('llm.json'), model = models?.find(item => item.enabled)
    const useAi = jobFilterOptions(ai).enabled
    if (useAi && !model) throw new Error('已开启AI筛选，请配置大模型，或关闭AI筛选后使用规则模拟')
    if (mode === 'online') {
      const status = await sendToDaemon({ type: 'get-status' }, { needCallback: true })
      if (status?.workers?.some(worker => ['geekAutoStartWithBossMain', onlineSimulationWorker].includes(worker.workerId))) throw new Error('请先停止正在运行的自动开聊或在线模拟任务')
      const runId = randomUUID()
      await saveOnlineSimulation({ runId, target: batchSize, processed: 0, running: true, createdAt: new Date().toISOString() })
      try { await runCommon({ mode: onlineSimulationWorker, simulationLimit: batchSize, simulationRunId: runId }) }
      catch (error) { await saveOnlineSimulation({ runId, target: batchSize, processed: 0, running: false, runError: String(error) }); throw error }
      return await readDisplayedSimulation()
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([boss, common, targets, ai, useAi ? models : []])).digest('hex')
    let state = previous
    if (!state || state.version !== 2 || state.fingerprint !== fingerprint) {
      const result = await getSimulationJobs()
      if (!Array.isArray(result.data)) throw new Error('读取未开聊职位失败')
      if (state) await fs.copyFile(file, file + '.' + Date.now() + '.bak')
      state = { version: 2, createdAt: new Date().toISOString(), fingerprint,
        source: '本地职位库；已排除本地开聊记录；未重新核验BOSS在招与线上沟通状态',
        model: useAi ? model.model : '', jobs: simulationCandidates(result.data, [], Math.max(1, result.data.length)), target: 0 }
    }
    if (!state.jobs.length) throw new Error('职位库暂无未开聊且有完整描述的岗位')
    state.target = nextSimulationTarget(state, batchSize)
    state.batchSize = batchSize
    delete state.runError
    const config = { ...ai, filterContext: buildJobMatchContext(boss, common, targets, filterCatalog), feedbackRecords: useAi ? await readJobFeedback() : [] }
    state.aiFilters = config.aiFilters
    state.inputSources = config.inputSources
    state.running = true
    state.ownerPid = process.pid
    await saveSimulation(state)
    task = runApplicationSimulation(state, config, model, saveSimulation)
      .catch(async () => { state.running = false; state.runError = '模拟中断，已完成记录保留，可继续重试'; await saveSimulation(state) })
      .finally(() => { task = null })
    return await readDisplayedSimulation()
  })
  ipcMain.handle('stop-online-application-simulation', async () => {
    const online = await readOnlineSimulation()
    if (online?.running) {
      await sendToDaemon({ type: 'stop-worker', workerId: onlineSimulationWorker }, { needCallback: true })
      await saveOnlineSimulation({ ...(await readOnlineSimulation()), running: false, stopped: true })
    }
    return await readDisplayedSimulation()
  })
}
