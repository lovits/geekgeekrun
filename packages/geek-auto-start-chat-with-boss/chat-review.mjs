import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

export async function reviewChatCandidate(candidate, directory, { timeoutMs = 10 * 60 * 1000, pollMs = 1000 } = {}) {
  if (!directory) return true
  const requestId = randomUUID()
  const jobId = candidate.jobInfo?.encryptId
  if (!jobId) return false
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const pending = path.join(directory, 'pending.json')
  await fs.writeFile(pending, JSON.stringify({ requestId, jobId, ...candidate }), { mode: 0o600 })
  console.log('Candidate awaiting review', candidate.selectedJob?.brandName, candidate.jobInfo?.jobName)
  try {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const decision = JSON.parse(await fs.readFile(path.join(directory, 'decision.json'), 'utf8'))
        if (decision.requestId === requestId && decision.jobId === jobId && typeof decision.approve === 'boolean') {
          return decision.approve
        }
      } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
      }
      await sleep(pollMs)
    }
    return false
  } finally {
    await fs.rm(pending, { force: true })
  }
}
