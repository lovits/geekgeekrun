import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalRejectionQueue } from './local-rejection-queue.mjs'

test('local enqueue acknowledges before slow DB write, snapshots data, and serializes writes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reject-queue-'))
  let release, active = 0, peak = 0
  const gate = new Promise(resolve => { release = resolve }), saved = []
  const queue = createLocalRejectionQueue(dir, async data => {
    peak = Math.max(peak, ++active)
    await gate
    saved.push(data)
    active--
  })
  try {
    const job = { name: '岗位A' }
    await queue.enqueue(job)
    job.name = '岗位B'
    await queue.enqueue(job)
    assert.equal(saved.length, 0)
    assert.equal((await fs.readdir(dir)).length, 2)
    release()
    await queue.flush()
    assert.deepEqual(saved.map(row => row.name), ['岗位A', '岗位B'])
    assert.equal(peak, 1)
    assert.deepEqual(await fs.readdir(dir), [])
  } finally { release(); await fs.rm(dir, { recursive: true, force: true }) }
})

test('failed writes remain durable and can be recovered by the next run', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reject-recovery-'))
  try {
    let failures = 0
    const queue = createLocalRejectionQueue(dir, async () => { throw Error('disk busy') }, () => failures++)
    await queue.enqueue({ name: '岗位A', reason: '公司不匹配' })
    await assert.rejects(queue.flush(), /保存失败/)
    assert.equal(failures, 2)
    const saved = []
    const recovered = createLocalRejectionQueue(dir, async item => saved.push(item))
    await recovered.recover()
    await recovered.flush()
    assert.equal(saved[0].reason, '公司不匹配')
    assert.deepEqual(await fs.readdir(dir), [])
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
