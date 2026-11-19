import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationOutcome, filterApplicationRecords } from './application-outcome.mjs'

test('matched candidates with missing activity share the eligible display without changing the underlying guard', () => {
  const job = { status: 'verify', match: true, rulePass: true, reason: 'BOSS活跃状态未记录', score: 85 }
  assert.equal(applicationOutcome(job), 'eligible')
  assert.equal(job.status, 'verify')
  assert.match(job.reason, /未记录/)
  assert.equal(applicationOutcome({ status: 'recommend', rulePass: true }), 'eligible')
})

test('hard rejections remain excluded; incomplete results are not matches and real chats have their own status', () => {
  assert.equal(applicationOutcome({ status: 'reject', score: 85 }), 'ineligible')
  assert.equal(applicationOutcome({ status: 'verify', match: true, rulePass: false }), 'ineligible')
  for (const status of ['pending', 'error', 'observed']) assert.equal(applicationOutcome({ status, score: 90 }), null)
  assert.equal(applicationOutcome({ status: 'chatted', match: true, rulePass: true }), 'delivered')
  assert.equal(applicationOutcome({ status: 'chatted' }), 'delivered')
  assert.equal(applicationOutcome({ status: 'recommend' }), 'eligible')
})

test('simulation filters combine score, outcome and reason without mutating history', () => {
  const rows = [
    { jobId: 'old', status: 'recommend', score: 0, reason: 'Agent后端匹配', evaluatedAt: '2026-11-01T10:00:00Z' },
    { jobId: 'new', status: 'reject', score: null, reason: '不是实习', recordedAt: '2026-11-19T10:00:00Z' },
    { jobId: 'chat', status: 'chatted', score: 89, reason: 'Agent与API匹配', chattedAt: '2026-11-18T10:00:00Z' },
    { jobId: 'unknown', status: 'observed', reason: '' }
  ]
  assert.deepEqual(filterApplicationRecords(rows).map(x => x.jobId), ['new', 'chat', 'old', 'unknown'])
  assert.deepEqual(filterApplicationRecords(rows, { score: 'scored', reason: ' agent ' }).map(x => x.jobId), ['chat', 'old'])
  assert.deepEqual(filterApplicationRecords(rows, { outcome: 'ineligible', score: 'unscored', reason: '实习' }).map(x => x.jobId), ['new'])
  assert.equal(filterApplicationRecords(rows, { outcome: 'delivered', score: 'unscored' }).length, 0)
  assert.deepEqual(rows.map(x => x.jobId), ['old', 'new', 'chat', 'unknown'])
  assert.deepEqual(filterApplicationRecords(rows, { outcome: 'all', score: 'all', reason: '' }).map(x => x.jobId), ['new', 'chat', 'old', 'unknown'])
})

test('simulation missing or invalid dates sort last and snapshot dates remain usable', () => {
  const rows = [{ jobId: 'invalid', evaluatedAt: 'bad' }, { jobId: 'legacy', snapshot: { date: '2026-11-17T12:00:00Z' } }, { jobId: 'unknown' }]
  assert.deepEqual(filterApplicationRecords(rows).map(x => x.jobId), ['legacy', 'invalid', 'unknown'])
  assert.deepEqual(filterApplicationRecords([], { reason: '实习' }), [])
})

test('column sorting groups equal values with newest first and keeps missing values last', () => {
  const rows = [
    { jobId: 'a-old', company: '甲公司', score: 80, reason: '不符合条件', recordedAt: '2026-11-01T00:00:00Z' },
    { jobId: 'b', company: '乙公司', score: 90, reason: '通过筛选', recordedAt: '2026-11-03T00:00:00Z' },
    { jobId: 'a-new', company: '甲公司', score: 80, reason: '不符合条件', recordedAt: '2026-11-04T00:00:00Z' },
    { jobId: 'empty', company: '', score: null, reason: '', recordedAt: '2026-11-05T00:00:00Z' }
  ]
  for (const sortBy of ['company', 'score', 'reason']) {
    for (const sortOrder of ['ascending', 'descending']) {
      const result = filterApplicationRecords(rows, { sortBy, sortOrder }).map(x => x.jobId)
      assert.ok(result.indexOf('a-new') + 1 === result.indexOf('a-old'), `${sortBy} ${sortOrder} groups newest first`)
      assert.equal(result.at(-1), 'empty')
    }
  }
  assert.deepEqual(filterApplicationRecords(rows, { sortBy: 'score', sortOrder: 'descending', score: 'scored' }).map(x => x.jobId), ['b', 'a-new', 'a-old'])
  assert.deepEqual(filterApplicationRecords(rows).map(x => x.jobId), ['empty', 'a-new', 'b', 'a-old'])
})
