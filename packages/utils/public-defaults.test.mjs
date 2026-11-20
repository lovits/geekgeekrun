import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { defaultJobPreferences } from './ai-job-match.mjs'

test('public defaults contain no personal resume, preferences, accounts or company choices', () => {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../geek-auto-start-chat-with-boss/default-config-file/${name}.json`, import.meta.url), 'utf8'))
  const ai = read('job-ai-match')
  assert.equal(defaultJobPreferences, '')
  assert.equal(ai.enabled, false)
  assert.equal(ai.resumeText, '')
  assert.equal(ai.preferences, '')
  for (const model of read('llm')) {
    assert.equal(model.providerCompleteApiUrl, '')
    assert.equal(model.providerApiSecret, '')
    assert.equal(model.model, '')
  }
  assert.deepEqual(read('target-company-list'), [])
  const common = read('common-job-condition-config')
  assert.deepEqual(common.expectCompanies, [])
  for (const [key, value] of Object.entries(common)) if (key.endsWith('RegExpStr')) assert.equal(value, '', key)
})
