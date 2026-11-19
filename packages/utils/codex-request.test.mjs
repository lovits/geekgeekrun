import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { codexCompletion, codexSearchPaths, findCodex } from './codex-request.mjs'

test('Codex returns a completion and removes temporary chat data', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-test-'))
  try {
    const executable = path.join(dir, 'codex')
    const marker = path.join(dir, 'output-path')
    await fs.writeFile(executable, `#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nshift\nprintf '%s' "$1" > '${marker}'\nprintf '连接成功' > "$1"\n`, { mode: 0o700 })
    const result = await codexCompletion([{ role: 'user', content: 'hello' }], '', { binary: executable })
    assert.equal(result.choices[0].message.content, '连接成功')
    await assert.rejects(fs.access(await fs.readFile(marker, 'utf8')))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('failed CLI does not fabricate a reply or expose prompt data', async () => {
  await assert.rejects(codexCompletion([{ role: 'user', content: 'private chat' }], '', { binary: '/usr/bin/false' }), error => {
    assert.match(error.message, /Codex 调用失败/)
    assert.ok(!error.message.includes('private chat'))
    return true
  })
})


test('discovery supports other Mac users, user Applications and custom CLI installations', () => {
  const candidates = codexSearchPaths({ platform: 'darwin', home: '/Users/other person', env: { PATH: '/custom tools/bin:/opt/homebrew/bin::relative-bin' } })
  assert.ok(candidates.includes('/Users/other person/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'))
  assert.ok(candidates.includes('/Users/other person/Applications/Codex.app/Contents/Resources/codex'))
  assert.ok(candidates.includes('/custom tools/bin/codex'))
  assert.equal(candidates.filter(p => p === '/opt/homebrew/bin/codex').length, 1)
  assert.ok(!candidates.includes('codex'))
  assert.ok(!candidates.some(p => p.startsWith('relative-bin')))
})

test('discovery builds Linux and Windows native executable paths without Mac paths', () => {
  assert.deepEqual(codexSearchPaths({ platform: 'linux', home: '/home/other', env: { PATH: '/usr/bin:/custom/bin' } }), ['/home/other/.local/bin/codex', '/usr/bin/codex', '/custom/bin/codex'])
  assert.deepEqual(codexSearchPaths({ platform: 'win32', home: 'C:/Users/other', env: { Path: 'C:/Tools;D:/My Tools' } }), ['C:\\Users\\other\\.local\\bin\\codex.exe', 'C:\\Tools\\codex.exe', 'D:\\My Tools\\codex.exe'])
})

test('discovery skips inaccessible or non-executable candidates and retains CLI fallback', async t => {
  const candidates = codexSearchPaths()
  t.mock.method(fs, 'access', async (candidate, mode) => {
    assert.equal(mode, fs.constants.X_OK)
    if (candidate !== candidates[1]) throw Object.assign(new Error('not executable'), { code: 'EACCES' })
  })
  assert.equal(await findCodex(), candidates[1])
  t.mock.restoreAll()
  t.mock.method(fs, 'access', async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) })
  assert.equal(await findCodex(), 'codex')
})

test('Windows npm installation resolves native Codex instead of executing a cmd shim', () => {
  const candidates = codexSearchPaths({ platform: 'win32', home: 'C:\\Users\\小双', env: { APPDATA: 'C:\\Users\\小双\\AppData\\Roaming' } })
  assert.ok(candidates.some(p => p.endsWith('codex\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe')))
  assert.ok(candidates.some(p => p.includes('codex-win32-x64')))
  assert.ok(!candidates.some(p => p.endsWith('.cmd')))
})

test('manual Codex path is validated and is never silently replaced with auto discovery', async t => {
  const { resolveCodexBinary } = await import('./codex-request.mjs')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex manual '))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const binary = path.join(dir, 'codex')
  await fs.writeFile(binary, '#!/bin/sh\nexit 0\n', { mode: 0o700 })
  assert.equal(await resolveCodexBinary({codexDetectionMode:'manual',codexBinaryPath:binary}),binary)
  for(const value of ['', 'relative/path', dir, binary+'.cmd']) await assert.rejects(resolveCodexBinary({codexDetectionMode:'manual',codexBinaryPath:value}))
})
