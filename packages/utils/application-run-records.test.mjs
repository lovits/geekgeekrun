import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { recordApplicationEvent, readApplicationRunRecords, mergeApplicationRecords, attachApplicationRecording } from './application-run-records.mjs'

const candidate = { jobInfo: { encryptId: 'job-1', jobName: 'Agent后端实习生', postDescription: '开发Agent与后端API', positionName: '后端开发', salaryDesc: '200-300元/天', experienceName: '4天/周 3个月', locationName: '北京' }, bossInfo: { name: '招聘者', title: '研发负责人', activeTimeDesc: '今日活跃' }, brandComInfo: { brandName: '目标公司' } }
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-run-records-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return path.join(dir, 'records.jsonl')
}

test('collect, AI assessment and confirmed chat synchronize one row while preserving the actual score', async t => {
  const file = await fixture(t)
  await recordApplicationEvent('seen', candidate, {}, file)
  let [row] = await readApplicationRunRecords(file)
  assert.equal(row.status, 'observed'); assert.equal(row.score, null)
  assert.equal(row.salaryDesc, '200-300元/天'); assert.equal(row.bossTitle, '研发负责人')
  assert.equal(row.url, 'https://www.zhipin.com/job_detail/job-1.html')
  await recordApplicationEvent('ai', candidate, { match: true, score: 84, reason: 'Agent与API职责匹配', gaps: ['Java实战待补充'], model: 'test-model' }, file)
  await recordApplicationEvent('chatted', candidate, {}, file)
  const rows = await readApplicationRunRecords(file)
  assert.equal(rows.length, 1); row = rows[0]
  assert.equal(row.status, 'chatted'); assert.equal(row.score, 84)
  assert.equal(row.reason, 'Agent与API职责匹配'); assert.ok(row.chattedAt)
  const merged = mergeApplicationRecords([{ jobId: 'job-1', score: 70, reviewNotes: ['个人备注'], snapshot: { salaryDesc: '过时薪资' } }, { jobId: 'job-2', score: 80 }], rows)
  assert.equal(merged.length, 2); assert.deepEqual(merged[0].reviewNotes, ['个人备注'])
  assert.equal(merged[0].score, 84); assert.equal(merged[0].snapshot, undefined)
  await recordApplicationEvent('screened', candidate, { status: 'verify', reason: '页面信息变化，需复核', afterAi: true }, file)
  ;[row] = await readApplicationRunRecords(file)
  assert.equal(row.status, 'verify'); assert.equal(row.score, 84); assert.equal(row.aiEvaluated, true)
})

test('rule exclusions have no fabricated score; an AI failure remains an error after local marking', async t => {
  const file = await fixture(t)
  await recordApplicationEvent('seen', candidate, {}, file)
  await recordApplicationEvent('screened', candidate, { reason: '岗位只招2026届，资格不符' }, file)
  let [row] = await readApplicationRunRecords(file)
  assert.equal(row.status, 'reject'); assert.equal(row.aiEvaluated, false); assert.equal(row.score, null)
  assert.match(row.reason, /2026/)
  await recordApplicationEvent('ai', candidate, { match: false, reason: '模型调用失败' }, file)
  await recordApplicationEvent('marked', candidate, { markReason: 3, extInfo: { aiScore: undefined, reason: '模型调用失败' } }, file)
  ;[row] = await readApplicationRunRecords(file)
  assert.equal(row.status, 'error'); assert.equal(row.score, null)
})

test('all recording hooks persist locally without any browser or messaging dependency', async t => {
  const file = await fixture(t), listeners = {}
  const hooks = Object.fromEntries(['jobDetailIsGetFromRecommendList', 'jobScreened', 'jobMatchEvaluated', 'jobMarkedAsNotSuit', 'newChatStartup'].map(name => [name, { tapPromise: (_, fn) => { listeners[name] = fn } }]))
  attachApplicationRecording(hooks, file, { simulationRunId: 'online-run-1' })
  await listeners.jobDetailIsGetFromRecommendList(candidate)
  await listeners.jobScreened(candidate, { reason: '不符合设置' })
  const [record] = await readApplicationRunRecords(file)
  assert.equal(record.status, 'reject'); assert.equal(record.recordOrigin, 'online-simulation'); assert.equal(record.simulationRunId, 'online-run-1')
  assert.equal(Object.keys(listeners).length, 5)
  await assert.rejects(recordApplicationEvent('seen', {}, {}, file), /岗位ID/)
})

test('concurrent local writes retain all jobs; an incomplete tail is ignored but corrupt history is reported', async t => {
  const file = await fixture(t)
  assert.deepEqual(await readApplicationRunRecords(file), [])
  await Promise.all(Array.from({ length: 12 }, (_, i) => recordApplicationEvent('seen', { ...candidate, jobInfo: { ...candidate.jobInfo, encryptId: 'job-' + i } }, {}, file)))
  assert.equal((await readApplicationRunRecords(file)).length, 12)
  await fs.appendFile(file, '{"jobId":')
  assert.equal((await readApplicationRunRecords(file)).length, 12)
  await fs.appendFile(file, '\n{"jobId":"other"}\n')
  await assert.rejects(readApplicationRunRecords(file), /格式损坏/)
})

test('daily history deduplicates screening steps but preserves the same job on different days', async t => {
  const file = await fixture(t)
  await fs.writeFile(file, [
    { jobId: 'repeat', status: 'observed', recordedAt: '2026-11-19T01:00:00Z' },
    { jobId: 'repeat', status: 'recommend', score: 80, recordedAt: '2026-11-19T01:01:00Z' },
    { jobId: 'repeat', status: 'chatted', recordedAt: '2026-11-19T01:02:00Z' },
    { jobId: 'repeat', status: 'observed', recordedAt: '2026-11-19T01:03:00Z' },
    { jobId: 'repeat', status: 'reject', recordedAt: '2026-11-20T01:00:00Z' }
  ].map(row => JSON.stringify(row)).join('\n') + '\n')
  const daily = await readApplicationRunRecords(file, { groupByDay: true })
  assert.equal(daily.length, 2)
  assert.equal(daily[0].status, 'reject')
  assert.equal(daily[1].status, 'chatted')
  assert.equal(daily[1].score, 80)
  const latest = await readApplicationRunRecords(file)
  assert.equal(latest.length, 1)
  assert.equal(latest[0].status, 'reject')
})
