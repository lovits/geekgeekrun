import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { reviewChatCandidate } from './chat-review.mjs'

test('review requires an explicit decision bound to this request and job', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-review-'))
  try {
    let settled = false
    const result = reviewChatCandidate({ jobInfo: { encryptId: 'job-1' } }, dir, { timeoutMs: 1000, pollMs: 5 }).then(value => { settled = true; return value })
    let pending
    while (!pending) {
      try { pending = JSON.parse(await fs.readFile(path.join(dir, 'pending.json'), 'utf8')) } catch { await sleep(5) }
    }
    await fs.writeFile(path.join(dir, 'decision.json'), JSON.stringify({ requestId: 'stale-review', jobId: pending.jobId, approve: true }))
    await sleep(30)
    assert.equal(settled, false)
    await fs.writeFile(path.join(dir, 'decision.json'), JSON.stringify({ requestId: pending.requestId, jobId: 'other', approve: true }))
    await sleep(30)
    assert.equal(settled, false)
    await fs.writeFile(path.join(dir, 'decision.json'), JSON.stringify({ requestId: pending.requestId, jobId: pending.jobId, approve: true }))
    assert.equal(await result, true)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('missing or negative approval cannot send a chat', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-review-'))
  try {
    const result = reviewChatCandidate({ jobInfo: { encryptId: 'job-1' } }, dir, { timeoutMs: 1000, pollMs: 5 })
    let pending
    while (!pending) {
      try { pending = JSON.parse(await fs.readFile(path.join(dir, 'pending.json'), 'utf8')) } catch { await sleep(5) }
    }
    await fs.writeFile(path.join(dir, 'decision.json'), JSON.stringify({ requestId: pending.requestId, jobId: pending.jobId, approve: false }))
    assert.equal(await result, false)
    assert.equal(await reviewChatCandidate({ jobInfo: { encryptId: 'job-1' } }, dir, { timeoutMs: 15, pollMs: 5 }), false)
    assert.equal(await reviewChatCandidate({}, dir), false)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
