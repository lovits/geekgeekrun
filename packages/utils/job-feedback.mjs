import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { recommendFromFeedback } from './feedback-recommender.mjs'

export const feedbackFile = path.join(os.homedir(), '.geekgeekrun/storage/job-feedback.json')
let writes = Promise.resolve()
export async function readJobFeedback(file = feedbackFile) {
  try {
    const records = JSON.parse(await fs.readFile(file, 'utf8'))
    if (!Array.isArray(records)) throw new Error('岗位反馈文件格式无效')
    return records
  } catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
export function saveJobFeedback(record, file = feedbackFile) {
  if (!['like', 'dislike', 'neutral'].includes(record?.value) || typeof record.jobId !== 'string' || !record.jobId || record.jobId.length > 150) return Promise.reject(new Error('岗位反馈无效'))
  const operation = writes.catch(() => {}).then(async () => {
    const records = (await readJobFeedback(file)).filter(item => item.jobId !== record.jobId)
    if (record.value !== 'neutral') records.push({ jobId: record.jobId, value: record.value, company: String(record.company || '').slice(0, 200), jobName: String(record.jobName || '').slice(0, 300), description: String(record.description || '').slice(0, 12000), updatedAt: new Date().toISOString() })
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temp = file + '.' + randomUUID() + '.tmp'
    try { await fs.writeFile(temp, JSON.stringify(records, null, 2), { mode: 0o600 }); await fs.rename(temp, file) }
    finally { await fs.rm(temp, { force: true }) }
    return records
  })
  writes = operation
  return operation
}
export function relatedJobFeedback(records, candidate, limit = 6) {
  return recommendFromFeedback(records, candidate, limit).feedbackExamples
}
export function applyFeedbackScore(result, recommendation) {
  // Explicit constraints and a model rejection can never be overridden by a positive signal.
  const adjustment = recommendation?.adjustment || 0
  return { ...result, baseScore: result.score, feedbackAdjustment: adjustment, ...(recommendation ? { feedbackRecommendation: recommendation } : {}), score: Math.min(result.match ? 100 : 49, Math.max(0, result.score + adjustment)) }
}
