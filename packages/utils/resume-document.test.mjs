import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { saveResumeDocument, resumeDocumentPath } from './resume-document.mjs'
import { recentScoreExamples } from './score-examples.mjs'

test('preview keeps a private PDF copy even after the original is moved', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-document-'))
  try {
    const source = path.join(root, 'resume.pdf'), store = path.join(root, 'stored')
    await fs.writeFile(source, '%PDF-1.7\ntest')
    const id = await saveResumeDocument(source, store)
    await fs.rename(source, source + '.moved')
    assert.equal(await fs.readFile(resumeDocumentPath(id, store), 'utf8'), '%PDF-1.7\ntest')
    assert.equal((await fs.stat(resumeDocumentPath(id, store))).mode & 0o777, 0o600)
    await fs.writeFile(source, 'not a pdf')
    await assert.rejects(saveResumeDocument(source, store), /有效的PDF/)
    for (const invalid of ['../../file.pdf', '/tmp/file.pdf', '', null]) assert.throws(() => resumeDocumentPath(invalid, store))
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
test('examples show only five newest scores without deleting the stored history', () => {
  const records = Array.from({ length: 12 }, (_, i) => ({ id: i, evaluatedAt: new Date(1000 + i * 1000).toISOString() }))
  assert.deepEqual(recentScoreExamples(records).map(row => row.id), [11, 10, 9, 8, 7])
  assert.equal(records.length, 12)
})
