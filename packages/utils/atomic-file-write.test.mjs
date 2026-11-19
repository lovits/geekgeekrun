import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { atomicWriteFile } from './atomic-file-write.mjs'

test('config readers always see a complete old or new JSON document during concurrent writes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-config-write-'))
  const file = path.join(directory, 'config.json')
  try {
    await atomicWriteFile(file, JSON.stringify({ round: -1, data: '' }))
    for (let round = 0; round < 40; round++) {
      const data = 'x'.repeat(128000)
      await Promise.all([
        atomicWriteFile(file, JSON.stringify({ round, data })),
        ...Array.from({ length: 8 }, async () => {
          const saved = JSON.parse(await fs.readFile(file, 'utf8'))
          assert.ok(saved.round === round || saved.round === round - 1)
          if (saved.round >= 0) assert.equal(saved.data, data)
        })
      ])
    }
    assert.deepEqual(await fs.readdir(directory), ['config.json'])
    await atomicWriteFile(file, '{"round":100}', { isSync: true })
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).round, 100)
    if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o777, 0o600)
    await assert.rejects(atomicWriteFile(path.join(directory, 'missing', 'config.json'), '{}'))
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).round, 100)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
