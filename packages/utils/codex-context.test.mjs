import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { codexContextLimits, validateContextWindow } from './codex-context.mjs'
import { codexCompletion } from './codex-request.mjs'

test('context bounds come from model metadata; unknown models cannot override context', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'))
  try {
    await fs.writeFile(path.join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'fixture', context_window: 272000, max_context_window: 872000 }] }))
    const limits = await codexContextLimits('fixture', dir)
    assert.deepEqual(limits, { minTokens: 4096, defaultTokens: 272000, maxTokens: 872000 })
    assert.equal(validateContextWindow(0, null), undefined)
    assert.equal(validateContextWindow(32000, limits), 32000)
    for (const value of [-1, 1, 872001, '32000', 32000.5]) assert.throws(() => validateContextWindow(value, limits))
    assert.equal(await codexContextLimits('unknown', dir), null)
    assert.throws(() => validateContextWindow(32000, null))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('custom context is passed to the actual CLI invocation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-call-test-'))
  const previousHome = process.env.CODEX_HOME
  try {
    process.env.CODEX_HOME = dir
    await fs.writeFile(path.join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'fixture', context_window: 64000 }] }))
    const binary = path.join(dir, 'codex')
    const argvFile = path.join(dir, 'args.json')
    await fs.writeFile(binary, `#!/usr/bin/env node\nconst fs=require('fs');const args=process.argv.slice(2);fs.writeFileSync(${JSON.stringify(argvFile)},JSON.stringify(args));fs.writeFileSync(args[args.indexOf('-o')+1],'OK');`, { mode: 0o700 })
    await codexCompletion([{ role: 'user', content: 'test' }], 'fixture', { binary, contextWindowTokens: 32000 })
    assert.ok(JSON.parse(await fs.readFile(argvFile, 'utf8')).includes('model_context_window=32000'))
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = previousHome
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('each job uses a fresh ephemeral CLI invocation without previous job history', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-job-test-'))
  try {
    const binary = path.join(dir, 'codex'), log = path.join(dir, 'calls.jsonl')
    await fs.writeFile(binary, `#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');fs.writeFileSync(a[a.indexOf('-o')+1],'OK');`, { mode: 0o700 })
    await codexCompletion([{ role: 'user', content: 'JOB_A_UNIQUE' }], 'fixture', { binary })
    await codexCompletion([{ role: 'user', content: 'JOB_B_UNIQUE' }], 'fixture', { binary })
    const [a,b] = (await fs.readFile(log, 'utf8')).trim().split('\n').map(JSON.parse)
    for (const args of [a,b]) {
      assert.equal(args[0], 'exec')
      assert(args.includes('--ephemeral'))
      assert(!args.includes('resume'))
    }
    assert.notEqual(a[a.indexOf('-C')+1], b[b.indexOf('-C')+1])
    assert(!b.at(-1).includes('JOB_A_UNIQUE'))
    assert(b.at(-1).includes('JOB_B_UNIQUE'))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
