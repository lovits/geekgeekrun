import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const applicationRunFile = path.join(os.homedir(), '.geekgeekrun/storage/application-run-records.jsonl')
const markReasons = ['原因未记录', 'BOSS活跃度不符合设置', '手动标记不合适', '职位职责不符合设置', '工作地不符合设置', '工作经验不符合设置', '薪资不符合设置', '公司不符合设置']
let writes = Promise.resolve()

export function recordApplicationEvent(kind, candidate, detail = {}, file = applicationRunFile, metadata = {}) {
  const job = candidate?.jobInfo
  if (!job?.encryptId) return Promise.reject(new Error('运行记录缺少岗位ID'))
  const now = new Date().toISOString()
  const boss = candidate.bossInfo || {}, company = candidate.brandComInfo || {}
  const event = {
    jobId: job.encryptId, recordedAt: now, recordOrigin: metadata.simulationRunId ? 'online-simulation' : 'runtime', simulationRunId: metadata.simulationRunId,
    company: company.brandName || company.customerBrandName || '', jobName: job.jobName,
    positionName: job.positionName || '', city: job.address || job.locationName || '',
    experience: job.experienceName || '', salaryDesc: job.salaryDesc || '', description: job.postDescription || '',
    bossName: boss.name || '', bossTitle: boss.title || '', bossActiveTimeDesc: boss.activeTimeDesc || '',
    url: `https://www.zhipin.com/job_detail/${encodeURIComponent(job.encryptId)}.html`,
  }
  if (kind === 'seen') {
    Object.assign(event, {
      status: 'observed', score: null, aiEvaluated: false, reason: '已采集，尚未完成本次筛选',
    })
  } else if (kind === 'screened') {
    Object.assign(event, { status: detail.status || 'reject', reason: detail.reason, rulePass: detail.rulePass ?? false })
    if (!detail.afterAi) Object.assign(event, { score: null, aiEvaluated: false })
  } else if (kind === 'ai') {
    Object.assign(event, detail, { status: !Number.isInteger(detail.score) ? 'error' : detail.match ? 'recommend' : 'reject', evaluatedAt: now, aiEvaluated: true, rulePass: true })
  } else if (kind === 'marked') {
    const found = { 1: candidate.bossInfo?.activeTimeDesc, 4: job.locationName, 5: job.experienceName, 6: job.salaryDesc, 7: candidate.brandComInfo?.brandName }[detail.markReason]
    const failedAi = Object.hasOwn(detail.extInfo || {}, 'aiScore') && !Number.isInteger(detail.extInfo.aiScore)
    Object.assign(event, { status: failedAi ? 'error' : 'reject', reason: detail.extInfo?.reason || (markReasons[detail.markReason] || markReasons[0]) + (found ? `：${found}` : '') + (detail.extInfo?.chosenReasonInUi?.text ? `；${detail.extInfo.chosenReasonInUi.text}` : '') })
    if (Number.isInteger(detail.extInfo?.aiScore)) Object.assign(event, { score: detail.extInfo.aiScore, aiEvaluated: true, gaps: detail.extInfo.gaps })
  } else if (kind === 'chatted') {
    Object.assign(event, { status: 'chatted', chattedAt: now })
  } else return Promise.reject(new Error('未知的运行记录类型'))
  const operation = writes.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.appendFile(file, JSON.stringify(event) + '\n', { mode: 0o600 })
  })
  writes = operation
  return operation
}

export function attachApplicationRecording(hooks, file = applicationRunFile, metadata = {}) {
  for (const [hook, kind] of [['jobDetailIsGetFromRecommendList', 'seen'], ['jobScreened', 'screened'], ['jobMatchEvaluated', 'ai'], ['jobMarkedAsNotSuit', 'marked'], ['newChatStartup', 'chatted']]) {
    hooks[hook]?.tapPromise('ApplicationSimulationRecords', (candidate, detail) => recordApplicationEvent(kind, candidate, detail, file, metadata))
  }
}

export async function readApplicationRunRecords(file = applicationRunFile) {
  let text
  try { text = await fs.readFile(file, 'utf8') }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
  const records = new Map()
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue
    let event
    try { event = JSON.parse(line) }
    catch { if (index === lines.length - 1) break; throw new Error('运行记录格式损坏，请保留原文件后检查') }
    if (!event.jobId) throw new Error('运行记录缺少岗位ID')
    const previous = records.get(event.jobId) || {}
    records.set(event.jobId, { ...previous, ...event })
  }
  return [...records.values()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

export function mergeApplicationRecords(manual, runtime) {
  const existing = new Map(manual.map(job => [job.jobId, job]))
  const recorded = new Set(runtime.map(job => job.jobId))
  return [...runtime.map(job => ({ ...existing.get(job.jobId), ...job, snapshot: job.snapshot })), ...manual.filter(job => !recorded.has(job.jobId))]
}
